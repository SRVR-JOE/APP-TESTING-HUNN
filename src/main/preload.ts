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

contextBridge.exposeInMainWorld('electronAPI', {
  // Discovery
  scanSubnet: (subnet: string) =>
    ipcRenderer.invoke('discovery:scanSubnet', subnet),
  getDiscoveredSwitches: () =>
    ipcRenderer.invoke('discovery:getDiscoveredSwitches'),
  // Alias used by the renderer hooks (useElectronAPI / ScannerView)
  getSwitches: () =>
    ipcRenderer.invoke('discovery:getDiscoveredSwitches'),
  getDiscoveredDevices: () =>
    ipcRenderer.invoke('discovery:getDiscoveredDevices'),
  startPolling: (intervalMs: number) =>
    ipcRenderer.invoke('discovery:startPolling', intervalMs),
  stopPolling: () =>
    ipcRenderer.invoke('discovery:stopPolling'),
  getLocalSubnets: () =>
    ipcRenderer.invoke('discovery:getLocalSubnets'),

  // Config
  applyProfile: (switchId: string, profileId: string) =>
    ipcRenderer.invoke('config:applyProfile', switchId, profileId),
  backupSwitch: (switchId: string) =>
    ipcRenderer.invoke('config:backupSwitch', switchId),
  restoreSwitch: (switchId: string, backupPath: string) =>
    ipcRenderer.invoke('config:restoreSwitch', switchId, backupPath),

  // Excel
  generateTemplate: (model: string) =>
    ipcRenderer.invoke('excel:generateTemplate', model),
  parseExcelFile: (filePath: string) =>
    ipcRenderer.invoke('excel:parseExcelFile', filePath),

  // Database
  queryEventLog: (filters?: Record<string, unknown>) =>
    ipcRenderer.invoke('database:queryEventLog', filters),
  getPortStats: (switchMac: string, port: number) =>
    ipcRenderer.invoke('database:getPortStats', switchMac, port),

  // Rack Map
  getRackGroups: () =>
    ipcRenderer.invoke('rackMap:getRackGroups'),
  saveRackLayout: (layout: unknown) =>
    ipcRenderer.invoke('rackMap:saveRackLayout', layout),
  exportLayoutJson: () =>
    ipcRenderer.invoke('rackMap:exportLayoutJson'),
  importLayoutJson: (json: string) =>
    ipcRenderer.invoke('rackMap:importLayoutJson', json),

  // Profiles
  listProfiles: () =>
    ipcRenderer.invoke('profiles:listProfiles'),
  saveProfile: (profile: unknown) =>
    ipcRenderer.invoke('profiles:saveProfile', profile),
  deleteProfile: (profileId: string) =>
    ipcRenderer.invoke('profiles:deleteProfile', profileId),

  // Troubleshoot
  runHealthChecks: (switchIds: string[]) =>
    ipcRenderer.invoke('troubleshoot:runHealthChecks', switchIds),
  pingHost: (host: string) =>
    ipcRenderer.invoke('troubleshoot:pingHost', host),
  // Alias used by the renderer hooks (useElectronAPI / ScannerView)
  pingSwitch: (ip: string) =>
    ipcRenderer.invoke('troubleshoot:pingHost', ip),
  compareSwitches: (switchIdA: string, switchIdB: string) =>
    ipcRenderer.invoke('troubleshoot:compareSwitches', switchIdA, switchIdB),
  resetCounters: (switchId: string) =>
    ipcRenderer.invoke('troubleshoot:resetCounters', switchId),

  // Utility
  openWebUI: (ip: string) =>
    ipcRenderer.invoke('utility:openWebUI', ip),
  exportCSV: () =>
    ipcRenderer.invoke('utility:exportCSV'),

  // Events (main -> renderer)
  onSwitchDiscovered: createEventListener('event:switchDiscovered'),
  onSwitchLost: createEventListener('event:switchLost'),
  onPortChange: createEventListener('event:portChange'),
  onHealthAlert: createEventListener('event:healthAlert'),
  onLogEvent: createEventListener('event:logEvent'),
  onScanProgress: createEventListener<number>('event:scanProgress'),
  onSwitchUpdate: createEventListener('event:switchUpdate'),
});
