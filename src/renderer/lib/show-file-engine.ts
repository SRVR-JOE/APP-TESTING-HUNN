/**
 * Show File Engine — Pure logic for show file creation, versioning,
 * diffing, pre-flight checks, drift detection, and validation.
 * No React dependencies.
 */

import type {
  ShowFile,
  ShowFileVersion,
  ShowFileDiff,
  ShowFileSwitchConfig,
  VlanConfig,
  RackGroup,
  MapConnection,
  DiscoveredSwitch,
  PreFlightCheck,
  PreFlightReport,
  DriftReport,
  DriftItem,
} from '@shared/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function uuid(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function now(): string {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Create Show File
// ---------------------------------------------------------------------------

export function createShowFile(
  name: string,
  switches: ShowFileSwitchConfig[],
  vlans: VlanConfig[],
  rackLayout?: { groups: RackGroup[]; connections: MapConnection[] },
): ShowFile {
  return {
    id: uuid(),
    name,
    version: 1,
    switches,
    vlans,
    rackLayout,
    namingAssignments: [],
    protocolPresets: [],
    createdAt: now(),
    updatedAt: now(),
    tags: [],
  };
}

// ---------------------------------------------------------------------------
// Create Version (snapshot)
// ---------------------------------------------------------------------------

export function createVersion(
  showFile: ShowFile,
  changeDescription: string,
  previousSnapshot?: ShowFile,
): ShowFileVersion {
  const diff = previousSnapshot ? diffShowFiles(previousSnapshot, showFile) : undefined;
  return {
    id: uuid(),
    showFileId: showFile.id,
    version: showFile.version,
    snapshot: structuredClone(showFile),
    changeDescription,
    createdAt: now(),
    diff,
  };
}

// ---------------------------------------------------------------------------
// Diff two Show Files
// ---------------------------------------------------------------------------

export function diffShowFiles(a: ShowFile, b: ShowFile): ShowFileDiff {
  const aSwitchIds = new Set(a.switches.map((s) => s.switchId));
  const bSwitchIds = new Set(b.switches.map((s) => s.switchId));

  const switchesAdded = b.switches
    .filter((s) => !aSwitchIds.has(s.switchId))
    .map((s) => s.switchId);

  const switchesRemoved = a.switches
    .filter((s) => !bSwitchIds.has(s.switchId))
    .map((s) => s.switchId);

  const switchesModified: { switchId: string; changes: string[] }[] = [];

  for (const bSw of b.switches) {
    if (!aSwitchIds.has(bSw.switchId)) continue;
    const aSw = a.switches.find((s) => s.switchId === bSw.switchId)!;
    const changes: string[] = [];

    if (aSw.name !== bSw.name) changes.push(`Name: "${aSw.name}" -> "${bSw.name}"`);
    if (aSw.ip !== bSw.ip) changes.push(`IP: ${aSw.ip} -> ${bSw.ip}`);
    if (aSw.role !== bSw.role) changes.push(`Role: ${aSw.role ?? 'none'} -> ${bSw.role ?? 'none'}`);

    const aVlanIds = new Set(aSw.vlans.map((v) => v.id));
    const bVlanIds = new Set(bSw.vlans.map((v) => v.id));
    const addedVlans = bSw.vlans.filter((v) => !aVlanIds.has(v.id));
    const removedVlans = aSw.vlans.filter((v) => !bVlanIds.has(v.id));
    if (addedVlans.length) changes.push(`VLANs added: ${addedVlans.map((v) => v.id).join(', ')}`);
    if (removedVlans.length) changes.push(`VLANs removed: ${removedVlans.map((v) => v.id).join(', ')}`);

    if (aSw.portConfigs.length !== bSw.portConfigs.length) {
      changes.push(`Port configs: ${aSw.portConfigs.length} -> ${bSw.portConfigs.length}`);
    } else {
      let portDiffs = 0;
      for (let i = 0; i < aSw.portConfigs.length; i++) {
        if (JSON.stringify(aSw.portConfigs[i]) !== JSON.stringify(bSw.portConfigs[i])) portDiffs++;
      }
      if (portDiffs > 0) changes.push(`${portDiffs} port config(s) changed`);
    }

    if (JSON.stringify(aSw.igmpSettings) !== JSON.stringify(bSw.igmpSettings)) {
      changes.push('IGMP settings changed');
    }
    if (JSON.stringify(aSw.poeSettings) !== JSON.stringify(bSw.poeSettings)) {
      changes.push('PoE settings changed');
    }

    if (changes.length > 0) switchesModified.push({ switchId: bSw.switchId, changes });
  }

  const aVlanIds = new Set(a.vlans.map((v) => v.id));
  const bVlanIds = new Set(b.vlans.map((v) => v.id));
  const vlansAdded = b.vlans.filter((v) => !aVlanIds.has(v.id)).map((v) => v.id);
  const vlansRemoved = a.vlans.filter((v) => !bVlanIds.has(v.id)).map((v) => v.id);

  const parts: string[] = [];
  if (switchesAdded.length) parts.push(`+${switchesAdded.length} switch(es)`);
  if (switchesRemoved.length) parts.push(`-${switchesRemoved.length} switch(es)`);
  if (switchesModified.length) parts.push(`~${switchesModified.length} switch(es) modified`);
  if (vlansAdded.length) parts.push(`+${vlansAdded.length} VLAN(s)`);
  if (vlansRemoved.length) parts.push(`-${vlansRemoved.length} VLAN(s)`);
  const summary = parts.length > 0 ? parts.join(', ') : 'No changes';

  return { switchesAdded, switchesRemoved, switchesModified, vlansAdded, vlansRemoved, summary };
}

