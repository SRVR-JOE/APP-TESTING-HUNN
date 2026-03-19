// Default network configuration
export const DEFAULT_SUBNET = '192.168.1.0/24';
export const DEFAULT_HTTP_PORT = 80;
export const DEFAULT_HTTPS_PORT = 443;
export const DEFAULT_SNMP_PORT = 161;
export const DEFAULT_WS_PORT = 8080;

// Polling intervals (milliseconds)
export const POLL_INTERVAL_FAST = 2000;
export const POLL_INTERVAL_NORMAL = 5000;
export const POLL_INTERVAL_SLOW = 15000;
export const DISCOVERY_TIMEOUT = 10000;

// Application limits
export const MAX_CONCURRENT_REQUESTS = 10;
export const MAX_EVENT_LOG_ENTRIES = 50000;
export const PORT_STATS_RETENTION_DAYS = 30;

// mDNS / Bonjour service type for GigaCore switches
export const GIGACORE_MDNS_SERVICE = '_gigacore._tcp';
export const GIGACORE_BONJOUR_TYPE = 'gigacore';

// Database
export const DB_FILENAME = 'luminex-configurator.db';

// Health check thresholds
export const HEALTH_THRESHOLDS = {
  errorRateWarning: 0.01,
  errorRateCritical: 0.05,
  poeBudgetWarning: 0.8,
  poeBudgetCritical: 0.95,
  pingLatencyWarning: 50,
  pingLatencyCritical: 200,
} as const;

// View identifiers
export const VIEWS = {
  SCANNER: 'scanner',
  RACK_MAP: 'rackMap',
  TOPOLOGY: 'topology',
  IGMP: 'igmp',
  VLAN_CONFIG: 'vlanConfig',
  DEVICE_DETAIL: 'deviceDetail',
  DISCOVERED_DEVICES: 'discoveredDevices',
  BATCH_CONFIG: 'batchConfig',
  EXCEL_IMPORT: 'excelImport',
  PROFILES: 'profiles',
  NAMING: 'naming',
  SHOW_FILE: 'showFile',
  TOUR_MANAGER: 'tourManager',
  FLEET: 'fleet',
  MULTICAST_FLOW: 'multicastFlow',
  REDUNDANCY: 'redundancy',
  AUDIT_TRAIL: 'auditTrail',
  OFFLINE_DESIGN: 'offlineDesign',
  REMOTE_MONITOR: 'remoteMonitor',
  CABLE_SCHEDULE: 'cableSchedule',
  LOGS: 'logs',
  TROUBLESHOOT: 'troubleshoot',
  SETTINGS: 'settings',
} as const;

export type ViewId = (typeof VIEWS)[keyof typeof VIEWS];

// ---- Protocol VLAN Presets ---------------------------------------------------

import type { LocationType, NamingTemplate, ProtocolVlanPreset, SwitchRoleTemplate, RolePermissions, AVProtocol } from './types';

