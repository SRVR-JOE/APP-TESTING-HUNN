// ============================================================================
// GigaCore Command — API Type Definitions
// All TypeScript interfaces for GigaCore switch API request/response payloads.
// ============================================================================

// ---------------------------------------------------------------------------
// Error Types
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  public readonly code: string;
  public readonly switchIp: string;
  public readonly statusCode?: number;

  constructor(
    message: string,
    code: string,
    switchIp: string,
    statusCode?: number,
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.switchIp = switchIp;
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

/** Well-known API error codes */
export const ApiErrorCode = {
  TIMEOUT: 'TIMEOUT',
  NETWORK_ERROR: 'NETWORK_ERROR',
  AUTH_FAILED: 'AUTH_FAILED',
  NOT_FOUND: 'NOT_FOUND',
  RATE_LIMITED: 'RATE_LIMITED',
  INVALID_RESPONSE: 'INVALID_RESPONSE',
  FIRMWARE_UPLOAD_FAILED: 'FIRMWARE_UPLOAD_FAILED',
  UNSUPPORTED_OPERATION: 'UNSUPPORTED_OPERATION',
  SWITCH_ERROR: 'SWITCH_ERROR',
} as const;

export type ApiErrorCodeType = (typeof ApiErrorCode)[keyof typeof ApiErrorCode];

// ---------------------------------------------------------------------------
// System
// ---------------------------------------------------------------------------

export interface SwitchSystemInfo {
  name: string;
  model: string;
  firmware: string;
  mac: string;
  serial: string;
  generation: 1 | 2;
  uptime: number;
  temperature?: number;
}

// ---------------------------------------------------------------------------
// Ports
// ---------------------------------------------------------------------------

export type PortAdminStatus = 'up' | 'down';
export type PortOperStatus = 'up' | 'down';
export type PortType = 'copper' | 'sfp' | 'sfp+';
export type VlanMode = 'access' | 'trunk';
export type PortSpeed = 'auto' | '100M' | '1G' | '10G';
export type PoeStatus = 'delivering' | 'disabled' | 'searching' | 'fault';

export interface PortLldpNeighbor {
  name: string;
  mac: string;
  portDesc: string;
}

export interface PortInfo {
  port: number;
  label: string;
  adminStatus: PortAdminStatus;
  operStatus: PortOperStatus;
  speed: string;
  duplex: string;
  type: PortType;
  groupId?: number;
  vlanMode?: VlanMode;
  trunkGroups?: number[];
  poeEnabled?: boolean;
  poeStatus?: PoeStatus;
  poeWatts?: number;
  poeClass?: number;
  lldpNeighbor?: PortLldpNeighbor;
}

// ---------------------------------------------------------------------------
// Groups (VLANs)
// ---------------------------------------------------------------------------

export interface GroupConfig {
  id: number;
  name: string;
  vlanId: number;
  color: string;
  igmpSnooping: boolean;
  igmpQuerier: boolean;
  unknownFlooding: boolean;
}

// ---------------------------------------------------------------------------
// PoE
// ---------------------------------------------------------------------------

export type PoePriority = 'low' | 'high' | 'critical';

export interface PoePortInfo {
  port: number;
  enabled: boolean;
  status: string;
  watts: number;
  maxWatts: number;
  poeClass: number;
}

export interface PoeSummary {
  available: boolean;
  totalBudgetWatts: number;
  totalDrawWatts: number;
  ports: PoePortInfo[];
}

// ---------------------------------------------------------------------------
// IGMP
// ---------------------------------------------------------------------------

export interface IgmpGroupConfig {
  groupId: number;
  snoopingEnabled: boolean;
  querierEnabled: boolean;
  querierIp?: string;
  queryInterval?: number;
}

export interface IgmpConfig {
  globalEnabled: boolean;
  perGroup: IgmpGroupConfig[];
}

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------

export interface SwitchProfileSlot {
  slot: number;
  name: string;
  isEmpty: boolean;
  lastStored?: string;
}

// ---------------------------------------------------------------------------
// LLDP
// ---------------------------------------------------------------------------

export interface LldpNeighborInfo {
  localPort: number;
  chassisId: string;
  portId: string;
  portDescription?: string;
  systemName?: string;
  systemDescription?: string;
  managementAddress?: string;
  capabilities?: string[];
}

// ---------------------------------------------------------------------------
// Port Statistics
// ---------------------------------------------------------------------------

export interface PortStatistics {
  port: number;
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
}

// ---------------------------------------------------------------------------
// rLinkX (redundancy ring)
// ---------------------------------------------------------------------------

export type RlinkxRole = 'master' | 'slave' | 'disabled';
export type RlinkxRingState = 'closed' | 'open' | 'disabled';

export interface RlinkxStatus {
  enabled: boolean;
  role: RlinkxRole;
  ringState: RlinkxRingState;
  partnerIp?: string;
  failoverCount: number;
}

// ---------------------------------------------------------------------------
// IP Configuration
// ---------------------------------------------------------------------------

export interface IpConfig {
  ip: string;
  subnet: string;
  gateway: string;
  dhcp: boolean;
}

// ---------------------------------------------------------------------------
// Auth / Credentials
// ---------------------------------------------------------------------------

export interface SwitchCredentials {
  switchId: string;
  username: string;
  password: string;
}

// ---------------------------------------------------------------------------
// Batch Operations
// ---------------------------------------------------------------------------

export interface BatchOperation {
  switchIp: string;
  operation: string;
  params: any;
}

export interface BatchResult {
  switchIp: string;
  operation: string;
  success: boolean;
  error?: string;
  rollbackData?: any;
}

export interface BatchProgress {
  total: number;
  completed: number;
  failed: number;
  current: string;
}

// ---------------------------------------------------------------------------
// WebSocket
// ---------------------------------------------------------------------------

export type WsTopic = 'ports' | 'poe' | 'system' | 'groups' | 'lldp';

export type WsConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting';

export interface WsMessage {
  topic: WsTopic;
  data: unknown;
  timestamp?: string;
}

// ---------------------------------------------------------------------------
// Logging Hook
// ---------------------------------------------------------------------------

export interface RequestLogEntry {
  method: string;
  url: string;
  switchIp: string;
  generation: 1 | 2;
  durationMs: number;
  statusCode?: number;
  error?: string;
}

export type RequestLogHook = (entry: RequestLogEntry) => void;