// ---------------------------------------------------------------------------
// Pre-Flight Checks
// ---------------------------------------------------------------------------

export function runPreFlightChecks(
  showFile: ShowFile,
  liveSwitches: DiscoveredSwitch[],
): PreFlightReport {
  const checks: PreFlightCheck[] = [];
  const liveMap = new Map(liveSwitches.map((s) => [s.id, s]));

  // 1. Reachability
  for (const sw of showFile.switches) {
    const live = liveMap.get(sw.switchId);
    if (!live || !live.isOnline) {
      checks.push({
        type: 'reachability',
        status: 'fail',
        switchId: sw.switchId,
        message: `Switch "${sw.name}" (${sw.ip}) is unreachable`,
        details: live ? 'Switch is offline' : 'Switch not found on network',
      });
    } else {
      checks.push({
        type: 'reachability',
        status: 'pass',
        switchId: sw.switchId,
        message: `Switch "${sw.name}" is online`,
      });
    }
  }

  // 2. Firmware compatibility
  for (const sw of showFile.switches) {
    const live = liveMap.get(sw.switchId);
    if (!live) continue;
    const fwMajor = parseInt(live.firmware.split('.')[0], 10);
    if (isNaN(fwMajor) || fwMajor < 4) {
      checks.push({
        type: 'firmware-compat',
        status: 'warning',
        switchId: sw.switchId,
        message: `Switch "${sw.name}" firmware ${live.firmware} may be outdated`,
        details: 'Firmware version 4.x or later is recommended for full feature support',
        autoFixable: true,
      });
    } else {
      checks.push({
        type: 'firmware-compat',
        status: 'pass',
        switchId: sw.switchId,
        message: `Switch "${sw.name}" firmware ${live.firmware} is compatible`,
      });
    }
  }

  // 3. IP conflicts
  const ipMap = new Map<string, string[]>();
  for (const sw of showFile.switches) {
    const list = ipMap.get(sw.ip) ?? [];
    list.push(sw.name);
    ipMap.set(sw.ip, list);
  }
  for (const [ip, names] of ipMap) {
    if (names.length > 1) {
      checks.push({
        type: 'ip-conflict',
        status: 'fail',
        message: `IP conflict: ${ip} is assigned to ${names.join(', ')}`,
        details: 'Each switch must have a unique IP address',
      });
    }
  }
  if (![...ipMap.values()].some((v) => v.length > 1)) {
    checks.push({ type: 'ip-conflict', status: 'pass', message: 'No IP conflicts detected' });
  }

  // 4. VLAN consistency
  const allVlanIds = new Set(showFile.vlans.map((v) => v.id));
  for (const sw of showFile.switches) {
    for (const vlan of sw.vlans) {
      if (!allVlanIds.has(vlan.id)) {
        checks.push({
          type: 'vlan-consistency',
          status: 'warning',
          switchId: sw.switchId,
          message: `Switch "${sw.name}" references VLAN ${vlan.id} not defined at show file level`,
          autoFixable: true,
        });
      }
    }
  }
  if (!checks.some((c) => c.type === 'vlan-consistency')) {
    checks.push({ type: 'vlan-consistency', status: 'pass', message: 'All VLANs are consistent across switches' });
  }

  // 5. Name conflicts
  const nameMap = new Map<string, string[]>();
  for (const sw of showFile.switches) {
    const lower = sw.name.toLowerCase();
    const list = nameMap.get(lower) ?? [];
    list.push(sw.switchId);
    nameMap.set(lower, list);
  }
  for (const [name, ids] of nameMap) {
    if (ids.length > 1) {
      checks.push({
        type: 'name-conflict',
        status: 'fail',
        message: `Duplicate switch name "${name}" used by ${ids.length} switches`,
        autoFixable: true,
      });
    }
  }
  if (!checks.some((c) => c.type === 'name-conflict')) {
    checks.push({ type: 'name-conflict', status: 'pass', message: 'All switch names are unique' });
  }

  // 6. IGMP querier — ensure at least one querier per multicast VLAN
  const multicastVlans = showFile.vlans.filter((v) => v.id >= 10); // convention: VLANs >= 10 may use multicast
  for (const vlan of multicastVlans) {
    const querierExists = showFile.switches.some(
      (sw) => sw.igmpSettings?.querier && sw.vlans.some((v) => v.id === vlan.id),
    );
    if (!querierExists) {
      checks.push({
        type: 'igmp-querier',
        status: 'warning',
        message: `VLAN ${vlan.id} (${vlan.name}) has no IGMP querier assigned`,
        details: 'Multicast traffic may not be properly routed without a querier',
        autoFixable: true,
      });
    }
  }
  if (!checks.some((c) => c.type === 'igmp-querier')) {
    checks.push({ type: 'igmp-querier', status: 'pass', message: 'IGMP queriers configured for all multicast VLANs' });
  }

  // 7. PoE budget
  for (const sw of showFile.switches) {
    const live = liveMap.get(sw.switchId);
    if (!live?.poe) continue;
    const budgetW = sw.poeSettings?.budgetW ?? live.poe.budgetW;
    const drawW = live.poe.drawW;
    const ratio = drawW / budgetW;
    if (ratio > 0.95) {
      checks.push({
        type: 'poe-budget',
        status: 'fail',
        switchId: sw.switchId,
        message: `Switch "${sw.name}" PoE budget critically exceeded (${drawW}W / ${budgetW}W)`,
      });
    } else if (ratio > 0.80) {
      checks.push({
        type: 'poe-budget',
        status: 'warning',
        switchId: sw.switchId,
        message: `Switch "${sw.name}" PoE budget at ${Math.round(ratio * 100)}% (${drawW}W / ${budgetW}W)`,
      });
    } else {
      checks.push({
        type: 'poe-budget',
        status: 'pass',
        switchId: sw.switchId,
        message: `Switch "${sw.name}" PoE budget OK (${drawW}W / ${budgetW}W)`,
      });
    }
  }

  // 8. Redundancy paths — check that more than one trunk connection exists between switches
  const trunkSwitches = showFile.switches.filter((sw) =>
    sw.portConfigs.some((p) => p.taggedVlans && p.taggedVlans.length > 0),
  );
  if (trunkSwitches.length > 1 && showFile.rackLayout?.connections) {
    const connectionCount = showFile.rackLayout.connections.length;
    if (connectionCount < trunkSwitches.length) {
      checks.push({
        type: 'redundancy-path',
        status: 'warning',
        message: `Only ${connectionCount} inter-switch connections for ${trunkSwitches.length} trunk switches — consider adding redundancy`,
        details: 'A single link failure could isolate switches',
      });
    } else {
      checks.push({
        type: 'redundancy-path',
        status: 'pass',
        message: 'Redundancy paths appear adequate',
      });
    }
  } else if (!showFile.rackLayout?.connections?.length) {
    checks.push({
      type: 'redundancy-path',
      status: 'skipped',
      message: 'No inter-switch connections defined — redundancy check skipped',
    });
  }

  // Determine overall status
  const hasFail = checks.some((c) => c.status === 'fail');
  const hasWarning = checks.some((c) => c.status === 'warning');
  const overallStatus = hasFail ? 'fail' : hasWarning ? 'warning' : 'pass';
  const canDeploy = !hasFail;

  return {
    id: uuid(),
    showFileId: showFile.id,
    timestamp: now(),
    checks,
    overallStatus,
    canDeploy,
  };
}