export const PROTOCOL_VLAN_PRESETS: ProtocolVlanPreset[] = [
  { id: 'pvp-mgmt',       protocol: 'management',      name: 'Management',       description: 'Switch management & control',    vlanId: 1,    subnet: '10.0.0.0/24',     igmpSnooping: false, igmpQuerier: false, color: '#6b7280', icon: 'Settings' },
  { id: 'pvp-dante-pri',  protocol: 'dante-primary',   name: 'Dante Primary',    description: 'Dante audio primary network',    vlanId: 10,   subnet: '10.10.0.0/24',    igmpSnooping: true,  igmpQuerier: true,  qosDscp: 46, priority: 1, color: '#ef4444', icon: 'Music' },
  { id: 'pvp-dante-sec',  protocol: 'dante-secondary', name: 'Dante Secondary',  description: 'Dante audio redundant network',  vlanId: 11,   subnet: '10.11.0.0/24',    igmpSnooping: true,  igmpQuerier: true,  qosDscp: 46, priority: 1, color: '#f87171', icon: 'Music' },
  { id: 'pvp-aes67',      protocol: 'aes67',           name: 'AES67',            description: 'AES67 audio interop',             vlanId: 12,   subnet: '10.12.0.0/24',    igmpSnooping: true,  igmpQuerier: true,  qosDscp: 46, priority: 1, color: '#dc2626', icon: 'Radio' },
  { id: 'pvp-sacn',       protocol: 'sacn',            name: 'sACN (E1.31)',     description: 'Streaming ACN lighting data',     vlanId: 20,   subnet: '10.20.0.0/24',    igmpSnooping: true,  igmpQuerier: true,  color: '#f59e0b', icon: 'Lightbulb' },
  { id: 'pvp-artnet',     protocol: 'artnet',          name: 'Art-Net',          description: 'Art-Net lighting data',           vlanId: 21,   subnet: '10.21.0.0/24',    igmpSnooping: false, igmpQuerier: false, color: '#eab308', icon: 'Zap' },
  { id: 'pvp-ma-net',     protocol: 'ma-net',          name: 'MA-Net',           description: 'MA Lighting console network',     vlanId: 22,   subnet: '10.22.0.0/24',    igmpSnooping: true,  igmpQuerier: false, color: '#a855f7', icon: 'Sliders' },
  { id: 'pvp-ndi',        protocol: 'ndi',             name: 'NDI Video',        description: 'NDI video over IP',               vlanId: 30,   subnet: '10.30.0.0/24',    igmpSnooping: true,  igmpQuerier: true,  color: '#3b82f6', icon: 'Video' },
  { id: 'pvp-st2110',     protocol: 'st2110',          name: 'ST-2110',          description: 'SMPTE ST-2110 broadcast video',   vlanId: 31,   subnet: '10.31.0.0/24',    igmpSnooping: true,  igmpQuerier: true,  qosDscp: 34, priority: 2, color: '#2563eb', icon: 'Tv' },
  { id: 'pvp-avb',        protocol: 'avb',             name: 'AVB/MILAN',        description: 'AVB/MILAN audio transport',       vlanId: 40,   subnet: '10.40.0.0/24',    igmpSnooping: true,  igmpQuerier: false, color: '#14b8a6', icon: 'Waves' },
  { id: 'pvp-comms',      protocol: 'comms',           name: 'Comms/Intercom',   description: 'Production intercom & comms',     vlanId: 50,   subnet: '10.50.0.0/24',    igmpSnooping: false, igmpQuerier: false, color: '#8b5cf6', icon: 'Headphones' },
  { id: 'pvp-video',      protocol: 'video',           name: 'Video Transport',  description: 'General video transport',         vlanId: 60,   subnet: '10.60.0.0/24',    igmpSnooping: true,  igmpQuerier: true,  color: '#0ea5e9', icon: 'Monitor' },
  { id: 'pvp-guest',      protocol: 'guest-wifi',      name: 'Guest WiFi',       description: 'Guest/production WiFi',           vlanId: 99,   subnet: '10.99.0.0/24',    igmpSnooping: false, igmpQuerier: false, color: '#64748b', icon: 'Wifi' },
];

// ---- Switch Role Templates --------------------------------------------------

