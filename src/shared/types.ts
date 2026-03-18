// =============================================================================
// Luminex Configurator — SINGLE SOURCE OF TRUTH for all shared types
// =============================================================================

// ---- Enums / Literal Unions -------------------------------------------------

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

// ---- Sub-models used by DiscoveredSwitch ------------------------------------

export interface SwitchGroup {
  groupNumber: number;
  name: string;
  vlanId: number;
  igmpSnooping: boolean;
  igmpQuerier: boolean;
  unknownFlooding: boolean;
}

export interface SwitchPort {
  port: number;
  label: string;
  linkUp: boolean;
  speedMbps: number;
  maxSpeedMbps: number;
  errorsPerMin: number;
  isTrunk: boolean;
  vlans: number[];
  groupVlan?: string;
  mode?: 'access' | 'trunk';
  trunkGroups?: string;
  poeEnabled?: boolean;
  speed?: string;
}

// ---- Core Models ------------------------------------------------------------

export interface DiscoveredSwitch {
  id: string;
  name: string;
  model: string;
  ip: string;
  subnet?: string;
  gateway?: string;
  mac: string;
  firmware: string;
  generation: SwitchGeneration;
  serial?: string;
  rackGroup?: string;
  lastSeen: string;
  firstSeen: string;
  isOnline: boolean;
  portCount: number;
  portsUp: number;
  healthStatus: HealthStatus;
  temperature?: number;
  uptime?: string;
  location?: string;
  poe?: { budgetW: number; drawW: number };
  groups?: SwitchGroup[];
  ports?: SwitchPort[];
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

/**
 * Input shape for inserting/upserting a device into the DB.
 * Uses snake_case to match the database column names directly.
 */
export interface DiscoveredDeviceInput {
  mac: string;
  ip?: string;
  hostname?: string;
  manufacturer?: string;
  protocol?: string;
  connected_switch_mac?: string;
  connected_port?: number;
  link_speed?: string;
  first_seen?: string;
  last_seen?: string;
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
  txBytes: number;
  rxBytes: number;
  txPackets: number;
  rxPackets: number;
  txBroadcast: number;
  rxBroadcast: number;
  txMulticast: number;
  rxMulticast: number;
  crcErrors: number;
  collisions: number;
  drops: number;
  linkSpeed?: string;
  poeWatts?: number;
}

/**
 * Input shape for recording a single port statistics snapshot.
 * Uses snake_case to match the database column names directly.
 */
export interface PortStatsInput {
  tx_bytes: number;
  rx_bytes: number;
  tx_packets: number;
  rx_packets: number;
  tx_broadcast: number;
  rx_broadcast: number;
  tx_multicast: number;
  rx_multicast: number;
  crc_errors: number;
  collisions: number;
  drops: number;
  link_speed?: string;
  poe_watts?: number;
}

/**
 * Filters for querying the event log.
 */
export interface LogFilters {
  category?: EventCategory[];
  severity?: Severity[];
  switchMac?: string;
  startTime?: string;
  endTime?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * Aggregate statistics about the event log.
 */
export interface EventLogStats {
  total: number;
  byCategory: Record<string, number>;
  bySeverity: Record<string, number>;
}

// ---- Rack Map & Layout Models -----------------------------------------------

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

// ---- Profile Models ---------------------------------------------------------

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

// ---- Health Check Models ----------------------------------------------------

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

// ---- IPC API Types ----------------------------------------------------------

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
