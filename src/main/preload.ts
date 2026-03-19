import { contextBridge, ipcRenderer } from 'electron';

type Callback<T> = (data: T) => void;

function createEventListener<T>(channel: string) {
  return (callback: Callback<T>) => {
    const handler = (_event: Electron.IpcRendererEvent, data: T) => callback(data);
    ipcRenderer.on(channel, handler);
    return () => {
      ipcRenderer.removeListener(channel, handler);
    };
  };
}

/**
 * Unwrap IPC responses: handlers return {success, data, error}.
 * The renderer expects raw data, so we extract .data or throw on failure.
 */
async function invoke(channel: string, ...args: unknown[]): Promise<any> {
  const result = await ipcRenderer.invoke(channel, ...args);
  // If the handler returned a wrapped response, unwrap it
  if (result && typeof result === 'object' && 'success' in result) {
    if (result.success) {
      return result.data;
    }
    throw new Error(result.error ?? `IPC call ${channel} failed`);
  }
  // Raw value — return as-is
  return result;
}

contextBridge.exposeInMainWorld('electronAPI', {
  // Discovery
  scanSubnet: (subnet: string) =>
    invoke('discovery:scanSubnet', subnet),
  getDiscoveredSwitches: () =>
    invoke('discovery:getDiscoveredSwitches'),
  getSwitches: () =>
    invoke('discovery:getDiscoveredSwitches'),
  getDiscoveredDevices: () =>
    invoke('discovery:getDiscoveredDevices'),
  getLocalSubnets: () =>
    invoke('discovery:getLocalSubnets'),
  getSwitchDetails: (switchId: string) =>
    invoke('discovery:getSwitchDetails', switchId),
  startPolling: (intervalMs: number) =>
    invoke('discovery:startPolling', intervalMs),
  stopPolling: () =>
    invoke('discovery:stopPolling'),

  // Utility
  pingSwitch: (ip: string) =>
    invoke('troubleshoot:pingHost', ip),
  openWebUI: (ip: string) =>
    invoke('utility:openWebUI', ip),
  exportCSV: () =>
    invoke('utility:exportCSV'),

  // Config
  applyProfile: (switchId: string, profileId: string) =>
    invoke('config:applyProfile', switchId, profileId),
  backupSwitch: (switchId: string) =>
    invoke('config:backupSwitch', switchId),
  restoreSwitch: (switchId: string, backupPath: string) =>
    invoke('config:restoreSwitch', switchId, backupPath),
  saveConfig: (switchId: string) =>
    invoke('config:saveConfig', switchId),
  setPortVlans: (switchId: string, port: number, config: unknown) =>
    invoke('config:setPortVlans', switchId, port, config),

  // Excel
  generateTemplate: (model: string) =>
    invoke('excel:generateTemplate', model),
  parseExcelFile: (filePath: string) =>
    invoke('excel:parseExcelFile', filePath),

  // Database
  queryEventLog: (filters?: Record<string, unknown>) =>
    invoke('database:queryEventLog', filters),
  getPortStats: (switchMac: string, port: number) =>
    invoke('database:getPortStats', switchMac, port),

  // Rack Map
  getRackGroups: () =>
    invoke('rackMap:getRackGroups'),
  saveRackLayout: (layout: unknown) =>
    invoke('rackMap:saveRackLayout', layout),
  exportLayoutJson: () =>
    invoke('rackMap:exportLayoutJson'),
  importLayoutJson: (json: string) =>
    invoke('rackMap:importLayoutJson', json),

  // Profiles
  listProfiles: () =>
    invoke('profiles:listProfiles'),
  saveProfile: (profile: unknown) =>
    invoke('profiles:saveProfile', profile),
  deleteProfile: (profileId: string) =>
    invoke('profiles:deleteProfile', profileId),

  // Troubleshoot
  runHealthChecks: (switchIds: string[]) =>
    invoke('troubleshoot:runHealthChecks', switchIds),
  pingHost: (host: string) =>
    invoke('troubleshoot:pingHost', host),
  compareSwitches: (switchIdA: string, switchIdB: string) =>
    invoke('troubleshoot:compareSwitches', switchIdA, switchIdB),
  resetCounters: (switchId: string) =>
    invoke('troubleshoot:resetCounters', switchId),

  // Batch Operations
  batchExecute: (operations: unknown[], options?: unknown) =>
    invoke('batch:execute', operations, options),
  batchAbort: () =>
    invoke('batch:abort'),
  batchRollback: (failedResults: unknown[]) =>
    invoke('batch:rollback', failedResults),

  // Deploy Show File
  deployShowFile: (showFileConfig: unknown) =>
    invoke('deploy:showFile', showFileConfig),

  // Firmware Upload
  uploadFirmware: (payload: { switchId: string; firmwarePath: string }) =>
    invoke('config:uploadFirmware', payload),

  // Discovery — extended
  addCustomSubnet: (subnet: string) =>
    invoke('discovery:addCustomSubnet', subnet),

  // Events (main -> renderer)
  onSwitchDiscovered: createEventListener('event:switchDiscovered'),
  onSwitchLost: createEventListener('event:switchLost'),
  onSwitchUpdate: createEventListener('event:switchUpdate'),
  onScanProgress: createEventListener<{ scanned: number; total: number }>('event:scanProgress'),
  onPortChange: createEventListener('event:portChange'),
  onHealthAlert: createEventListener('event:healthAlert'),
  onLogEvent: createEventListener('event:logEvent'),
  onBatchProgress: createEventListener<{
    switchIp: string;
    status: string;
    progress: number;
    currentOperation: string;
    overallProgress: number;
    total: number;
    completed: number;
    failed: number;
    error?: string;
  }>('event:batchProgress'),
  onDeployProgress: createEventListener<{
    switchId: string;
    status: string;
    message: string;
  }>('event:deployProgress'),
  onFirmwareProgress: createEventListener<{
    switchId: string;
    percent: number;
  }>('firmware:progress'),
});