export const SWITCH_ROLE_TEMPLATES: SwitchRoleTemplate[] = [
  { id: 'role-foh-core',     role: 'foh-core',       name: 'FOH Core',           description: 'Front-of-house core switch — primary aggregation point',    vlanPresets: ['pvp-mgmt', 'pvp-dante-pri', 'pvp-dante-sec', 'pvp-sacn', 'pvp-ma-net', 'pvp-comms'], portRules: [{ portRange: '1-20', mode: 'trunk' }, { portRange: '21-26', mode: 'trunk', label: 'ISL Uplink' }], icon: 'Server', color: '#3b82f6' },
  { id: 'role-foh-distro',   role: 'foh-distro',     name: 'FOH Distribution',   description: 'FOH distribution to local devices',                         vlanPresets: ['pvp-mgmt', 'pvp-dante-pri', 'pvp-sacn'], portRules: [{ portRange: '1-12', mode: 'access' }, { portRange: '13-14', mode: 'trunk', label: 'Uplink' }], icon: 'GitBranch', color: '#60a5fa' },
  { id: 'role-stage-left',   role: 'stage-left',     name: 'Stage Left',         description: 'Stage left rack — audio & lighting',                        vlanPresets: ['pvp-mgmt', 'pvp-dante-pri', 'pvp-sacn', 'pvp-artnet'], portRules: [{ portRange: '1-10', mode: 'access' }, { portRange: '11-14', mode: 'trunk', label: 'Ring' }], icon: 'ArrowLeft', color: '#10b981' },
  { id: 'role-stage-right',  role: 'stage-right',    name: 'Stage Right',        description: 'Stage right rack — audio & lighting',                       vlanPresets: ['pvp-mgmt', 'pvp-dante-pri', 'pvp-sacn', 'pvp-artnet'], portRules: [{ portRange: '1-10', mode: 'access' }, { portRange: '11-14', mode: 'trunk', label: 'Ring' }], icon: 'ArrowRight', color: '#10b981' },
  { id: 'role-mon-world',    role: 'monitor-world',  name: 'Monitor World',      description: 'Monitor engineer position — audio focused',                 vlanPresets: ['pvp-mgmt', 'pvp-dante-pri', 'pvp-dante-sec', 'pvp-comms'], portRules: [{ portRange: '1-16', mode: 'access' }, { portRange: '17-18', mode: 'trunk', label: 'Ring' }], icon: 'Headphones', color: '#f59e0b' },
  { id: 'role-broadcast',    role: 'broadcast',      name: 'Broadcast',          description: 'Broadcast truck / OB van — video & audio',                  vlanPresets: ['pvp-mgmt', 'pvp-dante-pri', 'pvp-ndi', 'pvp-st2110', 'pvp-video'], portRules: [{ portRange: '1-20', mode: 'trunk' }], icon: 'Radio', color: '#ef4444' },
  { id: 'role-delay-tower',  role: 'delay-tower',    name: 'Delay Tower',        description: 'Delay tower — speakers & amps',                             vlanPresets: ['pvp-mgmt', 'pvp-dante-pri', 'pvp-sacn'], portRules: [{ portRange: '1-8', mode: 'access' }, { portRange: '9-10', mode: 'trunk', label: 'Fiber Run' }], icon: 'Tower', color: '#a855f7' },
  { id: 'role-truss',        role: 'truss',          name: 'Truss',              description: 'Truss-mounted switch — lighting fixtures & moving heads',    vlanPresets: ['pvp-mgmt', 'pvp-sacn', 'pvp-artnet'], portRules: [{ portRange: '1-8', mode: 'access', poeEnabled: true }], icon: 'Columns', color: '#f59e0b' },
  { id: 'role-floor',        role: 'floor-distro',   name: 'Floor Distribution', description: 'Floor-level distribution — stage boxes & patch points',      vlanPresets: ['pvp-mgmt', 'pvp-dante-pri', 'pvp-sacn'], portRules: [{ portRange: '1-10', mode: 'access', poeEnabled: true }], icon: 'LayoutGrid', color: '#10b981' },
  { id: 'role-spare',        role: 'spare',          name: 'Spare',              description: 'Pre-configured spare — ready for hot-swap',                  vlanPresets: [], portRules: [], icon: 'Package', color: '#6b7280' },
];

// ---- User Role Permissions --------------------------------------------------

