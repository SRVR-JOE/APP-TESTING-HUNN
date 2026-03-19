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

// ---- Naming Ideology Types --------------------------------------------------

export type LocationType = 'truss' | 'rack' | 'floor';

export interface NamingTemplate {
  id: string;
  name: string;
  locationType: LocationType;
  pattern: string; // e.g. "FOH-{type}-{number}"
  variables: Record<string, string>;
  isBuiltIn: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NamingAssignment {
  switchId: string;
  templateId: string;
  generatedName: string;
  variableOverrides: Record<string, string>;
  applied: boolean;
}

// ---- Rack Map & Layout Models -----------------------------------------------

export interface RackGroup {
  id: string;
  name: string;
  description?: string;
  locationType?: LocationType;
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

// ---- Show File System -------------------------------------------------------

export interface ShowFile {
  id: string;
  name: string;
  description?: string;
  version: number;
  tourId?: string;
  venueId?: string;
  switches: ShowFileSwitchConfig[];
  vlans: VlanConfig[];
  rackLayout?: {
    groups: RackGroup[];
    connections: MapConnection[];
  };
  namingAssignments: NamingAssignment[];
  protocolPresets: string[]; // protocol preset IDs applied
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  tags?: string[];
}

export interface ShowFileSwitchConfig {
  switchId: string;
  mac: string;
  name: string;
  ip: string;
  role?: SwitchRole;
  profileId?: string;
  portConfigs: PortConfig[];
  vlans: VlanConfig[];
  groups?: SwitchGroup[];
  igmpSettings?: { snooping: boolean; querier: boolean; queryInterval?: number };
  poeSettings?: { enabled: boolean; budgetW?: number };
}

export interface ShowFileVersion {
  id: string;
  showFileId: string;
  version: number;
  snapshot: ShowFile;
  changeDescription: string;
  changedBy?: string;
  createdAt: string;
  diff?: ShowFileDiff;
}

export interface ShowFileDiff {
  switchesAdded: string[];
  switchesRemoved: string[];
  switchesModified: { switchId: string; changes: string[] }[];
  vlansAdded: number[];
  vlansRemoved: number[];
  summary: string;
}

// ---- Switch Roles -----------------------------------------------------------

export type SwitchRole =
  | 'foh-core'
  | 'foh-distro'
  | 'stage-left'
  | 'stage-right'
  | 'monitor-world'
  | 'broadcast'
  | 'delay-tower'
  | 'truss'
  | 'floor-distro'
  | 'spare'
  | 'custom';

export interface SwitchRoleTemplate {
  id: string;
  role: SwitchRole;
  name: string;
  description: string;
  defaultProfile?: string;
  vlanPresets: string[];
  portRules: RolePortRule[];
  icon: string;
  color: string;
}

export interface RolePortRule {
  portRange: string; // e.g. "1-8", "25-26"
  vlan?: number;
  mode?: 'access' | 'trunk';
  poeEnabled?: boolean;
  label?: string;
}

// ---- Auto-Assignment --------------------------------------------------------

export interface SwitchAssignmentRule {
  id: string;
  priority: number;
  matchField: 'mac' | 'serial' | 'name' | 'ip' | 'model';
  matchPattern: string; // regex or glob
  assignRole: SwitchRole;
  assignProfile?: string;
}

// ---- Pre-Flight Validation --------------------------------------------------

export type PreFlightCheckType =
  | 'reachability'
  | 'firmware-compat'
  | 'ip-conflict'
  | 'vlan-consistency'
  | 'role-assignment'
  | 'poe-budget'
  | 'port-conflict'
  | 'igmp-querier'
  | 'redundancy-path'
  | 'name-conflict';

export interface PreFlightCheck {
  type: PreFlightCheckType;
  status: 'pass' | 'warning' | 'fail' | 'skipped';
  switchId?: string;
  message: string;
  details?: string;
  autoFixable?: boolean;
}

export interface PreFlightReport {
  id: string;
  showFileId: string;
  timestamp: string;
  checks: PreFlightCheck[];
  overallStatus: 'pass' | 'warning' | 'fail';
  canDeploy: boolean;
}

// ---- Deploy -----------------------------------------------------------------

export type DeployStatus = 'pending' | 'deploying' | 'success' | 'failed' | 'rolled-back';

export interface DeployResult {
  id: string;
  showFileId: string;
  timestamp: string;
  switches: { switchId: string; status: DeployStatus; message?: string; duration?: number }[];
  overallStatus: DeployStatus;
  preFlightReport: PreFlightReport;
  rollbackAvailable: boolean;
}

// ---- Drift Detection --------------------------------------------------------

export interface DriftReport {
  id: string;
  showFileId: string;
  timestamp: string;
  drifts: DriftItem[];
  totalDrifts: number;
}

export interface DriftItem {
  switchId: string;
  switchName: string;
  field: string;
  expected: string;
  actual: string;
  severity: 'info' | 'warning' | 'critical';
}

// ---- Venue Profiles ---------------------------------------------------------

export interface VenueProfile {
  id: string;
  name: string;
  city: string;
  country: string;
  venueType: 'arena' | 'stadium' | 'theater' | 'festival' | 'convention' | 'broadcast-studio' | 'outdoor' | 'other';
  capacity?: number;
  notes?: string;
  houseNetwork?: {
    internetDrop: boolean;
    existingVlans?: number[];
    houseSubnets?: string[];
    restrictions?: string;
  };
  previousConfigs: string[]; // showFile IDs used here before
  contacts?: VenueContact[];
  cableInfrastructure?: string;
  powerInfo?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VenueContact {
  name: string;
  role: string;
  email?: string;
  phone?: string;
}

// ---- Tour Management --------------------------------------------------------

export interface Tour {
  id: string;
  name: string;
  artist?: string;
  productionCompany?: string;
  startDate: string;
  endDate?: string;
  showFileIds: string[];
  venueSchedule: TourStop[];
  fleetSwitchIds: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TourStop {
  id: string;
  venueId: string;
  venueName: string;
  date: string;
  loadInTime?: string;
  showTime?: string;
  loadOutTime?: string;
  showFileId?: string;
  status: 'upcoming' | 'in-progress' | 'completed' | 'cancelled';
  notes?: string;
}

// ---- Advance Sheet ----------------------------------------------------------

export interface AdvanceSheet {
  id: string;
  tourStopId: string;
  venueId: string;
  generatedAt: string;
  sections: AdvanceSheetSection[];
}

export interface AdvanceSheetSection {
  title: string;
  content: string;
  type: 'network-requirements' | 'power-requirements' | 'cable-runs' | 'vlan-scheme' | 'contact-info' | 'notes';
}

// ---- Protocol VLAN Presets --------------------------------------------------

export type AVProtocol =
  | 'dante-primary'
  | 'dante-secondary'
  | 'aes67'
  | 'sacn'
  | 'artnet'
  | 'ndi'
  | 'ma-net'
  | 'avb'
  | 'st2110'
  | 'management'
  | 'comms'
  | 'video'
  | 'guest-wifi';

export interface ProtocolVlanPreset {
  id: string;
  protocol: AVProtocol;
  name: string;
  description: string;
  vlanId: number;
  subnet: string;
  igmpSnooping: boolean;
  igmpQuerier: boolean;
  qosDscp?: number;
  priority?: number;
  color: string;
  icon: string;
}

// ---- Spare Switch -----------------------------------------------------------

export interface SpareSwitchConfig {
  id: string;
  spareMAC: string;
  spareName: string;
  model: string;
  replacesRole: SwitchRole;
  preloadedProfileId?: string;
  preloadedShowFileId?: string;
  status: 'ready' | 'deployed' | 'maintenance';
  lastVerified?: string;
}

// ---- Fleet / Asset Tracking -------------------------------------------------

export interface FleetAsset {
  id: string;
  mac: string;
  serial: string;
  model: string;
  generation: SwitchGeneration;
  firmware: string;
  purchaseDate?: string;
  warrantyExpiry?: string;
  currentTourId?: string;
  currentVenueId?: string;
  status: 'available' | 'deployed' | 'maintenance' | 'retired' | 'rma';
  maintenanceHistory: MaintenanceRecord[];
  notes?: string;
  location?: string;
  lastSeen?: string;
}

export interface MaintenanceRecord {
  id: string;
  date: string;
  type: 'firmware-update' | 'repair' | 'rma' | 'inspection' | 'calibration';
  description: string;
  performedBy?: string;
  cost?: number;
}

// ---- Multicast Flow ---------------------------------------------------------

export interface MulticastFlow {
  id: string;
  groupAddress: string;
  sourceIP: string;
  sourceSwitchId: string;
  sourcePort: number;
  protocol: AVProtocol;
  vlanId: number;
  receivers: MulticastReceiver[];
  bandwidthMbps: number;
  label?: string;
}

export interface MulticastReceiver {
  switchId: string;
  port: number;
  deviceName?: string;
}

// ---- Redundancy / Topology --------------------------------------------------

export interface RedundancyConfig {
  id: string;
  type: 'rstp' | 'rlinkx' | 'ring';
  rootBridgeSwitchId?: string;
  members: RedundancyMember[];
  status: 'healthy' | 'degraded' | 'broken';
  lastFailover?: string;
}

export interface RedundancyMember {
  switchId: string;
  role: 'root' | 'designated' | 'backup' | 'blocking';
  portA: number;
  portB: number;
  linkStatus: 'forwarding' | 'blocking' | 'learning' | 'disabled';
}

export interface FailoverSimResult {
  brokenLink: { switchA: string; portA: number; switchB: string; portB: number };
  newPath: string[];
  convergenceTimeMs: number;
  affectedFlows: string[];
  status: 'recovered' | 'partial' | 'isolated';
}

// ---- Cable Schedule ---------------------------------------------------------

export interface CableRun {
  id: string;
  label: string;
  type: 'cat6' | 'cat6a' | 'fiber-sm' | 'fiber-mm' | 'coax' | 'other';
  lengthMeters: number;
  sourceSwitchId: string;
  sourcePort: number;
  sourceLocation: string;
  destSwitchId: string;
  destPort: number;
  destLocation: string;
  pathway?: string;
  status: 'planned' | 'installed' | 'verified' | 'faulty';
  notes?: string;
}

export interface CableSchedule {
  id: string;
  showFileId: string;
  cables: CableRun[];
  totalLength: number;
  generatedAt: string;
}

// ---- Audit Trail ------------------------------------------------------------

export interface AuditEntry {
  id: string;
  timestamp: string;
  userId?: string;
  userName?: string;
  action: AuditAction;
  entityType: 'switch' | 'showfile' | 'profile' | 'vlan' | 'venue' | 'tour' | 'template' | 'fleet' | 'system';
  entityId: string;
  entityName?: string;
  before?: string; // JSON snapshot
  after?: string; // JSON snapshot
  description: string;
}

export type AuditAction =
  | 'create' | 'update' | 'delete'
  | 'deploy' | 'rollback'
  | 'import' | 'export'
  | 'login' | 'logout'
  | 'assign' | 'unassign';

// ---- Multi-User Roles -------------------------------------------------------

export type UserRole = 'admin' | 'system-engineer' | 'lighting' | 'audio' | 'video' | 'viewer';

export interface UserAccount {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  departmentAccess: AVProtocol[]; // which protocol VLANs they can modify
  canDeploy: boolean;
  canModifyProfiles: boolean;
  canModifyShowFiles: boolean;
  lastLogin?: string;
  createdAt: string;
}

export interface RolePermissions {
  role: UserRole;
  label: string;
  description: string;
  canScan: boolean;
  canModifyVlans: boolean;
  canModifyPorts: boolean;
  canDeploy: boolean;
  canManageFleet: boolean;
  canManageTours: boolean;
  canManageUsers: boolean;
  canExport: boolean;
  departmentRestriction: boolean;
}

// ---- Offline Design ---------------------------------------------------------

export interface OfflineProject {
  id: string;
  name: string;
  description?: string;
  virtualSwitches: VirtualSwitch[];
  vlans: VlanConfig[];
  topology: { nodes: OfflineNode[]; links: OfflineLink[] };
  ipScheme: IPScheme;
  createdAt: string;
  updatedAt: string;
}

export interface VirtualSwitch {
  id: string;
  name: string;
  model: string;
  role?: SwitchRole;
  ip: string;
  portCount: number;
  portConfigs: PortConfig[];
  vlans: VlanConfig[];
  groups?: SwitchGroup[];
}

export interface OfflineNode {
  id: string;
  type: 'switch' | 'endpoint' | 'patch-panel';
  x: number;
  y: number;
  label: string;
}

export interface OfflineLink {
  id: string;
  sourceNodeId: string;
  sourcePort: number;
  targetNodeId: string;
  targetPort: number;
  cableType: CableRun['type'];
  lengthMeters?: number;
}

export interface IPScheme {
  baseSubnet: string;
  vlanSubnets: Record<number, string>; // vlanId → subnet CIDR
  managementRange: { start: string; end: string };
  dhcpRanges?: Record<number, { start: string; end: string }>;
}

// ---- Remote Monitoring ------------------------------------------------------

export interface RemoteSession {
  id: string;
  name: string;
  host: string;
  port: number;
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  lastPing?: string;
  latencyMs?: number;
}

export interface RemoteAlert {
  id: string;
  sessionId?: string;
  type: 'link-down' | 'bandwidth' | 'temperature' | 'poe' | 'firmware' | 'drift' | 'health';
  severity: Severity;
  switchId?: string;
  message: string;
  timestamp: string;
  acknowledged: boolean;
  notificationSent: boolean;
}

// ---- API / Webhook ----------------------------------------------------------

export interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  events: string[];
  enabled: boolean;
  secret?: string;
  lastTriggered?: string;
  failCount: number;
}

export interface APIKeyConfig {
  id: string;
  name: string;
  key: string;
  permissions: string[];
  createdAt: string;
  expiresAt?: string;
  lastUsed?: string;
}