// ---------------------------------------------------------------------------
// Drift Detection
// ---------------------------------------------------------------------------

export function detectDrift(
  showFile: ShowFile,
  liveSwitches: DiscoveredSwitch[],
): DriftReport {
  const drifts: DriftItem[] = [];
  const liveMap = new Map(liveSwitches.map((s) => [s.id, s]));

  for (const sw of showFile.switches) {
    const live = liveMap.get(sw.switchId);
    if (!live) {
      drifts.push({
        switchId: sw.switchId,
        switchName: sw.name,
        field: 'presence',
        expected: 'online',
        actual: 'not found',
        severity: 'critical',
      });
      continue;
    }

    // IP drift
    if (sw.ip !== live.ip) {
      drifts.push({
        switchId: sw.switchId,
        switchName: sw.name,
        field: 'IP Address',
        expected: sw.ip,
        actual: live.ip,
        severity: 'critical',
      });
    }

    // Name drift
    if (sw.name !== live.name) {
      drifts.push({
        switchId: sw.switchId,
        switchName: sw.name,
        field: 'Name',
        expected: sw.name,
        actual: live.name,
        severity: 'warning',
      });
    }

    // VLAN drift — compare expected vs actual groups
    if (live.groups) {
      const expectedVlanIds = new Set(sw.vlans.map((v) => v.id));
      const actualVlanIds = new Set(live.groups.map((g) => g.vlanId));

      for (const vlanId of expectedVlanIds) {
        if (!actualVlanIds.has(vlanId)) {
          const vlanName = sw.vlans.find((v) => v.id === vlanId)?.name ?? `VLAN ${vlanId}`;
          drifts.push({
            switchId: sw.switchId,
            switchName: sw.name,
            field: `VLAN ${vlanId}`,
            expected: `${vlanName} present`,
            actual: 'missing',
            severity: 'critical',
          });
        }
      }

      for (const vlanId of actualVlanIds) {
        if (!expectedVlanIds.has(vlanId) && vlanId !== 1) {
          drifts.push({
            switchId: sw.switchId,
            switchName: sw.name,
            field: `VLAN ${vlanId}`,
            expected: 'not configured',
            actual: 'present on switch',
            severity: 'warning',
          });
        }
      }
    }

    // IGMP querier drift
    if (sw.igmpSettings && live.groups) {
      const expectedQuerier = sw.igmpSettings.querier;
      const actualQuerier = live.groups.some((g) => g.igmpQuerier);
      if (expectedQuerier !== actualQuerier) {
        drifts.push({
          switchId: sw.switchId,
          switchName: sw.name,
          field: 'IGMP Querier',
          expected: expectedQuerier ? 'enabled' : 'disabled',
          actual: actualQuerier ? 'enabled' : 'disabled',
          severity: 'warning',
        });
      }
    }

    // Port count drift
    if (sw.portConfigs.length > 0 && live.ports) {
      for (const expectedPort of sw.portConfigs) {
        const actualPort = live.ports.find((p) => p.port === expectedPort.port);
        if (!actualPort) continue;

        // VLAN assignment drift
        if (expectedPort.vlan && actualPort.vlans && !actualPort.vlans.includes(expectedPort.vlan)) {
          drifts.push({
            switchId: sw.switchId,
            switchName: sw.name,
            field: `Port ${expectedPort.port} VLAN`,
            expected: String(expectedPort.vlan),
            actual: actualPort.vlans.join(', ') || 'none',
            severity: 'warning',
          });
        }

        // PoE drift
        if (expectedPort.poeEnabled !== undefined && actualPort.poeEnabled !== undefined) {
          if (expectedPort.poeEnabled !== actualPort.poeEnabled) {
            drifts.push({
              switchId: sw.switchId,
              switchName: sw.name,
              field: `Port ${expectedPort.port} PoE`,
              expected: expectedPort.poeEnabled ? 'enabled' : 'disabled',
              actual: actualPort.poeEnabled ? 'enabled' : 'disabled',
              severity: 'info',
            });
          }
        }
      }
    }

    // Online status drift
    if (!live.isOnline) {
      drifts.push({
        switchId: sw.switchId,
        switchName: sw.name,
        field: 'Status',
        expected: 'online',
        actual: 'offline',
        severity: 'critical',
      });
    }
  }

  return {
    id: uuid(),
    showFileId: showFile.id,
    timestamp: now(),
    drifts,
    totalDrifts: drifts.length,
  };
}

