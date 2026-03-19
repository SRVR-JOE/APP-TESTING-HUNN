// =============================================================================
// Luminex Configurator — IPC Handlers (Main Process)
// =============================================================================
//
// Wires every renderer-invocable channel to real backend logic.
// Each handler follows the pattern:
//   1. Log the call
//   2. Validate inputs
//   3. Delegate to the appropriate service
//   4. Return { success, data } or { success, error }
//

import { ipcMain, dialog, shell } from 'electron';
import {
  databaseManager,
  switchRepo,
  deviceRepo,
  eventLogger,
  portStats as portStatsCollector,
  logExporter,
  rackMapRepo,
  profileRepo,
} from './database';
import { DiscoveryManager, SubnetScanner } from './discovery';
import { ExcelParser } from './excel/excel-parser';
import { TemplateGenerator } from './excel/template-generator';
import { HealthCheckEngine } from './troubleshoot/health-checks';
import { PingTool } from './troubleshoot/ping-tool';
import { QuickCompare } from './troubleshoot/quick-compare';
import { GigaCoreClient, BatchExecutor } from './api';
import type { LogFilters } from '../shared/types';
import type { RackLayoutData } from './database/rack-map-repository';
import type { ShowProfile } from './database/profile-repository';
import fs from 'fs';

// ── Singleton service instances ─────────────────────────────────────────────

const discoveryManager = new DiscoveryManager();
const subnetScanner = new SubnetScanner();
const excelParser = new ExcelParser();
const templateGenerator = new TemplateGenerator();
const healthCheckEngine = new HealthCheckEngine();
const pingTool = new PingTool();
const quickCompare = new QuickCompare();

// ── Module-level state ──────────────────────────────────────────────────────

/** Active batch executor reference — stored so that batch:abort can cancel it. */
let activeBatchExecutor: BatchExecutor | null = null;

/** Custom subnets added by the user for discovery scans. */
const customSubnets: string[] = [];

// ── Helpers ─────────────────────────────────────────────────────────────────

function ok<T>(data: T) {
  return { success: true as const, data };
}

function fail(error: string) {
  return { success: false as const, error };
}

/** Basic string validation — must be a non-empty string after trimming. */
function isNonEmptyString(val: unknown): val is string {
  return typeof val === 'string' && val.trim().length > 0;
}

/** Sanitize a string by trimming and removing control characters. */
function sanitize(val: string): string {
  // eslint-disable-next-line no-control-regex
  return val.trim().replace(/[\x00-\x1F\x7F]/g, '');
}

/** Validate an IPv4 address or CIDR notation. */
function isValidIpOrCidr(val: string): boolean {
  // Accept x.x.x.x or x.x.x.x/nn
  return /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/.test(val);
}

/** Validate a hostname or IP for ping (prevent command injection). */
function isValidHost(val: string): boolean {
  return /^[\w.\-:]+$/.test(val);
}

// =============================================================================
// Register all IPC handlers
// =============================================================================

