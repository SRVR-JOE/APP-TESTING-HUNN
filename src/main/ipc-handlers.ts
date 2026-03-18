import { ipcMain } from 'electron';

export function registerIpcHandlers(): void {
  // ─── Discovery ───────────────────────────────────────────────────────────────
  ipcMain.handle('discovery:scanSubnet', async (_event, subnet: string) => {
    console.log(`[IPC] scanSubnet called with: ${subnet}`);
    return [];
  });

  ipcMain.handle('discovery:getDiscoveredSwitches', async () => {
    return [];
  });

  ipcMain.handle('discovery:getDiscoveredDevices', async () => {
    return [];
  });

  ipcMain.handle('discovery:startPolling', async (_event, intervalMs: number) => {
    console.log(`[IPC] startPolling called with interval: ${intervalMs}ms`);
  });

  ipcMain.handle('discovery:stopPolling', async () => {
    console.log('[IPC] stopPolling called');
  });

  // ─── Config ──────────────────────────────────────────────────────────────────
  ipcMain.handle('config:applyProfile', async (_event, switchId: string, profileId: string) => {
    console.log(`[IPC] applyProfile: switch=${switchId}, profile=${profileId}`);
  });

  ipcMain.handle('config:backupSwitch', async (_event, switchId: string) => {
    console.log(`[IPC] backupSwitch: ${switchId}`);
    return '';
  });

  ipcMain.handle('config:restoreSwitch', async (_event, switchId: string, backupPath: string) => {
    console.log(`[IPC] restoreSwitch: switch=${switchId}, path=${backupPath}`);
  });

  // ─── Excel ───────────────────────────────────────────────────────────────────
  ipcMain.handle('excel:generateTemplate', async (_event, model: string) => {
    console.log(`[IPC] generateTemplate: ${model}`);
    return '';
  });

  ipcMain.handle('excel:parseExcelFile', async (_event, filePath: string) => {
    console.log(`[IPC] parseExcelFile: ${filePath}`);
    return {};
  });

  // ─── Database ────────────────────────────────────────────────────────────────
  ipcMain.handle('database:queryEventLog', async (_event, filters?: Record<string, unknown>) => {
    console.log('[IPC] queryEventLog', filters);
    return [];
  });

  ipcMain.handle('database:getPortStats', async (_event, switchMac: string, port: number) => {
    console.log(`[IPC] getPortStats: mac=${switchMac}, port=${port}`);
    return [];
  });

  // ─── Rack Map ────────────────────────────────────────────────────────────────
  ipcMain.handle('rackMap:getRackGroups', async () => {
    return [];
  });

  ipcMain.handle('rackMap:saveRackLayout', async (_event, layout: unknown) => {
    console.log('[IPC] saveRackLayout', layout);
  });

  ipcMain.handle('rackMap:exportLayoutJson', async () => {
    return '{}';
  });

  ipcMain.handle('rackMap:importLayoutJson', async (_event, json: string) => {
    console.log('[IPC] importLayoutJson', json.slice(0, 100));
  });

  // ─── Profiles ────────────────────────────────────────────────────────────────
  ipcMain.handle('profiles:listProfiles', async () => {
    return [];
  });

  ipcMain.handle('profiles:saveProfile', async (_event, profile: unknown) => {
    console.log('[IPC] saveProfile', profile);
  });

  ipcMain.handle('profiles:deleteProfile', async (_event, profileId: string) => {
    console.log(`[IPC] deleteProfile: ${profileId}`);
  });

  // ─── Troubleshoot ────────────────────────────────────────────────────────────
  ipcMain.handle('troubleshoot:runHealthChecks', async (_event, switchIds: string[]) => {
    console.log('[IPC] runHealthChecks', switchIds);
    return [];
  });

  ipcMain.handle('troubleshoot:pingHost', async (_event, host: string) => {
    console.log(`[IPC] pingHost: ${host}`);
    return { reachable: false, latencyMs: 0 };
  });

  ipcMain.handle('troubleshoot:compareSwitches', async (_event, switchIdA: string, switchIdB: string) => {
    console.log(`[IPC] compareSwitches: ${switchIdA} vs ${switchIdB}`);
    return {};
  });

  ipcMain.handle('troubleshoot:resetCounters', async (_event, switchId: string) => {
    console.log(`[IPC] resetCounters: ${switchId}`);
  });

  console.log('[IPC] All handlers registered');
}
