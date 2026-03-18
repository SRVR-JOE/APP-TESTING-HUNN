// =============================================================================
// Luminex Configurator — Troubleshooting: Quick Compare
// =============================================================================

import type { HealthCheckSwitch as DiscoveredSwitch } from './health-checks';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CompareResult {
  switchA: { name: string; ip: string; model: string };
  switchB: { name: string; ip: string; model: string };
  sections: CompareSection[];
}

export interface CompareSection {
  name: string; // "System", "Groups", "Ports", "IGMP", "PoE"
  differences: CompareDiff[];
  isIdentical: boolean;
}

export interface CompareDiff {
  field: string;
  valueA: string;
  valueB: string;
  match: boolean;
}

// ---------------------------------------------------------------------------
// QuickCompare
// ---------------------------------------------------------------------------

export class QuickCompare {
  private switchRegistry: Map<string, DiscoveredSwitch> = new Map();

  /**
   * Register discovered switches so they can be looked up by IP.
   */
  registerSwitches(switches: DiscoveredSwitch[]): void {
    for (const sw of switches) {
      this.switchRegistry.set(sw.ip, sw);
    }
  }

  /**
   * Compare two switches by IP address. Returns a structured diff
   * grouped into sections.
   */
  async compare(switchAIp: string, switchBIp: string): Promise<CompareResult> {
    const swA = this.switchRegistry.get(switchAIp);
    const swB = this.switchRegistry.get(switchBIp);

    if (!swA) throw new Error(`Switch ${switchAIp} not found in registry`);
    if (!swB) throw new Error(`Switch ${switchBIp} not found in registry`);

    const sections: CompareSection[] = [
      this.compareSystem(swA, swB),
      this.compareGroups(swA, swB),
      this.comparePorts(swA, swB),
      this.compareIgmp(swA, swB),
      this.comparePoe(swA, swB),
    ];

    return {
      switchA: { name: swA.name, ip: swA.ip, model: swA.model },
      switchB: { name: swB.name, ip: swB.ip, model: swB.model },
      sections,
    };
  }

  // -------------------------------------------------------------------------
  // Section comparators
  // -------------------------------------------------------------------------

  private compareSystem(a: DiscoveredSwitch, b: DiscoveredSwitch): CompareSection {
    const diffs: CompareDiff[] = [
      { field: 'Model', valueA: a.model, valueB: b.model, match: a.model === b.model },
      { field: 'Firmware', valueA: a.firmware, valueB: b.firmware, match: a.firmware === b.firmware },
      { field: 'MAC Address', valueA: a.mac, valueB: b.mac, match: a.mac === b.mac },
      { field: 'IP Address', valueA: a.ip, valueB: b.ip, match: a.ip === b.ip },
      {
        field: 'Temperature',
        valueA: a.temperature != null ? `${a.temperature}\u00B0C` : 'N/A',
        valueB: b.temperature != null ? `${b.temperature}\u00B0C` : 'N/A',
        match: a.temperature === b.temperature,
      },
      {
        field: 'Total Ports',
        valueA: String(a.ports.length),
        valueB: String(b.ports.length),
        match: a.ports.length === b.ports.length,
      },
    ];

    return {
      name: 'System',
      differences: diffs,
      isIdentical: diffs.every((d) => d.match),
    };
  }

  private compareGroups(a: DiscoveredSwitch, b: DiscoveredSwitch): CompareSection {
    const allVlanIds = new Set([
      ...a.vlans.map((v: any) => v.id),
      ...b.vlans.map((v: any) => v.id),
    ]);

    const diffs: CompareDiff[] = [];

    for (const vid of [...allVlanIds].sort((x, y) => x - y)) {
      const vlanA = a.vlans.find((v: any) => v.id === vid);
      const vlanB = b.vlans.find((v: any) => v.id === vid);

      diffs.push({
        field: `VLAN ${vid} — Name`,
        valueA: vlanA?.name ?? '(not defined)',
        valueB: vlanB?.name ?? '(not defined)',
        match: vlanA?.name === vlanB?.name,
      });

      diffs.push({
        field: `VLAN ${vid} — Tagged`,
        valueA: vlanA ? vlanA.tagged.join(', ') || 'none' : '(not defined)',
        valueB: vlanB ? vlanB.tagged.join(', ') || 'none' : '(not defined)',
        match: JSON.stringify(vlanA?.tagged) === JSON.stringify(vlanB?.tagged),
      });

      diffs.push({
        field: `VLAN ${vid} — Untagged`,
        valueA: vlanA ? vlanA.untagged.join(', ') || 'none' : '(not defined)',
        valueB: vlanB ? vlanB.untagged.join(', ') || 'none' : '(not defined)',
        match: JSON.stringify(vlanA?.untagged) === JSON.stringify(vlanB?.untagged),
      });
    }

    return {
      name: 'Groups',
      differences: diffs,
      isIdentical: diffs.every((d) => d.match),
    };
  }