// ---------------------------------------------------------------------------
// Validate Show File
// ---------------------------------------------------------------------------

export function validateShowFile(showFile: ShowFile): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!showFile.name || showFile.name.trim().length === 0) {
    errors.push('Show file name is required');
  }

  if (showFile.switches.length === 0) {
    errors.push('Show file must contain at least one switch');
  }

  // Unique switch IDs
  const switchIds = showFile.switches.map((s) => s.switchId);
  const uniqueIds = new Set(switchIds);
  if (uniqueIds.size !== switchIds.length) {
    errors.push('Duplicate switch IDs detected');
  }

  // Unique IPs
  const ips = showFile.switches.map((s) => s.ip);
  const uniqueIps = new Set(ips);
  if (uniqueIps.size !== ips.length) {
    errors.push('Duplicate IP addresses detected');
  }

  // Unique names
  const names = showFile.switches.map((s) => s.name.toLowerCase());
  const uniqueNames = new Set(names);
  if (uniqueNames.size !== names.length) {
    errors.push('Duplicate switch names detected');
  }

  // Valid IPs
  const ipRegex = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
  for (const sw of showFile.switches) {
    if (!ipRegex.test(sw.ip)) {
      errors.push(`Invalid IP address "${sw.ip}" on switch "${sw.name}"`);
    }
  }

  // VLAN IDs valid range
  for (const vlan of showFile.vlans) {
    if (vlan.id < 1 || vlan.id > 4094) {
      errors.push(`VLAN ID ${vlan.id} is out of valid range (1-4094)`);
    }
    if (!vlan.name || vlan.name.trim().length === 0) {
      errors.push(`VLAN ${vlan.id} has no name`);
    }
  }

  // Switches have MACs
  for (const sw of showFile.switches) {
    if (!sw.mac || sw.mac.trim().length === 0) {
      errors.push(`Switch "${sw.name}" has no MAC address`);
    }
  }

  return { valid: errors.length === 0, errors };
}
