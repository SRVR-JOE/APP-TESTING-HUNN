// =============================================================================
// Luminex Configurator — Troubleshooting: Health Check Engine
// =============================================================================

import { exec } from 'child_process';

// ---------------------------------------------------------------------------
// Types  (health-check domain — richer than the shared DiscoveredSwitch)
// ---------------------------------------------------------------------------

/**
 * Extended switch snapshot used exclusively by the health-check engine.
 * Contains live diagnostic fields (vlans, igmp, rlink, sfpSlots) that go
 * beyond what the shared DiscoveredSwitch carries.
 */
export interface HealthCheckSwitch {
  name: string;
  ip: string;
  model: string;
  firmware: string;
  mac: string;
  ports: HealthCheckPort[];
  vlans: VlanDefinition[];
  igmp: IgmpConfig;
  poe?: PoeStatus;
  rlink?: RlinkStatus;
  temperature?: number; // Celsius
  sfpSlots?: SfpSlot[];
}

export interface HealthCheckPort {
  port: number;
  label: string;
  linkUp: boolean;
  speedMbps: number;
  maxSpeedMbps: number;
  errorsPerMin: number;
  isTrunk: boolean;
  vlans: number[];
}

export interface VlanDefinition {
  id: number;
  name: string;
  tagged: number[];
  untagged: number[];
}

export interface IgmpConfig {
  enabled: boolean;
  querierEnabled: boolean;
  querierVlans: number[];
}

export interface PoeStatus {
  budgetW: number;
  drawW: number;
  ports: { port: number; drawW: number; maxW: number; enabled: boolean }[];
}

export interface RlinkStatus {
  enabled: boolean;
  ringClosed: boolean;
  portA: number;
  portB: number;
  failedLink: boolean;
}

export interface SfpSlot {
  slot: number;
  present: boolean;
  speedGbps: number;
  slotMaxGbps: number;
  vendor?: string;
  serialNumber?: string;
}

// ---------------------------------------------------------------------------
// Health Check Result Types
// ---------------------------------------------------------------------------

/**
 * Check-level status used by the health-check engine.
 * Distinct from the shared HealthStatus ('healthy'|'warning'|'critical'|'offline')
 * which represents overall switch health as persisted in the DB.
 */
export type CheckStatus = 'pass' | 'warning' | 'fail' | 'critical';

export interface HealthCheckDetail {
  switchName?: string;
  switchIp?: string;
  port?: number;
  value?: string;
  threshold?: string;
  status: CheckStatus;
  message: string;
}

export interface HealthCheckResult {
  checkName: string;
  displayName: string;
  status: CheckStatus;
  message: string;
  details: HealthCheckDetail[];
  runAt: string;
}

// ---------------------------------------------------------------------------
// Known-bad firmware list
// ---------------------------------------------------------------------------