  private comparePorts(a: DiscoveredSwitch, b: DiscoveredSwitch): CompareSection {
    const maxPorts = Math.max(a.ports.length, b.ports.length);
    const diffs: CompareDiff[] = [];

    for (let i = 0; i < maxPorts; i++) {
      const pA = a.ports[i];
      const pB = b.ports[i];

      if (!pA || !pB) {
        diffs.push({
          field: `Port ${i + 1}`,
          valueA: pA ? `${pA.label} (${pA.linkUp ? 'up' : 'down'})` : '(absent)',
          valueB: pB ? `${pB.label} (${pB.linkUp ? 'up' : 'down'})` : '(absent)',
          match: false,
        });
        continue;
      }

      const speedMatch = pA.speedMbps === pB.speedMbps;
      const vlanMatch = JSON.stringify(pA.vlans) === JSON.stringify(pB.vlans);
      const trunkMatch = pA.isTrunk === pB.isTrunk;

      if (!speedMatch || !vlanMatch || !trunkMatch) {
        diffs.push({
          field: `Port ${i + 1} — Speed`,
          valueA: `${pA.speedMbps} Mbps`,
          valueB: `${pB.speedMbps} Mbps`,
          match: speedMatch,
        });
        diffs.push({
          field: `Port ${i + 1} — VLANs`,
          valueA: pA.vlans.join(', ') || 'none',
          valueB: pB.vlans.join(', ') || 'none',
          match: vlanMatch,
        });
        diffs.push({
          field: `Port ${i + 1} — Trunk`,
          valueA: pA.isTrunk ? 'Yes' : 'No',
          valueB: pB.isTrunk ? 'Yes' : 'No',
          match: trunkMatch,
        });
      } else {
        diffs.push({
          field: `Port ${i + 1}`,
          valueA: `${pA.speedMbps}M, VLANs: ${pA.vlans.join(',') || 'none'}`,
          valueB: `${pB.speedMbps}M, VLANs: ${pB.vlans.join(',') || 'none'}`,
          match: true,
        });
      }
    }

    return {
      name: 'Ports',
      differences: diffs,
      isIdentical: diffs.every((d) => d.match),
    };
  }

  private compareIgmp(a: DiscoveredSwitch, b: DiscoveredSwitch): CompareSection {
    const diffs: CompareDiff[] = [
      {
        field: 'IGMP Enabled',
        valueA: a.igmp.enabled ? 'Yes' : 'No',
        valueB: b.igmp.enabled ? 'Yes' : 'No',
        match: a.igmp.enabled === b.igmp.enabled,
      },
      {
        field: 'Querier Enabled',
        valueA: a.igmp.querierEnabled ? 'Yes' : 'No',
        valueB: b.igmp.querierEnabled ? 'Yes' : 'No',
        match: a.igmp.querierEnabled === b.igmp.querierEnabled,
      },
      {
        field: 'Querier VLANs',
        valueA: a.igmp.querierVlans.join(', ') || 'none',
        valueB: b.igmp.querierVlans.join(', ') || 'none',
        match: JSON.stringify(a.igmp.querierVlans) === JSON.stringify(b.igmp.querierVlans),
      },
    ];

    return {
      name: 'IGMP',
      differences: diffs,
      isIdentical: diffs.every((d) => d.match),
    };
  }

  private comparePoe(a: DiscoveredSwitch, b: DiscoveredSwitch): CompareSection {
    const diffs: CompareDiff[] = [];

    if (!a.poe && !b.poe) {
      diffs.push({
        field: 'PoE Support',
        valueA: 'Not available',
        valueB: 'Not available',
        match: true,
      });
    } else {
      diffs.push({
        field: 'PoE Budget',
        valueA: a.poe ? `${a.poe.budgetW}W` : 'N/A',
        valueB: b.poe ? `${b.poe.budgetW}W` : 'N/A',
        match: a.poe?.budgetW === b.poe?.budgetW,
      });
      diffs.push({
        field: 'PoE Draw',
        valueA: a.poe ? `${a.poe.drawW}W` : 'N/A',
        valueB: b.poe ? `${b.poe.drawW}W` : 'N/A',
        match: a.poe?.drawW === b.poe?.drawW,
      });
      diffs.push({
        field: 'PoE Utilization',
        valueA: a.poe ? `${((a.poe.drawW / a.poe.budgetW) * 100).toFixed(1)}%` : 'N/A',
        valueB: b.poe ? `${((b.poe.drawW / b.poe.budgetW) * 100).toFixed(1)}%` : 'N/A',
        match:
          a.poe && b.poe
            ? Math.abs(a.poe.drawW / a.poe.budgetW - b.poe.drawW / b.poe.budgetW) < 0.01
            : a.poe === b.poe,
      });
    }

    return {
      name: 'PoE',
      differences: diffs,
      isIdentical: diffs.every((d) => d.match),
    };
  }
}