export function registerIpcHandlers(): void {
  // ─── Discovery ──────────────────────────────────────────────────────────────

  ipcMain.handle('discovery:scanSubnet', async (_event, subnet: string) => {
    console.log(`[IPC] discovery:scanSubnet called with: ${subnet}`);
    try {
      if (!isNonEmptyString(subnet)) {
        return fail('subnet must be a non-empty string');
      }
      const cleaned = sanitize(subnet);
      if (!isValidIpOrCidr(cleaned)) {
        return fail(`Invalid subnet format: "${cleaned}". Expected CIDR notation like 192.168.1.0/24`);
      }

      const result = await discoveryManager.performFullScan([cleaned]);

      // Persist discovered switches to the database
      for (const sw of result.switches) {
        switchRepo.upsertSwitch(sw);
      }

      return ok(result.switches);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[IPC] discovery:scanSubnet error:', message);
      return fail(message);
    }
  });

  ipcMain.handle('discovery:getDiscoveredSwitches', async () => {
    console.log('[IPC] discovery:getDiscoveredSwitches called');
    try {
      // Return in-memory discovered switches merged with DB records.
      // Prefer live data from the discovery manager, fall back to DB.
      const liveSwitches = discoveryManager.getSwitches();
      if (liveSwitches.length > 0) {
        return ok(liveSwitches);
      }
      const dbSwitches = switchRepo.getAllSwitches();
      return ok(dbSwitches);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[IPC] discovery:getDiscoveredSwitches error:', message);
      return fail(message);
    }
  });

  ipcMain.handle('discovery:getDiscoveredDevices', async () => {
    console.log('[IPC] discovery:getDiscoveredDevices called');
    try {
      // Prefer live in-memory data, fall back to DB
      const liveDevices = discoveryManager.getDevices();
      if (liveDevices.length > 0) {
        return ok(liveDevices);
      }
      const dbDevices = deviceRepo.getAllDevices();
      return ok(dbDevices);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[IPC] discovery:getDiscoveredDevices error:', message);
      return fail(message);
    }
  });

  ipcMain.handle('discovery:startPolling', async (_event, intervalMs: number) => {
    console.log(`[IPC] discovery:startPolling called with interval: ${intervalMs}ms`);
    try {
      if (typeof intervalMs !== 'number' || intervalMs < 5000) {
        return fail('intervalMs must be a number >= 5000 (5 seconds minimum)');
      }

      discoveryManager.startPolling(intervalMs);
      return ok(undefined);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[IPC] discovery:startPolling error:', message);
      return fail(message);
    }
  });

  ipcMain.handle('discovery:stopPolling', async () => {
    console.log('[IPC] discovery:stopPolling called');
    try {
      discoveryManager.stopPolling();
      return ok(undefined);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[IPC] discovery:stopPolling error:', message);
      return fail(message);
    }
  });

  ipcMain.handle('discovery:getLocalSubnets', async () => {
    console.log('[IPC] discovery:getLocalSubnets called');
    try {
      const localSubnets = subnetScanner.getLocalSubnets();
      // Return just the CIDR strings, which is what the renderer expects
      const cidrs = localSubnets.map((s) => s.cidr);
      return ok(cidrs);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[IPC] discovery:getLocalSubnets error:', message);
      return fail(message);
    }
  });

  // ─── Utility ───────────────────────────────────────────────────────────────

  ipcMain.handle('utility:openWebUI', async (_event, ip: string) => {
    console.log(`[IPC] utility:openWebUI called: ${ip}`);
    try {
      if (!isNonEmptyString(ip)) {
        return fail('ip must be a non-empty string');
      }
      const cleanIp = sanitize(ip);
      if (!isValidHost(cleanIp)) {
        return fail(`Invalid IP format: "${cleanIp}"`);
      }
      await shell.openExternal(`http://${cleanIp}`);
      return ok(undefined);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[IPC] utility:openWebUI error:', message);
      return fail(message);
    }
  });

  ipcMain.handle('utility:exportCSV', async () => {
    console.log('[IPC] utility:exportCSV called');
    try {
      const result = await dialog.showSaveDialog({
        title: 'Export Event Log as CSV',
        defaultPath: `luminex-event-log-${new Date().toISOString().slice(0, 10)}.csv`,
        filters: [{ name: 'CSV Files', extensions: ['csv'] }],
      });

      if (result.canceled || !result.filePath) {
        return ok(''); // User cancelled
      }

      await logExporter.exportToCSV({}, result.filePath);
      return ok(result.filePath);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[IPC] utility:exportCSV error:', message);
      return fail(message);
    }
  });

  // ─── Database / Log ─────────────────────────────────────────────────────────

  ipcMain.handle('database:queryEventLog', async (_event, filters?: Record<string, unknown>) => {
    console.log('[IPC] database:queryEventLog called', filters);
    try {
      const logFilters: LogFilters = {};

      if (filters) {
        if (Array.isArray(filters.category)) {
          logFilters.category = filters.category.filter(
            (c): c is string => typeof c === 'string',
          ) as LogFilters['category'];
        }
        if (Array.isArray(filters.severity)) {
          logFilters.severity = filters.severity.filter(
            (s): s is string => typeof s === 'string',
          ) as LogFilters['severity'];
        }
        if (typeof filters.switchMac === 'string') {
          logFilters.switchMac = sanitize(filters.switchMac);
        }
        if (typeof filters.startTime === 'string') {
          logFilters.startTime = filters.startTime;
        }
        if (typeof filters.endTime === 'string') {
          logFilters.endTime = filters.endTime;
        }
        if (typeof filters.search === 'string') {
          logFilters.search = sanitize(filters.search);
        }
        if (typeof filters.limit === 'number') {
          logFilters.limit = Math.min(Math.max(1, filters.limit), 10000);
        }
        if (typeof filters.offset === 'number') {
          logFilters.offset = Math.max(0, filters.offset);
        }
      }

      const result = eventLogger.query(logFilters);
      return ok(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[IPC] database:queryEventLog error:', message);
      return fail(message);
    }
  });

  ipcMain.handle('database:getPortStats', async (_event, switchMac: string, port: number) => {
    console.log(`[IPC] database:getPortStats called: mac=${switchMac}, port=${port}`);
    try {
      if (!isNonEmptyString(switchMac)) {
        return fail('switchMac must be a non-empty string');
      }
      if (typeof port !== 'number' || port < 0) {
        return fail('port must be a non-negative number');
      }

      const cleanMac = sanitize(switchMac);

      // Default to last 24 hours if no time range specified
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const timeRange = {
        start: oneDayAgo.toISOString(),
        end: now.toISOString(),
      };

      const stats = portStatsCollector.getStats(cleanMac, port, timeRange);
      return ok(stats);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[IPC] database:getPortStats error:', message);
      return fail(message);
    }
  });

  // ─── Troubleshoot ───────────────────────────────────────────────────────────

  ipcMain.handle('troubleshoot:runHealthChecks', async (_event, switchIds: string[]) => {
    console.log('[IPC] troubleshoot:runHealthChecks called', switchIds);
    try {
      if (!Array.isArray(switchIds) || switchIds.length === 0) {
        return fail('switchIds must be a non-empty array of strings');
      }

      // Validate each ID is a string
      for (const id of switchIds) {
        if (typeof id !== 'string') {
          return fail('Each switchId must be a string');
        }
      }

      // Gather switch data from discovery manager (in-memory) or DB
      const liveSwitches = discoveryManager.getSwitches();
      const targetSwitches = liveSwitches.filter((sw) => switchIds.includes(sw.id));

      // Build HealthCheckSwitch objects from discovered data
      // The HealthCheckEngine expects enriched switch objects; we map from
      // DiscoveredSwitch to the HealthCheckSwitch shape as best we can.
      const healthSwitches = targetSwitches.map((sw) => ({
        name: sw.name,
        ip: sw.ip,
        model: sw.model,
        firmware: sw.firmware,
        mac: sw.mac,
        ports: (sw.ports ?? []).map((p) => ({
          port: p.port,
          label: p.label,
          linkUp: p.linkUp,
          speedMbps: p.speedMbps,
          maxSpeedMbps: p.maxSpeedMbps,
          errorsPerMin: p.errorsPerMin,
          isTrunk: p.isTrunk,
          vlans: p.vlans,
        })),
        vlans: (sw.groups ?? []).map((g) => ({
          id: g.vlanId,
          name: g.name,
          tagged: [] as number[],
          untagged: [] as number[],
        })),
        igmp: {
          enabled: (sw.groups ?? []).some((g) => g.igmpSnooping),
          querierEnabled: (sw.groups ?? []).some((g) => g.igmpQuerier),
          querierVlans: (sw.groups ?? [])
            .filter((g) => g.igmpQuerier)
            .map((g) => g.vlanId),
        },
        poe: sw.poe ? { budgetW: sw.poe.budgetW, drawW: sw.poe.drawW, ports: [] } : undefined,
        temperature: sw.temperature,
      }));

      if (healthSwitches.length === 0) {
        return fail(
          'None of the specified switch IDs were found in the discovery cache. Run a scan first.',
        );
      }

      const results = await healthCheckEngine.runAll(healthSwitches);
      return ok(results);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[IPC] troubleshoot:runHealthChecks error:', message);
      return fail(message);
    }
  });

  ipcMain.handle('troubleshoot:pingHost', async (_event, host: string) => {
    console.log(`[IPC] troubleshoot:pingHost called: ${host}`);
    try {
      if (!isNonEmptyString(host)) {
        return fail('host must be a non-empty string');
      }
      const cleanHost = sanitize(host);
      if (!isValidHost(cleanHost)) {
        return fail(`Invalid host format: "${cleanHost}". Only alphanumeric, dots, hyphens, and colons are allowed.`);
      }

      const result = await pingTool.pingOnce(cleanHost);
      return ok({
        reachable: result.alive,
        latencyMs: result.latencyMs,
        ttl: result.ttl,
        timestamp: result.timestamp,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[IPC] troubleshoot:pingHost error:', message);
      return fail(message);
    }
  });

  ipcMain.handle(
    'troubleshoot:compareSwitches',
    async (_event, switchIdA: string, switchIdB: string) => {
      console.log(`[IPC] troubleshoot:compareSwitches called: ${switchIdA} vs ${switchIdB}`);
      try {
        if (!isNonEmptyString(switchIdA) || !isNonEmptyString(switchIdB)) {
          return fail('Both switchIdA and switchIdB must be non-empty strings');
        }

        // Gather switch data from discovery manager (in-memory) or DB
        const liveSwitches = discoveryManager.getSwitches();
        const swA = liveSwitches.find((sw) => sw.id === switchIdA || sw.ip === switchIdA);
        const swB = liveSwitches.find((sw) => sw.id === switchIdB || sw.ip === switchIdB);

        if (!swA) return fail(`Switch "${switchIdA}" not found in discovery cache.`);
        if (!swB) return fail(`Switch "${switchIdB}" not found in discovery cache.`);

        // Build HealthCheckSwitch objects and register them with QuickCompare
        const toHealthSwitch = (sw: typeof swA) => ({
          name: sw.name,
          ip: sw.ip,
          model: sw.model,
          firmware: sw.firmware,
          mac: sw.mac,
          ports: (sw.ports ?? []).map((p) => ({
            port: p.port,
            label: p.label,
            linkUp: p.linkUp,
            speedMbps: p.speedMbps,
            maxSpeedMbps: p.maxSpeedMbps,
            errorsPerMin: p.errorsPerMin,
            isTrunk: p.isTrunk,
            vlans: p.vlans,
          })),
          vlans: (sw.groups ?? []).map((g) => ({
            id: g.vlanId,
            name: g.name,
            tagged: [] as number[],
            untagged: [] as number[],
          })),
          igmp: {
            enabled: (sw.groups ?? []).some((g) => g.igmpSnooping),
            querierEnabled: (sw.groups ?? []).some((g) => g.igmpQuerier),
            querierVlans: (sw.groups ?? [])
              .filter((g) => g.igmpQuerier)
              .map((g) => g.vlanId),
          },
          poe: sw.poe ? { budgetW: sw.poe.budgetW, drawW: sw.poe.drawW, ports: [] } : undefined,
          temperature: sw.temperature,
        });

        quickCompare.registerSwitches([toHealthSwitch(swA), toHealthSwitch(swB)]);
        const compareResult = await quickCompare.compare(swA.ip, swB.ip);
        return ok(compareResult);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[IPC] troubleshoot:compareSwitches error:', message);
        return fail(message);
      }
    },
  );

  ipcMain.handle('troubleshoot:resetCounters', async (_event, switchId: string) => {
    console.log(`[IPC] troubleshoot:resetCounters called: ${switchId}`);
    try {
      if (!isNonEmptyString(switchId)) {
        return fail('switchId must be a non-empty string');
      }

      const cleanId = sanitize(switchId);

      // Clear the port_stats table in the database for this switch MAC
      const db = databaseManager.getDb();
      const result = db.prepare('DELETE FROM port_stats WHERE switch_mac = ?').run(cleanId);

      return ok({ deleted: result.changes });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[IPC] troubleshoot:resetCounters error:', message);
      return fail(message);
    }
  });

  // ─── Excel ──────────────────────────────────────────────────────────────────

  ipcMain.handle('excel:parseExcelFile', async (_event, filePath: string) => {
    console.log(`[IPC] excel:parseExcelFile called: ${filePath}`);
    try {
      if (!isNonEmptyString(filePath)) {
        return fail('filePath must be a non-empty string');
      }
      const cleanPath = sanitize(filePath);
      if (!cleanPath.toLowerCase().endsWith('.xlsx')) {
        return fail('File must be an .xlsx Excel file');
      }

      // Detect what kind of template this is
      const format = await excelParser.detectFormat(cleanPath);

      if (format === 'ip-scheme') {
        const data = await excelParser.parseIPScheme(cleanPath);
        return ok({ format: 'ip-scheme', ...data });
      } else if (format === 'profile') {
        const profiles = await excelParser.parseProfiles(cleanPath);
        return ok({ format: 'profile', profiles });
      } else {
        return fail(
          'Unrecognized Excel template format. Expected an IP Scheme or Profile template.',
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[IPC] excel:parseExcelFile error:', message);
      return fail(message);
    }
  });

  ipcMain.handle('excel:generateTemplate', async (_event, model: string) => {
    console.log(`[IPC] excel:generateTemplate called: ${model}`);
    try {
      if (!isNonEmptyString(model)) {
        return fail('model must be a non-empty string');
      }
      const cleanModel = sanitize(model);

      // Ask the user where to save via a system save dialog
      const result = await dialog.showSaveDialog({
        title: 'Save Excel Template',
        defaultPath: `Luminex-${cleanModel}-Template.xlsx`,
        filters: [{ name: 'Excel Files', extensions: ['xlsx'] }],
      });

      if (result.canceled || !result.filePath) {
        return ok(''); // User cancelled — not an error
      }

      const outputPath = result.filePath;

      // Generate the appropriate template type based on the model string
      if (cleanModel.toLowerCase() === 'profile') {
        await templateGenerator.generateProfileTemplate(outputPath);
      } else {
        await templateGenerator.generateIPSchemeTemplate(outputPath);
      }

      return ok(outputPath);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[IPC] excel:generateTemplate error:', message);
      return fail(message);
    }
  });

  // ─── Config (stubs — requires GigaCore API write access) ────────────────────

  ipcMain.handle(
    'config:applyProfile',
    async (_event, switchId: string, profileId: string) => {
      console.log(`[IPC] config:applyProfile called: switch=${switchId}, profile=${profileId}`);
      try {
        if (!isNonEmptyString(switchId)) {
          return fail('switchId must be a non-empty string');
        }
        if (!isNonEmptyString(profileId)) {
          return fail('profileId must be a non-empty string');
        }

        // Find the switch
        const liveSwitches = discoveryManager.getSwitches();
        const sw = liveSwitches.find((s) => s.id === switchId) ?? switchRepo.getSwitchById(switchId);
        if (!sw) {
          return fail(`Switch "${switchId}" not found. Run a scan first.`);
        }

        const client = new GigaCoreClient(sw.ip, {
          generation: sw.generation,
        });

        // Look up the profile from the database
        const profile = profileRepo.getProfile(sanitize(profileId));

        if (profile && profile.configJson) {
          // Profile has detailed config — apply groups, ports, IGMP individually
          const config = profile.configJson as Record<string, unknown>;

          if (Array.isArray(config.groups)) {
            for (const group of config.groups) {
              await client.setGroup(group.id, {
                name: group.name,
                vlanId: group.vlanId,
                color: group.color,
                igmpSnooping: group.igmpSnooping,
                igmpQuerier: group.igmpQuerier,
                unknownFlooding: group.unknownFlooding,
              });
            }
          }

          if (Array.isArray(config.ports)) {
            for (const port of config.ports) {
              if (port.groupId !== undefined) {
                await client.setPortGroup(port.port, port.groupId);
              }
              if (port.label) {
                await client.setPortLabel(port.port, port.label);
              }
            }
          }

          if (Array.isArray(config.igmp)) {
            for (const igmpEntry of config.igmp) {
              if (igmpEntry.snooping !== undefined) {
                await client.setIgmpSnooping(igmpEntry.groupId, igmpEntry.snooping);
              }
              if (igmpEntry.querier !== undefined) {
                await client.setIgmpQuerier(igmpEntry.groupId, igmpEntry.querier);
              }
            }
          }
        } else {
          // No detailed config — treat profileId as a numeric profile slot and recall it
          const slot = parseInt(profileId, 10);
          if (isNaN(slot) || slot < 0) {
            return fail(`Profile "${profileId}" not found in database and is not a valid slot number.`);
          }
          await client.recallProfile(slot);
        }

        eventLogger.log('config', 'info', `Profile "${profileId}" applied to switch ${sw.name || sw.ip}`, {
          switchMac: sw.mac,
          switchName: sw.name,
        });

        return ok({ applied: true, switchId, profileId });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[IPC] config:applyProfile error:', message);
        return fail(message);
      }
    },
  );

  ipcMain.handle('config:backupSwitch', async (_event, switchId: string) => {
    console.log(`[IPC] config:backupSwitch called: ${switchId}`);
    try {
      if (!isNonEmptyString(switchId)) {
        return fail('switchId must be a non-empty string');
      }

      // Find the switch to get its IP
      const liveSwitches = discoveryManager.getSwitches();
      const sw = liveSwitches.find((s) => s.id === switchId) ?? switchRepo.getSwitchById(switchId);
      if (!sw) {
        return fail(`Switch "${switchId}" not found. Run a scan first.`);
      }

      // Fetch configuration data from the switch via the GigaCore client
      const client = new GigaCoreClient(sw.ip, {
        generation: sw.generation,
      });

      const [systemInfo, ports, groups] = await Promise.all([
        client.getSystemInfo(),
        client.getPorts(),
        client.getGroups(),
      ]);

      const backupData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        switch: {
          name: systemInfo.name,
          model: systemInfo.model,
          firmware: systemInfo.firmware,
          mac: systemInfo.mac,
          serial: systemInfo.serial,
          generation: systemInfo.generation,
        },
        ports,
        groups,
      };

      // Ask the user where to save
      const result = await dialog.showSaveDialog({
        title: 'Save Switch Backup',
        defaultPath: `${sw.name || sw.ip}-backup-${new Date().toISOString().slice(0, 10)}.json`,
        filters: [{ name: 'JSON Files', extensions: ['json'] }],
      });

      if (result.canceled || !result.filePath) {
        return ok(''); // User cancelled
      }

      fs.writeFileSync(result.filePath, JSON.stringify(backupData, null, 2), 'utf-8');
      return ok(result.filePath);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[IPC] config:backupSwitch error:', message);
      return fail(message);
    }
  });

  ipcMain.handle(
    'config:restoreSwitch',
    async (_event, switchId: string, backupPath?: string) => {
      console.log(`[IPC] config:restoreSwitch called: switch=${switchId}, path=${backupPath}`);
      try {
        if (!isNonEmptyString(switchId)) {
          return fail('switchId must be a non-empty string');
        }

        // Find the switch to get its IP
        const liveSwitches = discoveryManager.getSwitches();
        const sw = liveSwitches.find((s) => s.id === switchId) ?? switchRepo.getSwitchById(switchId);
        if (!sw) {
          return fail(`Switch "${switchId}" not found. Run a scan first.`);
        }

        // If no path provided, ask the user to pick a backup file
        let filePath = backupPath;
        if (!filePath || !isNonEmptyString(filePath)) {
          const result = await dialog.showOpenDialog({
            title: 'Select Switch Backup File',
            filters: [{ name: 'JSON Files', extensions: ['json'] }],
            properties: ['openFile'],
          });

          if (result.canceled || result.filePaths.length === 0) {
            return ok(''); // User cancelled
          }
          filePath = result.filePaths[0];
        }

        // Read and parse the backup file
        const raw = fs.readFileSync(filePath, 'utf-8');
        let backupData: any;
        try {
          backupData = JSON.parse(raw);
        } catch {
          return fail('Invalid backup file: not valid JSON.');
        }

        if (!backupData || typeof backupData !== 'object') {
          return fail('Invalid backup file: root must be an object.');
        }

        const client = new GigaCoreClient(sw.ip, {
          generation: sw.generation,
        });

        // Restore groups
        if (Array.isArray(backupData.groups)) {
          for (const group of backupData.groups) {
            await client.setGroup(group.id, {
              name: group.name,
              vlanId: group.vlanId,
              color: group.color,
              igmpSnooping: group.igmpSnooping,
              igmpQuerier: group.igmpQuerier,
              unknownFlooding: group.unknownFlooding,
            });
          }
        }

        // Restore port configurations
        if (Array.isArray(backupData.ports)) {
          for (const port of backupData.ports) {
            if (port.label) {
              await client.setPortLabel(port.port, port.label);
            }
            if (port.groupId !== undefined && port.vlanMode !== 'trunk') {
              await client.setPortGroup(port.port, port.groupId);
            }
            if (port.vlanMode === 'trunk' && Array.isArray(port.trunkGroups)) {
              await client.setPortTrunk(port.port, port.trunkGroups);
            }
          }
        }

        return ok({ restored: true, filePath });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[IPC] config:restoreSwitch error:', message);
        return fail(message);
      }
    },
  );

  // ─── Batch Operations ─────────────────────────────────────────────────────

  ipcMain.handle('batch:execute', async (event, operations: unknown[], options?: unknown) => {
    console.log(`[IPC] batch:execute called with ${Array.isArray(operations) ? operations.length : 0} operations`);
    try {
      if (!Array.isArray(operations)) {
        return fail('operations must be an array');
      }
      if (operations.length === 0) {
        return fail('operations array must not be empty');
      }

      // Validate each operation has required fields
      for (let i = 0; i < operations.length; i++) {
        const op = operations[i] as Record<string, unknown>;
        if (!op || typeof op !== 'object') {
          return fail(`Operation at index ${i} must be an object`);
        }
        if (!isNonEmptyString(op.switchIp)) {
          return fail(`Operation at index ${i} must have a non-empty switchIp string`);
        }
        if (!isNonEmptyString(op.operation)) {
          return fail(`Operation at index ${i} must have a non-empty operation string`);
        }
      }

      // Create the executor and store it so abort can reference it
      const executor = new BatchExecutor({ concurrency: 2 });
      activeBatchExecutor = executor;

      const onProgress = (progress: { total: number; completed: number; failed: number; current: string }) => {
        try {
          // Parse switch IP from the current string (e.g. "port.setGroup on 10.0.0.5")
          const parts = progress.current.split(' on ');
          const parsedIp = parts.length > 1 ? parts[parts.length - 1] : '';

          event.sender.send('event:batchProgress', {
            switchIp: parsedIp,
            status: 'in-progress',
            progress: progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0,
            currentOperation: progress.current,
            overallProgress: progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0,
            total: progress.total,
            completed: progress.completed,
            failed: progress.failed,
          });
        } catch {
          // Renderer may have been destroyed
        }
      };

      const results = await executor.execute(
        operations as { switchIp: string; operation: string; params: Record<string, unknown> }[],
        {
          backupFirst: true,
          stopOnError: false,
          onProgress,
        },
      );

      activeBatchExecutor = null;

      // Send per-switch final status events
      for (const result of results) {
        try {
          event.sender.send('event:batchProgress', {
            switchIp: result.switchIp,
            status: result.success ? 'success' : 'failed',
            progress: 100,
            currentOperation: result.success ? 'Complete' : result.error,
            error: result.error,
            overallProgress: 100,
            total: results.length,
            completed: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
          });
        } catch {
          // Renderer may have been destroyed
        }
      }

      eventLogger.log('config', 'info', `Batch execution completed: ${results.filter((r) => r.success).length}/${results.length} succeeded`);

      return ok(results);
    } catch (err) {
      activeBatchExecutor = null;
      const message = err instanceof Error ? err.message : String(err);
      console.error('[IPC] batch:execute error:', message);
      return fail(message);
    }
  });

  ipcMain.handle('batch:abort', async () => {
    console.log('[IPC] batch:abort called');
    try {
      if (!activeBatchExecutor) {
        return fail('No batch operation is currently running');
      }

      activeBatchExecutor.abort();
      eventLogger.log('config', 'warning', 'Batch operation aborted by user');
      return ok({ aborted: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[IPC] batch:abort error:', message);
      return fail(message);
    }
  });

  // ─── Batch Rollback ──────────────────────────────────────────────────────

  ipcMain.handle('batch:rollback', async (_event, failedResults: unknown[]) => {
    console.log('[IPC] batch:rollback called');
    try {
      if (!Array.isArray(failedResults)) {
        return fail('failedResults must be an array');
      }
      if (failedResults.length === 0) {
        return fail('failedResults array must not be empty');
      }

      // Validate each result has the required fields
      for (let i = 0; i < failedResults.length; i++) {
        const r = failedResults[i] as Record<string, unknown>;
        if (!r || typeof r !== 'object') {
          return fail(`Result at index ${i} must be an object`);
        }
        if (!isNonEmptyString(r.switchIp)) {
          return fail(`Result at index ${i} must have a non-empty switchIp string`);
        }
        if (!isNonEmptyString(r.operation)) {
          return fail(`Result at index ${i} must have a non-empty operation string`);
        }
      }

      const typedResults = failedResults as {
        switchIp: string;
        operation: string;
        success: boolean;
        error?: string;
        rollbackData?: unknown;
      }[];

      // Use a fresh BatchExecutor for the rollback
      let rolledBack = 0;
      let rollbackFailed = 0;

      const executor = new BatchExecutor({ concurrency: 2 });
      executor.on('rollback:success', () => { rolledBack++; });
      executor.on('rollback:error', () => { rollbackFailed++; });

      await executor.rollback(typedResults);

      eventLogger.log('config', 'info', `Batch rollback completed: ${rolledBack} rolled back, ${rollbackFailed} failed`);

      return ok({ rolledBack, failed: rollbackFailed });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[IPC] batch:rollback error:', message);
      return fail(message);
    }
  });

  // ─── Deploy Show File ─────────────────────────────────────────────────────

  ipcMain.handle('deploy:showFile', async (event, showFileConfig: unknown) => {
    console.log('[IPC] deploy:showFile called');
    try {
      if (!showFileConfig || typeof showFileConfig !== 'object') {
        return fail('showFileConfig must be a valid object');
      }

      const config = showFileConfig as Record<string, unknown>;
      if (!Array.isArray(config.switches)) {
        return fail('showFileConfig.switches must be an array');
      }

      const switches = config.switches as Record<string, unknown>[];
      if (switches.length === 0) {
        return fail('showFileConfig.switches must not be empty');
      }

      const liveSwitches = discoveryManager.getSwitches();
      const results: Array<{ switchId: string; success: boolean; error?: string }> = [];
      const backups: Array<{ switchId: string; backup: unknown }> = [];

      for (let i = 0; i < switches.length; i++) {
        const swConfig = switches[i];
        const switchId = String(swConfig.id || swConfig.mac || '');

        try {
          event.sender.send('event:deployProgress', {
            switchId,
            status: 'starting',
            message: `Deploying switch ${i + 1} of ${switches.length}`,
          });

          // Find the live switch by ID or MAC
          const sw = liveSwitches.find(
            (s) => s.id === switchId || s.mac === switchId,
          ) ?? switchRepo.getSwitchById(switchId);

          if (!sw) {
            results.push({ switchId, success: false, error: `Switch "${switchId}" not found` });
            event.sender.send('event:deployProgress', {
              switchId,
              status: 'error',
              message: `Switch "${switchId}" not found`,
            });
            continue;
          }

          const client = new GigaCoreClient(sw.ip, {
            generation: sw.generation,
          });

          // Backup current config before modifying
          event.sender.send('event:deployProgress', { switchId, status: 'backup', message: 'Backing up current config' });
          const [backupSysInfo, backupPorts, backupGroups] = await Promise.all([
            client.getSystemInfo(),
            client.getPorts(),
            client.getGroups(),
          ]);
          backups.push({
            switchId,
            backup: {
              system: backupSysInfo,
              ports: backupPorts,
              groups: backupGroups,
            },
          });

          // 1. Set system name
          if (isNonEmptyString(swConfig.name)) {
            event.sender.send('event:deployProgress', { switchId, status: 'configuring', message: 'Setting system name' });
            await client.setSystemName(swConfig.name as string);
          }

          // 2. Set IP configuration
          if (swConfig.ipConfig && typeof swConfig.ipConfig === 'object') {
            event.sender.send('event:deployProgress', { switchId, status: 'configuring', message: 'Setting IP config' });
            await client.setIpConfig(swConfig.ipConfig as Record<string, unknown>);
          }

          // 3. Configure groups
          if (Array.isArray(swConfig.groups)) {
            event.sender.send('event:deployProgress', { switchId, status: 'configuring', message: 'Configuring groups' });
            for (const group of swConfig.groups as Record<string, unknown>[]) {
              await client.setGroup(group.id as number, {
                name: group.name as string,
                vlanId: group.vlanId as number,
                color: group.color as string,
                igmpSnooping: group.igmpSnooping as boolean,
                igmpQuerier: group.igmpQuerier as boolean,
                unknownFlooding: group.unknownFlooding as boolean,
              });
            }
          }

          // 4. Configure ports
          if (Array.isArray(swConfig.ports)) {
            event.sender.send('event:deployProgress', { switchId, status: 'configuring', message: 'Configuring ports' });
            for (const port of swConfig.ports as Record<string, unknown>[]) {
              if (port.groupId !== undefined) {
                await client.setPortGroup(port.port as number, port.groupId as number);
              }
            }
          }

          // 5. Configure IGMP
          if (Array.isArray(swConfig.igmp)) {
            event.sender.send('event:deployProgress', { switchId, status: 'configuring', message: 'Configuring IGMP' });
            for (const igmpEntry of swConfig.igmp as Record<string, unknown>[]) {
              if (igmpEntry.snooping !== undefined) {
                await client.setIgmpSnooping(igmpEntry.groupId as number, igmpEntry.snooping as boolean);
              }
              if (igmpEntry.querier !== undefined) {
                await client.setIgmpQuerier(igmpEntry.groupId as number, igmpEntry.querier as boolean);
              }
            }
          }

          // 6. Configure PoE
          if (Array.isArray(swConfig.poe)) {
            event.sender.send('event:deployProgress', { switchId, status: 'configuring', message: 'Configuring PoE' });
            for (const poeEntry of swConfig.poe as Record<string, unknown>[]) {
              await client.setPortPoe(poeEntry.port as number, poeEntry.enabled as boolean);
            }
          }

          results.push({ switchId, success: true });
          event.sender.send('event:deployProgress', { switchId, status: 'complete', message: 'Deployment complete' });

          eventLogger.log('config', 'info', `Show file deployed to switch ${sw.name || sw.ip}`, {
            switchMac: sw.mac,
            switchName: sw.name,
          });
        } catch (swErr) {
          const swMessage = swErr instanceof Error ? swErr.message : String(swErr);
          results.push({ switchId, success: false, error: swMessage });
          event.sender.send('event:deployProgress', { switchId, status: 'error', message: swMessage });
          console.error(`[IPC] deploy:showFile error for switch ${switchId}:`, swMessage);
        }
      }

      return ok({ results, backups });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[IPC] deploy:showFile error:', message);
      return fail(message);
    }
  });

  // ─── Firmware Upload ──────────────────────────────────────────────────────

  ipcMain.handle('config:uploadFirmware', async (event, payload: unknown) => {
    console.log('[IPC] config:uploadFirmware called');
    try {
      if (!payload || typeof payload !== 'object') {
        return fail('payload must be an object with switchId and firmwarePath');
      }

      const { switchId, firmwarePath } = payload as Record<string, unknown>;

      if (!isNonEmptyString(switchId)) {
        return fail('switchId must be a non-empty string');
      }
      if (!isNonEmptyString(firmwarePath)) {
        return fail('firmwarePath must be a non-empty string');
      }

      const cleanPath = sanitize(firmwarePath as string);

      // Verify the firmware file exists
      if (!fs.existsSync(cleanPath)) {
        return fail(`Firmware file not found: "${cleanPath}"`);
      }

      // Find the switch
      const liveSwitches = discoveryManager.getSwitches();
      const sw = liveSwitches.find((s) => s.id === switchId) ?? switchRepo.getSwitchById(switchId as string);
      if (!sw) {
        return fail(`Switch "${switchId}" not found. Run a scan first.`);
      }

      const client = new GigaCoreClient(sw.ip, {
        generation: sw.generation,
      });

      // Read firmware file
      const firmwareBuffer = fs.readFileSync(cleanPath);

      const onProgress = (percent: number) => {
        try {
          event.sender.send('firmware:progress', { switchId, percent });
        } catch {
          // Renderer may have been destroyed
        }
      };

      await client.uploadFirmware(firmwareBuffer, onProgress);

      eventLogger.log('config', 'info', `Firmware uploaded to switch ${sw.name || sw.ip}`, {
        switchMac: sw.mac,
        switchName: sw.name,
      });

      return ok({ success: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[IPC] config:uploadFirmware error:', message);
      return fail(message);
    }
  });

  // ─── Custom Subnet Discovery ──────────────────────────────────────────────

  ipcMain.handle('discovery:addCustomSubnet', async (_event, subnet: string) => {
    console.log(`[IPC] discovery:addCustomSubnet called: ${subnet}`);
    try {
      if (!isNonEmptyString(subnet)) {
        return fail('subnet must be a non-empty string');
      }
      const cleaned = sanitize(subnet);
      if (!isValidIpOrCidr(cleaned)) {
        return fail(`Invalid subnet format: "${cleaned}". Expected CIDR notation like 192.168.1.0/24`);
      }

      // Avoid duplicates
      if (!customSubnets.includes(cleaned)) {
        customSubnets.push(cleaned);
      }

      return ok({ subnets: [...customSubnets] });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[IPC] discovery:addCustomSubnet error:', message);
      return fail(message);
    }
  });

  // ─── Rack Map (stubs — data model ready, UI persistence pending) ────────────

  ipcMain.handle('rackMap:getRackGroups', async () => {
    console.log('[IPC] rackMap:getRackGroups called');
    try {
      const groups = rackMapRepo.getAllGroups();
      return ok(groups);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[IPC] rackMap:getRackGroups error:', message);
      return fail(message);
    }
  });

  ipcMain.handle('rackMap:saveRackLayout', async (_event, layout: unknown) => {
    console.log('[IPC] rackMap:saveRackLayout called');
    try {
      if (!layout || typeof layout !== 'object') {
        return fail('layout must be a valid object');
      }

      rackMapRepo.saveLayout(layout as RackLayoutData);
      return ok(undefined);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[IPC] rackMap:saveRackLayout error:', message);
      return fail(message);
    }
  });

  ipcMain.handle('rackMap:exportLayoutJson', async () => {
    console.log('[IPC] rackMap:exportLayoutJson called');
    try {
      const json = rackMapRepo.exportLayoutJson();
      return ok(json);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[IPC] rackMap:exportLayoutJson error:', message);
      return fail(message);
    }
  });

  ipcMain.handle('rackMap:importLayoutJson', async (_event, json: string) => {
    console.log('[IPC] rackMap:importLayoutJson called');
    try {
      if (!isNonEmptyString(json)) {
        return fail('json must be a non-empty string');
      }

      // Validate that it's parseable JSON
      try {
        JSON.parse(json);
      } catch {
        return fail('Invalid JSON format');
      }

      const imported = rackMapRepo.importLayoutJson(json);
      return ok(imported);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[IPC] rackMap:importLayoutJson error:', message);
      return fail(message);
    }
  });

  // ─── Profiles (stubs — data model ready, storage pending) ───────────────────

  ipcMain.handle('profiles:listProfiles', async () => {
    console.log('[IPC] profiles:listProfiles called');
    try {
      const profiles = profileRepo.listProfiles();
      return ok(profiles);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[IPC] profiles:listProfiles error:', message);
      return fail(message);
    }
  });

  ipcMain.handle('profiles:saveProfile', async (_event, profile: unknown) => {
    console.log('[IPC] profiles:saveProfile called');
    try {
      if (!profile || typeof profile !== 'object') {
        return fail('profile must be a valid object');
      }

      const p = profile as Record<string, unknown>;
      const showProfile: ShowProfile = {
        id: typeof p.id === 'string' ? p.id : `profile-${Date.now()}`,
        name: typeof p.name === 'string' ? p.name : '',
        description: typeof p.description === 'string' ? p.description : '',
        created: typeof p.created === 'string' ? p.created : new Date().toISOString(),
        configJson: p.configJson && typeof p.configJson === 'object'
          ? (p.configJson as Record<string, unknown>)
          : null,
        layoutId: typeof p.layoutId === 'string' ? p.layoutId : null,
      };

      profileRepo.saveProfile(showProfile);
      return ok(showProfile);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[IPC] profiles:saveProfile error:', message);
      return fail(message);
    }
  });

  ipcMain.handle('profiles:deleteProfile', async (_event, profileId: string) => {
    console.log(`[IPC] profiles:deleteProfile called: ${profileId}`);
    try {
      if (!isNonEmptyString(profileId)) {
        return fail('profileId must be a non-empty string');
      }

      const deleted = profileRepo.deleteProfile(sanitize(profileId));
      if (!deleted) {
        return fail(`Profile "${profileId}" not found.`);
      }
      return ok(undefined);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[IPC] profiles:deleteProfile error:', message);
      return fail(message);
    }
  });

  // ─── Switch Details ─────────────────────────────────────────────────────────

  ipcMain.handle('discovery:getSwitchDetails', async (_event, switchId: string) => {
    console.log(`[IPC] discovery:getSwitchDetails called: ${switchId}`);
    try {
      if (!isNonEmptyString(switchId)) {
        return fail('switchId must be a non-empty string');
      }

      const cleanId = sanitize(switchId);

      // Find the switch in memory or DB
      const liveSwitches = discoveryManager.getSwitches();
      const sw = liveSwitches.find((s) => s.id === cleanId || s.ip === cleanId)
        ?? switchRepo.getSwitchById(cleanId);
      if (!sw) {
        return fail(`Switch "${cleanId}" not found. Run a scan first.`);
      }

      // Fetch live port, group, PoE, and IGMP data from the switch via GigaCore API
      const client = new GigaCoreClient(sw.ip, { generation: sw.generation });

      const [systemInfo, ports, groups, poeSummary, igmpConfig] = await Promise.all([
        client.getSystemInfo(),
        client.getPorts(),
        client.getGroups(),
        client.getPoeSummary().catch(() => null),
        client.getIgmpConfig().catch(() => null),
      ]);

      return ok({
        id: sw.id,
        name: systemInfo.name,
        model: systemInfo.model,
        ip: sw.ip,
        mac: systemInfo.mac,
        firmware: systemInfo.firmware,
        serial: systemInfo.serial,
        generation: systemInfo.generation,
        ports,
        groups,
        poe: poeSummary,
        igmp: igmpConfig,
        temperature: sw.temperature,
        uptime: sw.uptime,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[IPC] discovery:getSwitchDetails error:', message);
      return fail(message);
    }
  });

  // ─── Config: Save Config ────────────────────────────────────────────────────

  ipcMain.handle('config:saveConfig', async (_event, switchId: string) => {
    console.log(`[IPC] config:saveConfig called: ${switchId}`);
    try {
      if (!isNonEmptyString(switchId)) {
        return fail('switchId must be a non-empty string');
      }

      const cleanId = sanitize(switchId);

      // Find the switch in memory or DB
      const liveSwitches = discoveryManager.getSwitches();
      const sw = liveSwitches.find((s) => s.id === cleanId || s.ip === cleanId)
        ?? switchRepo.getSwitchById(cleanId);
      if (!sw) {
        return fail(`Switch "${cleanId}" not found. Run a scan first.`);
      }

      const client = new GigaCoreClient(sw.ip, { generation: sw.generation });
      await client.saveConfig();

      eventLogger.log('config', 'info', `Configuration saved on switch ${sw.ip} (${cleanId})`);

      return ok({ saved: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[IPC] config:saveConfig error:', message);
      return fail(message);
    }
  });

  // ─── Config: Set Port VLANs ────────────────────────────────────────────────

  ipcMain.handle('config:setPortVlans', async (_event, switchId: string, port: number, config: {
    mode: 'access' | 'trunk';
    nativeVlan?: number;
    taggedVlans?: number[];
  }) => {
    console.log(`[IPC] config:setPortVlans called: switch=${switchId} port=${port} mode=${config?.mode}`);
    try {
      if (!isNonEmptyString(switchId)) {
        return fail('switchId must be a non-empty string');
      }
      if (typeof port !== 'number' || port < 0) {
        return fail('port must be a non-negative number');
      }
      if (!config || (config.mode !== 'access' && config.mode !== 'trunk')) {
        return fail('config.mode must be "access" or "trunk"');
      }

      const cleanId = sanitize(switchId);

      // Find the switch in memory or DB
      const liveSwitches = discoveryManager.getSwitches();
      const sw = liveSwitches.find((s) => s.id === cleanId || s.ip === cleanId)
        ?? switchRepo.getSwitchById(cleanId);
      if (!sw) {
        return fail(`Switch "${cleanId}" not found. Run a scan first.`);
      }

      const client = new GigaCoreClient(sw.ip, { generation: sw.generation });

      if (config.mode === 'access') {
        const nativeVlan = config.nativeVlan ?? 1;
        await client.setPortGroup(port, nativeVlan);
      } else {
        const taggedVlans = config.taggedVlans ?? [];
        await client.setPortTrunk(port, taggedVlans);
      }

      return ok({ configured: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[IPC] config:setPortVlans error:', message);
      return fail(message);
    }
  });

  // ─── Discovery manager event forwarding ─────────────────────────────────────
  // Forward discovery events to the renderer process via IPC. The preload
  // exposes these as onSwitchDiscovered, onSwitchLost, etc.

  // Forward scan progress to all renderer windows
  discoveryManager.on('scan:progress', (scanned: number, total: number) => {
    try {
      const { BrowserWindow } = require('electron');
      BrowserWindow.getAllWindows().forEach((win: Electron.BrowserWindow) => {
        win.webContents.send('event:scanProgress', { scanned, total });
      });
    } catch (err) {
      console.error('[IPC] Error forwarding scan:progress event:', err);
    }
  });

  discoveryManager.on('switch:found', (sw) => {
    try {
      // Persist to DB
      switchRepo.upsertSwitch(sw);
      // Log the event
      eventLogger.log('discovery', 'info', `Switch discovered: ${sw.name} (${sw.ip})`, {
        switchMac: sw.mac,
        switchName: sw.name,
      });
      // Forward to all renderer windows
      const { BrowserWindow } = require('electron');
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send('event:switchDiscovered', sw);
      }
    } catch (err) {
      console.error('[IPC] Error forwarding switch:found event:', err);
    }
  });

  discoveryManager.on('switch:updated', (sw) => {
    try {
      switchRepo.upsertSwitch(sw);
    } catch (err) {
      console.error('[IPC] Error persisting switch:updated:', err);
    }
  });

  discoveryManager.on('switch:lost', (switchId) => {
    try {
      switchRepo.updateSwitchStatus(switchId, false);
      eventLogger.log('discovery', 'warning', `Switch lost: ${switchId}`, {
        switchMac: switchId,
      });
      const { BrowserWindow } = require('electron');
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send('event:switchLost', switchId);
      }
    } catch (err) {
      console.error('[IPC] Error forwarding switch:lost event:', err);
    }
  });

  discoveryManager.on('device:found', (dev) => {
    try {
      deviceRepo.upsertDevice({
        mac: dev.mac,
        ip: dev.ip,
        hostname: dev.hostname,
        manufacturer: dev.manufacturer,
        protocol: dev.protocol,
        connected_switch_mac: dev.connectedSwitchMac,
        connected_port: dev.connectedPort,
        first_seen: dev.firstSeen,
        last_seen: dev.lastSeen,
      });
    } catch (err) {
      console.error('[IPC] Error persisting device:found:', err);
    }
  });

  discoveryManager.on('error', (error) => {
    console.error('[Discovery] Error:', error.message);
    eventLogger.log('discovery', 'error', error.message);
  });

  console.log('[IPC] All handlers registered');
}

// =============================================================================
// Cleanup — call from app.on('before-quit')
// =============================================================================

export function cleanupIpcHandlers(): void {
  console.log('[IPC] Cleaning up...');
  try {
    discoveryManager.destroy();
  } catch (err) {
    console.error('[IPC] Error destroying discovery manager:', err);
  }
}