const KNOWN_BAD_FIRMWARE: string[] = [
  '2.0.0',
  '2.1.0-beta',
  '3.0.0-rc1',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function worstStatus(statuses: CheckStatus[]): CheckStatus {
  const priority: Record<CheckStatus, number> = {
    pass: 0,
    warning: 1,
    fail: 2,
    critical: 3,
  };
  let worst: CheckStatus = 'pass';
  for (const s of statuses) {
    if (priority[s] > priority[worst]) worst = s;
  }
  return worst;
}

function now(): string {
  return new Date().toISOString();
}

/** Perform a real network ping using the system ping command. */
async function simulatePing(ip: string): Promise<{ alive: boolean; latencyMs: number }> {
  return new Promise((resolve) => {
    // Validate IP/host — prevent command injection
    if (!/^[\w.\-:]+$/.test(ip)) {
      resolve({ alive: false, latencyMs: -1 });
      return;
    }

    const isWindows = process.platform === 'win32';
    const timeoutMs = 3000;
    const timeoutSec = Math.max(1, Math.ceil(timeoutMs / 1000));

    const cmd = isWindows
      ? `ping -n 1 -w ${timeoutMs} ${ip}`
      : `ping -c 1 -W ${timeoutSec} ${ip}`;

    const startTime = performance.now();

    exec(cmd, { timeout: timeoutMs + 2000 }, (error, stdout) => {
      const elapsed = performance.now() - startTime;

      if (error) {
        resolve({ alive: false, latencyMs: -1 });
        return;
      }

      let latencyMs = -1;

      if (isWindows) {
        const match = stdout.match(/time[=<](\d+(?:\.\d+)?)\s*ms/i);
        if (match) {
          latencyMs = parseFloat(match[1]);
        }
      } else {
        const match = stdout.match(/time[=](\d+(?:\.\d+)?)\s*ms/i);
        if (match) {
          latencyMs = parseFloat(match[1]);
        }
      }

      // Fallback to elapsed time if parsing failed but command succeeded
      if (latencyMs === -1 && !error) {
        latencyMs = Math.round(elapsed * 100) / 100;
      }

      resolve({ alive: latencyMs >= 0, latencyMs });
    });
  });
}

// ---------------------------------------------------------------------------
// HealthCheckEngine
// ---------------------------------------------------------------------------

export class HealthCheckEngine {
  // -------------------------------------------------------------------------
  // Run all checks
  // -------------------------------------------------------------------------

  async runAll(switches: HealthCheckSwitch[]): Promise<HealthCheckResult[]> {
    const results = await Promise.all([
      this.pingSweep(switches),
      this.firmwareConsistency(switches),
      this.vlanConsistency(switches),
      this.igmpAuditor(switches),
      this.poeBudget(switches),
      this.rlinkxValidation(switches),
      this.portErrorCheck(switches),
      this.linkSpeedAudit(switches),
      this.cableSfpCheck(switches),
      this.temperatureCheck(switches),
      this.duplicateIpCheck(switches),
    ]);
    return results;
  }

  // -------------------------------------------------------------------------
  // 1. Ping Sweep
  // -------------------------------------------------------------------------

  async pingSweep(switches: HealthCheckSwitch[]): Promise<HealthCheckResult> {
    const details: HealthCheckDetail[] = [];

    for (const sw of switches) {
      const { alive, latencyMs } = await simulatePing(sw.ip);

      if (!alive) {
        details.push({
          switchName: sw.name,
          switchIp: sw.ip,
          value: 'unreachable',
          threshold: '<200ms',
          status: 'critical',
          message: `${sw.name} (${sw.ip}) is unreachable`,
        });
      } else if (latencyMs > 200) {
        details.push({
          switchName: sw.name,
          switchIp: sw.ip,
          value: `${latencyMs}ms`,
          threshold: '<200ms',
          status: 'fail',
          message: `${sw.name} latency ${latencyMs}ms exceeds 200ms`,
        });
      } else if (latencyMs > 50) {
        details.push({
          switchName: sw.name,
          switchIp: sw.ip,
          value: `${latencyMs}ms`,
          threshold: '<50ms',
          status: 'warning',
          message: `${sw.name} latency ${latencyMs}ms exceeds 50ms`,
        });
      } else {
        details.push({
          switchName: sw.name,
          switchIp: sw.ip,
          value: `${latencyMs}ms`,
          threshold: '<10ms',
          status: latencyMs < 10 ? 'pass' : 'pass',
          message: `${sw.name} responded in ${latencyMs}ms`,
        });
      }
    }

    const status = worstStatus(details.map((d) => d.status));
    const unreachable = details.filter((d) => d.status === 'critical').length;
    const slow = details.filter((d) => d.status === 'warning' || d.status === 'fail').length;

    let message = `All ${switches.length} switches reachable with acceptable latency`;
    if (unreachable > 0) message = `${unreachable} switch(es) unreachable`;
    else if (slow > 0) message = `${slow} switch(es) with elevated latency`;

    return {
      checkName: 'pingSweep',
      displayName: 'Ping Sweep',
      status,
      message,
      details,
      runAt: now(),
    };
  }

  // -------------------------------------------------------------------------
  // 2. Firmware Consistency
  // -------------------------------------------------------------------------

  async firmwareConsistency(switches: HealthCheckSwitch[]): Promise<HealthCheckResult> {
    const details: HealthCheckDetail[] = [];
    const versions = new Set(switches.map((s) => s.firmware));
    const majorVersion = switches.length > 0 ? switches[0].firmware : '';

    for (const sw of switches) {
      const isKnownBad = KNOWN_BAD_FIRMWARE.includes(sw.firmware);
      const matchesMajority = sw.firmware === majorVersion;

      if (isKnownBad) {
        details.push({
          switchName: sw.name,
          switchIp: sw.ip,
          value: sw.firmware,
          threshold: 'Not in known-bad list',
          status: 'critical',
          message: `${sw.name} running known-bad firmware ${sw.firmware}`,
        });
      } else if (!matchesMajority && versions.size > 1) {
        details.push({
          switchName: sw.name,
          switchIp: sw.ip,
          value: sw.firmware,
          threshold: majorVersion,
          status: 'fail',
          message: `${sw.name} firmware ${sw.firmware} differs from fleet (${majorVersion})`,
        });
      } else {
        details.push({
          switchName: sw.name,
          switchIp: sw.ip,
          value: sw.firmware,
          threshold: majorVersion,
          status: 'pass',
          message: `${sw.name} firmware ${sw.firmware} matches fleet`,
        });
      }
    }

    const status = worstStatus(details.map((d) => d.status));
    let message = `All ${switches.length} switches on firmware ${majorVersion}`;
    if (versions.size > 1) message = `${versions.size} different firmware versions detected`;
    if (details.some((d) => d.status === 'critical')) message = 'Known-bad firmware detected!';

    return {
      checkName: 'firmwareConsistency',
      displayName: 'Firmware Consistency',
      status,
      message,
      details,
      runAt: now(),
    };
  }

  // -------------------------------------------------------------------------
  // 3. VLAN Consistency
  // -------------------------------------------------------------------------

  async vlanConsistency(switches: HealthCheckSwitch[]): Promise<HealthCheckResult> {
    const details: HealthCheckDetail[] = [];

    // Group switches that share ISL/trunk links
    const trunkSwitches = switches.filter((s) =>
      s.ports.some((p) => p.isTrunk)
    );

    if (trunkSwitches.length < 2) {
      return {
        checkName: 'vlanConsistency',
        displayName: 'VLAN Consistency',
        status: 'pass',
        message: 'Fewer than 2 trunk-connected switches; nothing to compare',
        details: [],
        runAt: now(),
      };
    }

    const referenceVlans = trunkSwitches[0].vlans.map((v) => v.id).sort();
    const refName = trunkSwitches[0].name;

    for (const sw of trunkSwitches) {
      const swVlans = sw.vlans.map((v) => v.id).sort();
      const hasTrunkWithNoVlans = sw.ports.some(
        (p) => p.isTrunk && p.vlans.length === 0
      );

      if (hasTrunkWithNoVlans) {
        details.push({
          switchName: sw.name,
          switchIp: sw.ip,
          value: `Trunk port with 0 VLANs`,
          threshold: '>=1 VLAN on trunk',
          status: 'critical',
          message: `${sw.name} has a trunk port with no VLANs assigned`,
        });
      } else if (JSON.stringify(swVlans) !== JSON.stringify(referenceVlans)) {
        const missing = referenceVlans.filter((v) => !swVlans.includes(v));
        const extra = swVlans.filter((v) => !referenceVlans.includes(v));
        const isMajor = missing.length > 2 || extra.length > 2;

        details.push({
          switchName: sw.name,
          switchIp: sw.ip,
          value: `VLANs: ${swVlans.join(', ')}`,
          threshold: `Reference (${refName}): ${referenceVlans.join(', ')}`,
          status: isMajor ? 'fail' : 'warning',
          message: `${sw.name} VLAN mismatch — missing: [${missing.join(', ')}], extra: [${extra.join(', ')}]`,
        });
      } else {
        details.push({
          switchName: sw.name,
          switchIp: sw.ip,
          value: `VLANs: ${swVlans.join(', ')}`,
          threshold: `Matches ${refName}`,
          status: 'pass',
          message: `${sw.name} VLANs match reference`,
        });
      }
    }

    const status = worstStatus(details.map((d) => d.status));
    const mismatches = details.filter((d) => d.status !== 'pass').length;
    let message = 'All trunk-connected switches have consistent VLANs';
    if (mismatches > 0) message = `${mismatches} switch(es) with VLAN mismatches`;

    return {
      checkName: 'vlanConsistency',
      displayName: 'VLAN Consistency',
      status,
      message,
      details,
      runAt: now(),
    };
  }

  // -------------------------------------------------------------------------
  // 4. IGMP Auditor
  // -------------------------------------------------------------------------

  async igmpAuditor(switches: HealthCheckSwitch[]): Promise<HealthCheckResult> {
    const details: HealthCheckDetail[] = [];

    // Collect all multicast VLANs and their queriers
    const vlanQueriers: Record<number, string[]> = {};

    for (const sw of switches) {
      if (sw.igmp.enabled && sw.igmp.querierEnabled) {
        for (const vid of sw.igmp.querierVlans) {
          if (!vlanQueriers[vid]) vlanQueriers[vid] = [];
          vlanQueriers[vid].push(sw.name);
        }
      }
    }

    // Also collect all VLAN IDs that need a querier (any VLAN with IGMP)
    const allMulticastVlans = new Set<number>();
    for (const sw of switches) {
      if (sw.igmp.enabled) {
        for (const vid of sw.igmp.querierVlans) {
          allMulticastVlans.add(vid);
        }
        for (const v of sw.vlans) {
          allMulticastVlans.add(v.id);
        }
      }
    }

    for (const vid of allMulticastVlans) {
      const queriers = vlanQueriers[vid] || [];
      if (queriers.length === 0) {
        details.push({
          value: `VLAN ${vid}: 0 queriers`,
          threshold: '1 querier',
          status: 'fail',
          message: `VLAN ${vid} has no IGMP querier`,
        });
      } else if (queriers.length > 1) {
        details.push({
          value: `VLAN ${vid}: ${queriers.length} queriers (${queriers.join(', ')})`,
          threshold: '1 querier',
          status: 'critical',
          message: `VLAN ${vid} has ${queriers.length} queriers — multicast storms possible`,
        });
      } else {
        details.push({
          value: `VLAN ${vid}: 1 querier (${queriers[0]})`,
          threshold: '1 querier',
          status: 'pass',
          message: `VLAN ${vid} has exactly 1 querier on ${queriers[0]}`,
        });
      }
    }

    const status = worstStatus(details.map((d) => d.status));
    const issues = details.filter((d) => d.status !== 'pass').length;
    let message = 'All multicast VLANs have exactly 1 querier';
    if (issues > 0) message = `${issues} VLAN(s) with querier issues`;

    return {
      checkName: 'igmpAuditor',
      displayName: 'IGMP Auditor',
      status,
      message,
      details,
      runAt: now(),
    };
  }

  // -------------------------------------------------------------------------
  // 5. PoE Budget
  // -------------------------------------------------------------------------

  async poeBudget(switches: HealthCheckSwitch[]): Promise<HealthCheckResult> {
    const details: HealthCheckDetail[] = [];

    for (const sw of switches) {
      if (!sw.poe) continue;

      const pct = (sw.poe.drawW / sw.poe.budgetW) * 100;
      let status: CheckStatus = 'pass';
      if (pct >= 95) status = 'critical';
      else if (pct >= 85) status = 'fail';
      else if (pct >= 70) status = 'warning';

      details.push({
        switchName: sw.name,
        switchIp: sw.ip,
        value: `${sw.poe.drawW}W / ${sw.poe.budgetW}W (${pct.toFixed(1)}%)`,
        threshold: '<70% pass, 70-85% warning, 85-95% fail, >95% critical',
        status,
        message: `${sw.name} PoE draw at ${pct.toFixed(1)}% (${sw.poe.drawW}W of ${sw.poe.budgetW}W)`,
      });
    }

    if (details.length === 0) {
      return {
        checkName: 'poeBudget',
        displayName: 'PoE Budget',
        status: 'pass',
        message: 'No PoE-capable switches in fleet',
        details: [],
        runAt: now(),
      };
    }

    const status = worstStatus(details.map((d) => d.status));
    const issues = details.filter((d) => d.status !== 'pass').length;
    let message = 'All PoE budgets within normal range';
    if (issues > 0) message = `${issues} switch(es) with PoE budget concerns`;

    return {
      checkName: 'poeBudget',
      displayName: 'PoE Budget',
      status,
      message,
      details,
      runAt: now(),
    };
  }

  // -------------------------------------------------------------------------
  // 6. RLinkX Validation
  // -------------------------------------------------------------------------

  async rlinkxValidation(switches: HealthCheckSwitch[]): Promise<HealthCheckResult> {
    const details: HealthCheckDetail[] = [];

    for (const sw of switches) {
      if (!sw.rlink || !sw.rlink.enabled) continue;

      if (sw.rlink.failedLink) {
        details.push({
          switchName: sw.name,
          switchIp: sw.ip,
          value: 'Failed link detected',
          threshold: 'Ring closed, no failures',
          status: 'critical',
          message: `${sw.name} RLinkX has a failed link on port ${sw.rlink.portA}/${sw.rlink.portB}`,
        });
      } else if (!sw.rlink.ringClosed) {
        details.push({
          switchName: sw.name,
          switchIp: sw.ip,
          value: 'Ring open',
          threshold: 'Ring closed',
          status: 'critical',
          message: `${sw.name} RLinkX ring is open — no redundancy`,
        });
      } else {
        details.push({
          switchName: sw.name,
          switchIp: sw.ip,
          value: 'Ring closed',
          threshold: 'Ring closed',
          status: 'pass',
          message: `${sw.name} RLinkX ring intact`,
        });
      }
    }

    if (details.length === 0) {
      return {
        checkName: 'rlinkxValidation',
        displayName: 'RLinkX Validation',
        status: 'pass',
        message: 'No RLinkX rings configured',
        details: [],
        runAt: now(),
      };
    }

    const status = worstStatus(details.map((d) => d.status));
    const issues = details.filter((d) => d.status !== 'pass').length;
    let message = 'All redundancy rings intact';
    if (issues > 0) message = `${issues} ring(s) with issues`;

    return {
      checkName: 'rlinkxValidation',
      displayName: 'RLinkX Validation',
      status,
      message,
      details,
      runAt: now(),
    };
  }

  // -------------------------------------------------------------------------
  // 7. Port Error Check
  // -------------------------------------------------------------------------

  async portErrorCheck(switches: HealthCheckSwitch[]): Promise<HealthCheckResult> {
    const details: HealthCheckDetail[] = [];

    for (const sw of switches) {
      for (const port of sw.ports) {
        if (!port.linkUp) continue;

        let status: CheckStatus = 'pass';
        if (port.errorsPerMin >= 50) status = 'critical';
        else if (port.errorsPerMin >= 5) status = 'fail';
        else if (port.errorsPerMin > 0) status = 'warning';

        if (status !== 'pass') {
          details.push({
            switchName: sw.name,
            switchIp: sw.ip,
            port: port.port,
            value: `${port.errorsPerMin} errors/min`,
            threshold: '0 errors/min',
            status,
            message: `${sw.name} port ${port.port} (${port.label}): ${port.errorsPerMin} errors/min`,
          });
        }
      }
    }

    if (details.length === 0) {
      details.push({
        status: 'pass',
        message: 'All active ports have zero errors',
      });
    }

    const status = worstStatus(details.map((d) => d.status));
    const errorPorts = details.filter((d) => d.status !== 'pass').length;
    let message = 'No port errors detected';
    if (errorPorts > 0) message = `${errorPorts} port(s) with non-zero error counters`;

    return {
      checkName: 'portErrorCheck',
      displayName: 'Port Error Check',
      status,
      message,
      details,
      runAt: now(),
    };
  }

  // -------------------------------------------------------------------------
  // 8. Link Speed Audit
  // -------------------------------------------------------------------------

  async linkSpeedAudit(switches: HealthCheckSwitch[]): Promise<HealthCheckResult> {
    const details: HealthCheckDetail[] = [];

    for (const sw of switches) {
      for (const port of sw.ports) {
        if (!port.linkUp) continue;

        if (port.speedMbps < port.maxSpeedMbps) {
          details.push({
            switchName: sw.name,
            switchIp: sw.ip,
            port: port.port,
            value: `${port.speedMbps} Mbps`,
            threshold: `${port.maxSpeedMbps} Mbps (port capability)`,
            status: 'warning',
            message: `${sw.name} port ${port.port} linked at ${port.speedMbps}M instead of ${port.maxSpeedMbps}M — possible bad cable`,
          });
        } else {
          details.push({
            switchName: sw.name,
            switchIp: sw.ip,
            port: port.port,
            value: `${port.speedMbps} Mbps`,
            threshold: `${port.maxSpeedMbps} Mbps`,
            status: 'pass',
            message: `${sw.name} port ${port.port} linked at expected speed`,
          });
        }
      }
    }

    const status = worstStatus(details.map((d) => d.status));
    const mismatches = details.filter((d) => d.status !== 'pass').length;
    let message = 'All links running at expected speeds';
    if (mismatches > 0) message = `${mismatches} port(s) with unexpected link speed`;

    return {
      checkName: 'linkSpeedAudit',
      displayName: 'Link Speed Audit',
      status,
      message,
      details,
      runAt: now(),
    };
  }

  // -------------------------------------------------------------------------
  // 9. Cable / SFP Check
  // -------------------------------------------------------------------------

  async cableSfpCheck(switches: HealthCheckSwitch[]): Promise<HealthCheckResult> {
    const details: HealthCheckDetail[] = [];

    for (const sw of switches) {
      if (!sw.sfpSlots) continue;

      for (const sfp of sw.sfpSlots) {
        if (!sfp.present) continue;

        if (sfp.speedGbps < sfp.slotMaxGbps) {
          details.push({
            switchName: sw.name,
            switchIp: sw.ip,
            port: sfp.slot,
            value: `${sfp.speedGbps}G SFP`,
            threshold: `${sfp.slotMaxGbps}G slot`,
            status: 'warning',
            message: `${sw.name} slot ${sfp.slot}: ${sfp.speedGbps}G SFP in ${sfp.slotMaxGbps}G capable slot`,
          });
        } else {
          details.push({
            switchName: sw.name,
            switchIp: sw.ip,
            port: sfp.slot,
            value: `${sfp.speedGbps}G SFP`,
            threshold: `${sfp.slotMaxGbps}G slot`,
            status: 'pass',
            message: `${sw.name} slot ${sfp.slot}: SFP matches slot capability`,
          });
        }
      }
    }

    if (details.length === 0) {
      return {
        checkName: 'cableSfpCheck',
        displayName: 'Cable & SFP Check',
        status: 'pass',
        message: 'No SFP modules detected',
        details: [],
        runAt: now(),
      };
    }

    const status = worstStatus(details.map((d) => d.status));
    const mismatches = details.filter((d) => d.status !== 'pass').length;
    let message = 'All SFP modules match slot capabilities';
    if (mismatches > 0) message = `${mismatches} SFP(s) below slot capability`;

    return {
      checkName: 'cableSfpCheck',
      displayName: 'Cable & SFP Check',
      status,
      message,
      details,
      runAt: now(),
    };
  }

  // -------------------------------------------------------------------------
  // 10. Temperature Check
  // -------------------------------------------------------------------------

  async temperatureCheck(switches: HealthCheckSwitch[]): Promise<HealthCheckResult> {
    const details: HealthCheckDetail[] = [];

    for (const sw of switches) {
      const temp = sw.temperature ?? 35;
      let status: CheckStatus = 'pass';
      if (temp > 60) status = 'critical';
      else if (temp > 50) status = 'fail';
      else if (temp > 40) status = 'warning';

      details.push({
        switchName: sw.name,
        switchIp: sw.ip,
        value: `${temp}\u00B0C`,
        threshold: '<40\u00B0C pass, 40-50\u00B0C warning, 50-60\u00B0C fail, >60\u00B0C critical',
        status,
        message: `${sw.name} internal temperature ${temp}\u00B0C`,
      });
    }

    const status = worstStatus(details.map((d) => d.status));
    const issues = details.filter((d) => d.status !== 'pass').length;
    let message = 'All switch temperatures normal';
    if (issues > 0) message = `${issues} switch(es) with elevated temperature`;

    return {
      checkName: 'temperatureCheck',
      displayName: 'Temperature Check',
      status,
      message,
      details,
      runAt: now(),
    };
  }

  // -------------------------------------------------------------------------
  // 11. Duplicate IP Check
  // -------------------------------------------------------------------------

  async duplicateIpCheck(switches: HealthCheckSwitch[]): Promise<HealthCheckResult> {
    const details: HealthCheckDetail[] = [];
    const ipMap: Record<string, string[]> = {};

    for (const sw of switches) {
      if (!ipMap[sw.ip]) ipMap[sw.ip] = [];
      ipMap[sw.ip].push(sw.name);
    }

    for (const [ip, names] of Object.entries(ipMap)) {
      if (names.length > 1) {
        details.push({
          switchIp: ip,
          value: `${names.length} devices: ${names.join(', ')}`,
          threshold: '1 device per IP',
          status: 'critical',
          message: `Duplicate IP ${ip} shared by ${names.join(', ')}`,
        });
      } else {
        details.push({
          switchName: names[0],
          switchIp: ip,
          value: '1 device',
          threshold: '1 device per IP',
          status: 'pass',
          message: `${ip} uniquely assigned to ${names[0]}`,
        });
      }
    }

    const status = worstStatus(details.map((d) => d.status));
    const dupes = details.filter((d) => d.status === 'critical').length;
    let message = 'No duplicate IP addresses detected';
    if (dupes > 0) message = `${dupes} duplicate IP address(es) found`;

    return {
      checkName: 'duplicateIpCheck',
      displayName: 'Duplicate IP Check',
      status,
      message,
      details,
      runAt: now(),
    };
  }
}
