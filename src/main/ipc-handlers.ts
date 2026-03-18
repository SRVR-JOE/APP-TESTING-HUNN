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

import { ipcMain, dialog } from 'electron';
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
import { GigaCoreClient } from './api';
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

        return fail(
          'Profile application is not yet implemented. The deploy engine requires GigaCore API write access.',
        );
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

  // ─── Discovery manager event forwarding ─────────────────────────────────────
  // Forward discovery events to the renderer process via IPC. The preload
  // exposes these as onSwitchDiscovered, onSwitchLost, etc.

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