export const ROLE_PERMISSIONS: RolePermissions[] = [
  { role: 'admin',           label: 'Administrator',    description: 'Full system access',                        canScan: true,  canModifyVlans: true,  canModifyPorts: true,  canDeploy: true,  canManageFleet: true,  canManageTours: true,  canManageUsers: true,  canExport: true,  departmentRestriction: false },
  { role: 'system-engineer', label: 'System Engineer',  description: 'Network config & deployment',               canScan: true,  canModifyVlans: true,  canModifyPorts: true,  canDeploy: true,  canManageFleet: true,  canManageTours: true,  canManageUsers: false, canExport: true,  departmentRestriction: false },
  { role: 'lighting',        label: 'Lighting Eng.',    description: 'Lighting VLANs & sACN/Art-Net only',        canScan: true,  canModifyVlans: true,  canModifyPorts: true,  canDeploy: false, canManageFleet: false, canManageTours: false, canManageUsers: false, canExport: true,  departmentRestriction: true },
  { role: 'audio',           label: 'Audio Engineer',   description: 'Audio VLANs & Dante/AES67 only',            canScan: true,  canModifyVlans: true,  canModifyPorts: true,  canDeploy: false, canManageFleet: false, canManageTours: false, canManageUsers: false, canExport: true,  departmentRestriction: true },
  { role: 'video',           label: 'Video Engineer',   description: 'Video VLANs & NDI/ST-2110 only',            canScan: true,  canModifyVlans: true,  canModifyPorts: true,  canDeploy: false, canManageFleet: false, canManageTours: false, canManageUsers: false, canExport: true,  departmentRestriction: true },
  { role: 'viewer',          label: 'Viewer',           description: 'Read-only monitoring access',               canScan: true,  canModifyVlans: false, canModifyPorts: false, canDeploy: false, canManageFleet: false, canManageTours: false, canManageUsers: false, canExport: true,  departmentRestriction: false },
];

// ---- Department Protocol Access ---------------------------------------------

export const DEPARTMENT_PROTOCOLS: Record<string, AVProtocol[]> = {
  lighting: ['sacn', 'artnet', 'ma-net'],
  audio: ['dante-primary', 'dante-secondary', 'aes67', 'avb'],
  video: ['ndi', 'st2110', 'video'],
};

// ---- Naming Ideology --------------------------------------------------------

export const LOCATION_TYPE_CONFIG: Record<LocationType, { label: string; color: string }> = {
  truss: { label: 'Truss', color: '#f59e0b' },
  rack:  { label: 'Rack',  color: '#3b82f6' },
  floor: { label: 'Floor', color: '#10b981' },
};

export const NAMING_PRESETS: Omit<NamingTemplate, 'createdAt' | 'updatedAt'>[] = [
  { id: 'preset-sr-dimmer',   name: 'SR Dimmer',     locationType: 'rack',  pattern: 'SR DIMMER {number}',    variables: { number: '01' }, isBuiltIn: true },
  { id: 'preset-sl-dimmer',   name: 'SL Dimmer',     locationType: 'rack',  pattern: 'SL DIMMER {number}',    variables: { number: '01' }, isBuiltIn: true },
  { id: 'preset-tower',       name: 'Tower',          locationType: 'truss', pattern: 'TOWER {number}',        variables: { number: '01' }, isBuiltIn: true },
  { id: 'preset-foh',         name: 'FOH',            locationType: 'rack',  pattern: 'FOH {number}',          variables: { number: '01' }, isBuiltIn: true },
  { id: 'preset-understage',  name: 'Understage',     locationType: 'floor', pattern: 'UNDERSTAGE {number}',   variables: { number: '01' }, isBuiltIn: true },
  { id: 'preset-floor',       name: 'Floor',          locationType: 'floor', pattern: 'FLOOR {number}',        variables: { number: '01' }, isBuiltIn: true },
  { id: 'preset-truss',       name: 'Truss',          locationType: 'truss', pattern: 'TRUSS {number}',        variables: { number: '01' }, isBuiltIn: true },
];
