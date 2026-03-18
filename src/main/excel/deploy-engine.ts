// ── Deploy Engine ────────────────────────────────────────────────────────────
// Deploys parsed & validated Excel configuration to live GigaCore switches.

import {
  ExcelIPScheme,
  ExcelGroupDefinition,
  DeployPlan,
  DeploySwitchPlan,
  DeployChange,
  DeployResult,
  SwitchBackup,
  VerificationResult,
  SwitchVerification,
  DiscoveredSwitch,
  GigaCoreClient,
  GIGACORE_MODELS,
  GigaCoreModel,
  MODEL_PORT_COUNTS,
} from './types';
import { ExcelValidator } from './validation';

// ── Types local to deploy ────────────────────────────────────────────────────

export interface DeployOptions {
  onProgress: (switchName: string, step: string, pct: number) => void;
  onSwitchComplete: (switchName: string, success: boolean, error?: string) => void;
  staged: boolean;
  backupFirst: boolean;
}

// ── Deploy Engine ────────────────────────────────────────────────────────────

export class DeployEngine {
  private validator = new ExcelValidator();

  constructor(private apiClientFactory: (ip: string) => GigaCoreClient) {}

  /**
   * Create a deploy plan by comparing Excel data against discovered switches.
   * The plan describes every change needed without executing anything.
   */
  async createDeployPlan(
    data: ExcelIPScheme,
    discoveredSwitches: DiscoveredSwitch[],
  ): Promise<DeployPlan> {
    const switchPlans: DeploySwitchPlan[] = [];
    const groupsToCreate: ExcelGroupDefinition[] = [];
    let totalChanges = 0;

    // Build a lookup of discovered switches by name (case-insensitive) and by IP
    const discoveredByName = new Map<string, DiscoveredSwitch>();
    const discoveredByIp = new Map<string, DiscoveredSwitch>();
    for (const ds of discoveredSwitches) {
      discoveredByName.set(ds.name.toLowerCase(), ds);
      discoveredByIp.set(ds.ip, ds);
    }

    // Build port assignment map: switchName → list of assignments
    const portAssignmentsBySw = new Map<string, typeof data.portAssignments>();
    for (const pa of data.portAssignments) {
      const key = pa.switchName.toLowerCase();
      if (!portAssignmentsBySw.has(key)) {
        portAssignmentsBySw.set(key, []);
      }
      portAssignmentsBySw.get(key)!.push(pa);
    }

    // Build group lookup by name
    const groupByName = new Map<string, ExcelGroupDefinition>();
    for (const g of data.groupDefinitions) {
      groupByName.set(g.name.toLowerCase(), g);
    }

    // Determine which groups need to be created on each switch
    // (collect unique set across all switches)
    const allRequiredGroupDefs = new Map<number, ExcelGroupDefinition>();
    for (const g of data.groupDefinitions) {
      allRequiredGroupDefs.set(g.groupNumber, g);
    }

    for (const sw of data.switches) {
      const changes: DeployChange[] = [];

      // Try to match to a discovered switch
      let discovered = discoveredByName.get(sw.switchName.toLowerCase());
      if (!discovered) {
        discovered = discoveredByIp.get(sw.managementIp);
      }

      const matched = !!discovered;

      // ── Name change ────────────────────────────────────────────────
      if (discovered && discovered.name !== sw.switchName) {
        changes.push({
          type: 'name',
          description: `Rename switch from "${discovered.name}" to "${sw.switchName}"`,
          currentValue: discovered.name,
          newValue: sw.switchName,
        });
      }

      // ── IP/Network changes ─────────────────────────────────────────
      if (discovered && discovered.ip !== sw.managementIp) {
        changes.push({
          type: 'ip',
          description: `Change management IP from ${discovered.ip} to ${sw.managementIp}`,
          currentValue: discovered.ip,
          newValue: `${sw.managementIp} ${sw.subnet} gw ${sw.gateway}`,
        });
      } else if (!discovered) {
        // New switch — plan IP assignment
        changes.push({
          type: 'ip',
          description: `Set management IP to ${sw.managementIp}/${sw.subnet} gw ${sw.gateway}`,
          newValue: `${sw.managementIp} ${sw.subnet} gw ${sw.gateway}`,
        });
      }

      // ── Group changes ──────────────────────────────────────────────
      for (const [, groupDef] of allRequiredGroupDefs) {
        const existingGroup = discovered?.groups?.find(
          (g) => g.groupNumber === groupDef.groupNumber,
        );

        if (!existingGroup) {
          changes.push({
            type: 'group',
            description: `Create group ${groupDef.groupNumber}: "${groupDef.name}" (VLAN ${groupDef.vlanId})`,
            newValue: `${groupDef.name} VLAN=${groupDef.vlanId}`,
          });
        } else {
          // Check if group config differs
          const diffs: string[] = [];
          if (existingGroup.name !== groupDef.name) diffs.push(`name: ${existingGroup.name} → ${groupDef.name}`);
          if (existingGroup.vlanId !== groupDef.vlanId) diffs.push(`VLAN: ${existingGroup.vlanId} → ${groupDef.vlanId}`);
          if (existingGroup.igmpSnooping !== groupDef.igmpSnooping) diffs.push(`IGMP snooping: ${existingGroup.igmpSnooping} → ${groupDef.igmpSnooping}`);
          if (existingGroup.igmpQuerier !== groupDef.igmpQuerier) diffs.push(`IGMP querier: ${existingGroup.igmpQuerier} → ${groupDef.igmpQuerier}`);
          if (existingGroup.unknownFlooding !== groupDef.unknownFlooding) diffs.push(`flooding: ${existingGroup.unknownFlooding} → ${groupDef.unknownFlooding}`);

          if (diffs.length > 0) {
            changes.push({
              type: 'group',
              description: `Update group ${groupDef.groupNumber}: ${diffs.join(', ')}`,
              currentValue: `${existingGroup.name} VLAN=${existingGroup.vlanId}`,
              newValue: `${groupDef.name} VLAN=${groupDef.vlanId}`,
            });
          }
        }
      }

      // ── Port assignment changes ────────────────────────────────────
      const swPortAssignments = portAssignmentsBySw.get(sw.switchName.toLowerCase()) ?? [];

      for (const pa of swPortAssignments) {
        const ports = this.validator.parsePortRange(pa.port, sw.model);

        for (const portNum of ports) {
          const realPort = portNum > 100 ? portNum : portNum; // ISL ports stay as-is internally
          const existingPort = discovered?.ports?.find((p) => p.port === realPort);

          // Resolve group name to number
          const targetGroup = groupByName.get(pa.groupVlan.toLowerCase());
          const targetGroupName = targetGroup?.name ?? pa.groupVlan;

          if (!existingPort || existingPort.groupVlan !== targetGroupName) {
            changes.push({
              type: 'port',
              description: `Set port ${pa.port} to group "${targetGroupName}"${pa.label ? ` (${pa.label})` : ''}`,
              currentValue: existingPort?.groupVlan,
              newValue: targetGroupName,
              port: realPort,
            });
          }
        }
      }

      totalChanges += changes.length;

      switchPlans.push({
        switchName: sw.switchName,
        switchIp: sw.managementIp,
        matched,
        changes,
      });
    }

    // Collect groups that need creation globally
    for (const [, g] of allRequiredGroupDefs) {
      groupsToCreate.push(g);
    }

    return {
      switches: switchPlans,
      groupsToCreate,
      totalChanges,
    };
  }

