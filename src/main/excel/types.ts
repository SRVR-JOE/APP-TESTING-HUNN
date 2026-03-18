// ── Excel Import/Export Engine — Type Definitions ────────────────────────────
// All TypeScript interfaces for the GigaCore Excel system.

export interface ExcelIPScheme {
  switches: ExcelSwitchEntry[];
  portAssignments: ExcelPortAssignment[];
  groupDefinitions: ExcelGroupDefinition[];
}

export interface ExcelSwitchEntry {
  switchName: string;
  model: string;
  managementIp: string;
  subnet: string;
  gateway: string;
  vlanMgmt: number;
  locationRack: string;
}

export interface ExcelPortAssignment {
  switchName: string;
  port: string; // "1", "2", "4-8", "ISL1"
  groupVlan: string; // Group name or VLAN ID
  label: string;
  notes: string;
}

export interface ExcelGroupDefinition {
  groupNumber: number;
  name: string;
  vlanId: number;
  color: string;
  igmpSnooping: boolean;
  igmpQuerier: boolean;
  unknownFlooding: boolean;
}

export interface ExcelProfile {
  switchName: string;
  profileName: string;
  profileDescription: string;
  portConfigs: ExcelPortConfig[];
  groups: ExcelGroupDefinition[];
}

export interface ExcelPortConfig {
  port: number;
  label: string;
  groupVlan: string;
  mode: 'access' | 'trunk';
  trunkGroups: string;
  poeEnabled: boolean;
  speed: string;
  igmpSnooping: boolean;
  notes: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  sheet: string;
  row: number;
  column: string;
  message: string;
  value?: string;
}

export interface ValidationWarning {
  sheet: string;
  row: number;
  column: string;
  message: string;
  value?: string;
}

export interface DeployPlan {
  switches: DeploySwitchPlan[];
  groupsToCreate: ExcelGroupDefinition[];
  totalChanges: number;
}

export interface DeploySwitchPlan {
  switchName: string;
  switchIp: string;
  matched: boolean;
  changes: DeployChange[];
}

export interface DeployChange {
  type: 'ip' | 'group' | 'port' | 'poe' | 'igmp' | 'name';
  description: string;
  currentValue?: string;
  newValue: string;
  port?: number;
}

export interface DeployResult {
  success: boolean;
  switchResults: SwitchDeployResult[];
  totalChanges: number;
  totalErrors: number;
}

export interface SwitchDeployResult {
  switchName: string;
  success: boolean;
  changesApplied: number;
  errors: string[];
  backup?: SwitchBackup;
}

export interface SwitchBackup {
  switchName: string;
  switchIp: string;
  timestamp: string;
  configSnapshot: Record<string, unknown>;
}

export interface VerificationResult {
  allVerified: boolean;
  switchVerifications: SwitchVerification[];
}

export interface SwitchVerification {
  switchName: string;
  verified: boolean;
  mismatches: string[];
}

/** Represents a switch discovered on the network. */
export interface DiscoveredSwitch {
  name: string;
  ip: string;
  model: string;
  mac: string;
  groups?: DiscoveredGroup[];
  ports?: DiscoveredPort[];
}

export interface DiscoveredGroup {
  groupNumber: number;
  name: string;
  vlanId: number;
  igmpSnooping: boolean;
  igmpQuerier: boolean;
  unknownFlooding: boolean;
}

export interface DiscoveredPort {
  port: number;
  label: string;
  groupVlan: string;
  mode: 'access' | 'trunk';
  trunkGroups: string;
  poeEnabled: boolean;
  speed: string;
}

/** Minimal client interface expected by the deploy engine. */
export interface GigaCoreClient {
  getConfig(): Promise<Record<string, unknown>>;
  setSwitchName(name: string): Promise<void>;
  setManagementIp(ip: string, subnet: string, gateway: string): Promise<void>;
  setManagementVlan(vlanId: number): Promise<void>;
  createGroup(group: {
    groupNumber: number;
    name: string;
    vlanId: number;
    igmpSnooping: boolean;
    igmpQuerier: boolean;
    unknownFlooding: boolean;
  }): Promise<void>;
  setPortGroup(port: number, groupNumber: number): Promise<void>;
  setPortMode(port: number, mode: 'access' | 'trunk'): Promise<void>;
  setPortTrunkGroups(port: number, groups: number[]): Promise<void>;
  setPortPoe(port: number, enabled: boolean): Promise<void>;
  setPortSpeed(port: number, speed: string): Promise<void>;
  saveConfig(): Promise<void>;
}

/** Valid GigaCore model identifiers. */
export const GIGACORE_MODELS = [
  'GC-10',
  'GC-10i',
  'GC-14R',
  'GC-16t',
  'GC-16i',
  'GC-18t',
  'GC-20t',
  'GC-26',
  'GC-30i',
] as const;

export type GigaCoreModel = (typeof GIGACORE_MODELS)[number];

/** Port count per model (copper + SFP). */
export const MODEL_PORT_COUNTS: Record<GigaCoreModel, { copper: number; sfp: number; isl: number }> = {
  'GC-10': { copper: 8, sfp: 2, isl: 0 },
  'GC-10i': { copper: 8, sfp: 2, isl: 0 },
  'GC-14R': { copper: 12, sfp: 2, isl: 0 },
  'GC-16t': { copper: 12, sfp: 4, isl: 0 },
  'GC-16i': { copper: 12, sfp: 4, isl: 0 },
  'GC-18t': { copper: 12, sfp: 4, isl: 2 },
  'GC-20t': { copper: 16, sfp: 4, isl: 0 },
  'GC-26': { copper: 20, sfp: 4, isl: 2 },
  'GC-30i': { copper: 24, sfp: 4, isl: 2 },
};

/** Solotech default group definitions. */
export const SOLOTECH_DEFAULT_GROUPS: ExcelGroupDefinition[] = [
  { groupNumber: 1, name: 'Mgmt', vlanId: 100, color: 'Blue', igmpSnooping: false, igmpQuerier: false, unknownFlooding: true },
  { groupNumber: 2, name: 'D3 Net', vlanId: 10, color: 'Green', igmpSnooping: false, igmpQuerier: false, unknownFlooding: true },
  { groupNumber: 3, name: 'NDI', vlanId: 30, color: 'Cyan', igmpSnooping: true, igmpQuerier: true, unknownFlooding: false },
  { groupNumber: 4, name: 'Dante Pri', vlanId: 1300, color: 'Red', igmpSnooping: true, igmpQuerier: false, unknownFlooding: false },
  { groupNumber: 5, name: 'Dante Sec', vlanId: 1301, color: 'Orange', igmpSnooping: true, igmpQuerier: false, unknownFlooding: false },
  { groupNumber: 6, name: 'Art-Net', vlanId: 40, color: 'Purple', igmpSnooping: false, igmpQuerier: false, unknownFlooding: true },
  { groupNumber: 7, name: 'Intercom', vlanId: 50, color: 'Yellow', igmpSnooping: false, igmpQuerier: false, unknownFlooding: true },
  { groupNumber: 8, name: 'Control', vlanId: 100, color: 'Gray', igmpSnooping: false, igmpQuerier: false, unknownFlooding: true },
];

/** Standard dropdown colors for group color column. */
export const GROUP_COLORS = [
  'Red',
  'Orange',
  'Yellow',
  'Green',
  'Cyan',
  'Blue',
  'Purple',
  'Gray',
  'White',
  'Black',
] as const;
