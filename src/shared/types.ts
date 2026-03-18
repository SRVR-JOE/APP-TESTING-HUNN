// ─── Enums ───────────────────────────────────────────────────────────────────

export type EventCategory =
  | 'discovery'
  | 'link'
  | 'poe'
  | 'config'
  | 'health'
  | 'system';

export type Severity = 'info' | 'warning' | 'error' | 'critical';

export type HealthStatus = 'healthy' | 'warning' | 'critical' | 'offline';

export type SwitchGeneration = 1 | 2;

// ─── Core Models ─────────────────────────────────────────────────────────────

export interface DiscoveredSwitch {
  id: string;
  name: string;
  model: string;
  ip: string;
  mac: string;
  firmware: string;
  generation: SwitchGeneration;
  serial: string;
  isOnline: boolean;
  lastSeen: string;
  firstSeen: string;
  rackGroup?: string;
  location?: string;
  poeTotal?: number;
  poeBudget?: number;
  portCount: number;
  portsUp: number;
  healthStatus: HealthStatus;
}

export interface DiscoveredDevice {
  id: number;
  mac: string;
  ip?: string;
  hostname?: string;
  manufacturer?: string;
  protocol?: string;
  connectedSwitchMac?: string;
  connectedPort?: number;
  linkSpeed?: string;
  firstSeen: string;
  lastSeen: string;
}

export interface EventLogEntry {
  id: number;
  timestamp: string;
  category: EventCategory;
  severity: Severity;
  switchMac?: string;
  switchName?: string;
  message: string;
  details?: string;
}

export interface PortStats {
  id: number;
  switchMac: string;
  port: number;
  timestamp: string;
  rxBytes: number;
  txBytes: number;
  rxPackets: number;
  txPackets: number;
  rxErrors: number;
  txErrors: number;
  linkUp: boolean;
  speed: string;
  poeWatts?: number;
}

export interface RackGroup {
  id: string;
  name: string;
  description?: string;
  switchIds: string[];
  position: { x: number; y: number };
  color?: string;
}

export interface MapLayout {
  id: string;
  name: string;
  groups: RackGroup[];
  connections: MapConnection[];
  createdAt: string;
  updatedAt: string;
}

export interface MapConnection {
  id: string;
  sourceSwitchId: string;
  sourcePort: number;
  targetSwitchId: string;
  targetPort: number;
  label?: string;
}

export interface ShowPreset {
  id: string;
  name: string;
  description?: string;
  switchConfigs: SwitchPresetConfig[];
  createdAt: string;
  updatedAt: string;
}

export interface SwitchPresetConfig {
  switchId: string;
  profileId: string;
  portOverrides?: PortOverride[];
}

export interface PortOverride {
  port: number;
  vlan?: number;
  poeEnabled?: boolean;
  enabled?: boolean;
  label?: string;
}

export interface SwitchProfile {
  id: string;
  name: string;
  description?: string;
  model: string;
  generation: SwitchGeneration;
  portConfigs: PortConfig[];
  vlans: VlanConfig[];
  createdAt: string;
  updatedAt: string;
}

export interface PortConfig {
  port: number;
  vlan: number;
  taggedVlans?: number[];
  poeEnabled: boolean;
  enabled: boolean;
  label?: string;
  speed?: string;
}

export interface VlanConfig {
  id: number;
  name: string;
  tagged: number[];
  untagged: number[];
}

export interface HealthCheckResult {
  switchId: string;
  switchName: string;
  timestamp: string;
  checks: HealthCheck[];
  overallStatus: HealthStatus;
}

export interface HealthCheck {
  name: string;
  status: HealthStatus;
  message: string;
  value?: string | number;
  threshold?: string | number;
}

// ─── IPC API Types ───────────────────────────────────────────────────────────

export interface ElectronAPI {
  // Discovery
  scanSubnet: (subnet: string) => Promise<DiscoveredSwitch[]>;
  getDiscoveredSwitches: () => Promise<DiscoveredSwitch[]>;
  getDiscoveredDevices: () => Promise<DiscoveredDevice[]>;
  startPolling: (intervalMs: number) => Promise<void>;
  stopPolling: () => Promise<void>;

  // Config
  applyProfile: (switchId: string, profileId: string) => Promise<void>;
  backupSwitch: (switchId: string) => Promise<string>;
  restoreSwitch: (switchId: string, backupPath: string) => Promise<void>;

  // Excel
  generateTemplate: (model: string) => Promise<string>;
  parseExcelFile: (filePath: string) => Promise<SwitchProfile>;

  // Database
  queryEventLog: (filters?: Partial<EventLogEntry>) => Promise<EventLogEntry[]>;
  getPortStats: (switchMac: string, port: number) => Promise<PortStats[]>;

  // Rack Map
  getRackGroups: () => Promise<RackGroup[]>;
  saveRackLayout: (layout: MapLayout) => Promise<void>;
  exportLayoutJson: () => Promise<string>;
  importLayoutJson: (json: string) => Promise<void>;

  // Profiles
  listProfiles: () => Promise<SwitchProfile[]>;
  saveProfile: (profile: SwitchProfile) => Promise<void>;
  deleteProfile: (profileId: string) => Promise<void>;

  // Troubleshoot
  runHealthChecks: (switchIds: string[]) => Promise<HealthCheckResult[]>;
  pingHost: (host: string) => Promise<{ reachable: boolean; latencyMs: number }>;
  compareSwitches: (switchIdA: string, switchIdB: string) => Promise<Record<string, unknown>>;
  resetCounters: (switchId: string) => Promise<void>;

  // Events (callbacks)
  onSwitchDiscovered: (callback: (sw: DiscoveredSwitch) => void) => () => void;
  onSwitchLost: (callback: (switchId: string) => void) => () => void;
  onPortChange: (callback: (data: { switchMac: string; port: number; linkUp: boolean }) => void) => () => void;
  onHealthAlert: (callback: (result: HealthCheckResult) => void) => () => void;
  onLogEvent: (callback: (entry: EventLogEntry) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