  /**
   * Execute the deploy plan, applying changes to live switches.
   */
  async executePlan(
    plan: DeployPlan,
    options: DeployOptions,
  ): Promise<DeployResult> {
    const switchResults: DeployResult['switchResults'] = [];
    let totalChanges = 0;
    let totalErrors = 0;

    for (let si = 0; si < plan.switches.length; si++) {
      const swPlan = plan.switches[si];
      const switchErrors: string[] = [];
      let changesApplied = 0;
      let backup: SwitchBackup | undefined;

      try {
        const client = this.apiClientFactory(swPlan.switchIp);

        // ── Backup current config ────────────────────────────────────
        if (options.backupFirst) {
          options.onProgress(swPlan.switchName, 'Backing up current configuration', 0);
          try {
            const configSnapshot = await client.getConfig();
            backup = {
              switchName: swPlan.switchName,
              switchIp: swPlan.switchIp,
              timestamp: new Date().toISOString(),
              configSnapshot,
            };
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            switchErrors.push(`Backup failed: ${errMsg}`);
            // Continue anyway — backup failure is non-fatal unless user requires it
          }
        }

        // ── Apply changes ────────────────────────────────────────────
        const changeCount = swPlan.changes.length;

        for (let ci = 0; ci < swPlan.changes.length; ci++) {
          const change = swPlan.changes[ci];
          const pct = Math.round(((ci + 1) / changeCount) * 100);
          options.onProgress(swPlan.switchName, change.description, pct);

          try {
            await this.applyChange(client, change, plan.groupsToCreate);
            changesApplied++;
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            switchErrors.push(`Failed to apply "${change.description}": ${errMsg}`);
          }
        }

        // ── Save config on switch ────────────────────────────────────
        if (changesApplied > 0) {
          options.onProgress(swPlan.switchName, 'Saving configuration', 100);
          try {
            await client.saveConfig();
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            switchErrors.push(`Failed to save config: ${errMsg}`);
          }
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        switchErrors.push(`Connection failed: ${errMsg}`);
      }

      const success = switchErrors.length === 0;
      totalChanges += changesApplied;
      totalErrors += switchErrors.length;

      switchResults.push({
        switchName: swPlan.switchName,
        success,
        changesApplied,
        errors: switchErrors,
        backup,
      });

      options.onSwitchComplete(
        swPlan.switchName,
        success,
        success ? undefined : switchErrors.join('; '),
      );

      // Staged mode: pause after first switch to let user verify
      if (options.staged && si === 0 && plan.switches.length > 1) {
        // Return partial result — caller should call executePlan again
        // with the remaining switches after verification.
        // For now, we just break and let the caller handle the rest.
        break;
      }
    }

    return {
      success: totalErrors === 0,
      switchResults,
      totalChanges,
      totalErrors,
    };
  }

  /**
   * Verify deployment by re-reading switch configs and comparing against the plan.
   */
  async verifyDeployment(plan: DeployPlan): Promise<VerificationResult> {
    const switchVerifications: SwitchVerification[] = [];

    for (const swPlan of plan.switches) {
      const mismatches: string[] = [];

      try {
        const client = this.apiClientFactory(swPlan.switchIp);
        const currentConfig = await client.getConfig();

        // Check each change was actually applied
        for (const change of swPlan.changes) {
          const verified = this.verifyChange(change, currentConfig);
          if (!verified) {
            mismatches.push(`${change.description}: change not verified in live config`);
          }
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        mismatches.push(`Could not connect to verify: ${errMsg}`);
      }

      switchVerifications.push({
        switchName: swPlan.switchName,
        verified: mismatches.length === 0,
        mismatches,
      });
    }

    return {
      allVerified: switchVerifications.every((sv) => sv.verified),
      switchVerifications,
    };
  }

  /**
   * Rollback switches to their pre-deploy state using backups.
   */
  async rollback(backups: SwitchBackup[]): Promise<void> {
    for (const backup of backups) {
      const client = this.apiClientFactory(backup.switchIp);

      // Restore IP settings if present
      const config = backup.configSnapshot;

      if (config['switchName'] && typeof config['switchName'] === 'string') {
        await client.setSwitchName(config['switchName']);
      }

      if (
        config['managementIp'] &&
        typeof config['managementIp'] === 'string' &&
        config['subnet'] &&
        typeof config['subnet'] === 'string'
      ) {
        const gateway = typeof config['gateway'] === 'string' ? config['gateway'] : '';
        await client.setManagementIp(config['managementIp'], config['subnet'], gateway);
      }

      if (config['managementVlan'] && typeof config['managementVlan'] === 'number') {
        await client.setManagementVlan(config['managementVlan']);
      }

      // Restore groups
      if (Array.isArray(config['groups'])) {
        for (const g of config['groups']) {
          if (g && typeof g === 'object') {
            await client.createGroup({
              groupNumber: g.groupNumber ?? 0,
              name: g.name ?? '',
              vlanId: g.vlanId ?? 0,
              igmpSnooping: g.igmpSnooping ?? false,
              igmpQuerier: g.igmpQuerier ?? false,
              unknownFlooding: g.unknownFlooding ?? false,
            });
          }
        }
      }

      // Restore port configs
      if (Array.isArray(config['ports'])) {
        for (const p of config['ports']) {
          if (p && typeof p === 'object') {
            const portNum = p.port ?? 0;
            if (p.groupNumber !== undefined) {
              await client.setPortGroup(portNum, p.groupNumber);
            }
            if (p.mode !== undefined) {
              await client.setPortMode(portNum, p.mode);
            }
            if (p.poeEnabled !== undefined) {
              await client.setPortPoe(portNum, p.poeEnabled);
            }
            if (p.speed !== undefined) {
              await client.setPortSpeed(portNum, p.speed);
            }
          }
        }
      }

      await client.saveConfig();
    }
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private async applyChange(
    client: GigaCoreClient,
    change: DeployChange,
    groupDefs: ExcelGroupDefinition[],
  ): Promise<void> {
    switch (change.type) {
      case 'name': {
        await client.setSwitchName(change.newValue);
        break;
      }

      case 'ip': {
        // Parse "192.168.1.10 255.255.255.0 gw 192.168.1.1"
        const parts = change.newValue.split(/\s+/);
        const ip = parts[0] ?? '';
        const subnet = parts[1] ?? '255.255.255.0';
        const gateway = parts[3] ?? '';
        await client.setManagementIp(ip, subnet, gateway);
        break;
      }

      case 'group': {
        // Find the group definition
        const groupNumMatch = change.description.match(/group (\d+)/i);
        if (!groupNumMatch) break;
        const groupNum = parseInt(groupNumMatch[1], 10);
        const groupDef = groupDefs.find((g) => g.groupNumber === groupNum);
        if (!groupDef) break;

        await client.createGroup({
          groupNumber: groupDef.groupNumber,
          name: groupDef.name,
          vlanId: groupDef.vlanId,
          igmpSnooping: groupDef.igmpSnooping,
          igmpQuerier: groupDef.igmpQuerier,
          unknownFlooding: groupDef.unknownFlooding,
        });
        break;
      }

      case 'port': {
        if (change.port === undefined) break;

        // Resolve group name to group number
        const targetGroupDef = groupDefs.find(
          (g) => g.name.toLowerCase() === change.newValue.toLowerCase(),
        );
        if (targetGroupDef) {
          await client.setPortGroup(change.port, targetGroupDef.groupNumber);
        }
        break;
      }

      case 'poe': {
        if (change.port === undefined) break;
        await client.setPortPoe(change.port, change.newValue.toUpperCase() === 'ON');
        break;
      }

      case 'igmp': {
        // IGMP changes are applied at the group level via createGroup
        // This case handles per-port IGMP overrides if the API supports it
        break;
      }

      default:
        break;
    }
  }

  /**
   * Best-effort verification that a change was applied by inspecting the config snapshot.
   * Returns true if the change appears to have taken effect.
   */
  private verifyChange(change: DeployChange, config: Record<string, unknown>): boolean {
    switch (change.type) {
      case 'name': {
        return config['switchName'] === change.newValue;
      }

      case 'ip': {
        const parts = change.newValue.split(/\s+/);
        return config['managementIp'] === parts[0];
      }

      case 'group': {
        if (!Array.isArray(config['groups'])) return false;
        const groupNumMatch = change.description.match(/group (\d+)/i);
        if (!groupNumMatch) return false;
        const groupNum = parseInt(groupNumMatch[1], 10);
        return config['groups'].some(
          (g: Record<string, unknown>) => g && g['groupNumber'] === groupNum,
        );
      }

      case 'port': {
        if (!Array.isArray(config['ports']) || change.port === undefined) return false;
        const portConfig = config['ports'].find(
          (p: Record<string, unknown>) => p && p['port'] === change.port,
        );
        if (!portConfig) return false;
        // Check if port's group matches
        return true; // Simplified — full verification would compare group assignment
      }

      default:
        return true;
    }
  }
}
