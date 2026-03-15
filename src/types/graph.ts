// SignalGraph — Frontend TypeScript type definitions
// These mirror the Rust backend models for Tauri IPC.

export type EntityId = string; // UUID

// === Device Types ===

export type DeviceType =
  | 'video_switcher' | 'video_router' | 'video_processor' | 'video_scaler'
  | 'audio_mixer' | 'audio_dsp' | 'audio_amplifier' | 'audio_router'
  | 'media_server' | 'record_playback' | 'camera' | 'display'
  | 'led_processor' | 'lighting_console' | 'lighting_node'
  | 'network_switch' | 'network_router'
  | 'control_processor' | 'show_controller'
  | 'signal_converter' | 'signal_distributor'
  | 'multiviewer' | 'stream_encoder' | 'stream_decoder'
  | 'intercom_station' | 'wireless_receiver'
  | 'power_distributor' | 'kvm' | 'unknown';

export type DeviceStatus = 'online' | 'offline' | 'error' | 'unknown';

export interface Location {
  venue?: string;
  room?: string;
  rack?: string;
  rack_unit?: number;
  rack_side?: 'front' | 'rear';
  shelf?: string;
  notes?: string;
}

export interface Device {
  id: EntityId;
  connector_id: string;
  vendor: string;
  model: string;
  firmware_version?: string;
  serial_number?: string;
  hostname?: string;
  ip_addresses: string[];
  mac_addresses: string[];
  device_type: DeviceType;
  location: Location;
  labels: string[];
  capabilities: string[];
  status: DeviceStatus;
  last_seen: number;
  discovered_at: number;
  metadata: Record<string, unknown>;
}

// === Port & Signal Types ===

export type PortDirection = 'input' | 'output' | 'bidirectional';
export type PortStatus = 'active' | 'inactive' | 'error' | 'no_signal' | 'unknown';
export type SignalType = 'video' | 'audio' | 'data' | 'control' | 'mixed';

export type PortType =
  | 'hdmi' | 'sdi' | 'sdi_12g' | 'displayport' | 'dvi' | 'vga'
  | 'hdbaset' | 'fiber' | 'xlr' | 'trs' | 'rca' | 'aes3' | 'madi'
  | 'dante_audio' | 'aes67' | 'ethernet' | 'sfp' | 'sfp_plus' | 'qsfp'
  | 'usb' | 'rs232' | 'rs422' | 'rs485' | 'gpio' | 'dmx'
  | 'ndi' | 'srt' | 'rtmp' | 'st2110' | 'nmos';

export interface SignalFormat {
  resolution?: string;
  frame_rate?: number;
  color_space?: string;
  bit_depth?: number;
  sample_rate?: number;
  channels?: number;
  codec?: string;
  bandwidth_mbps?: number;
}

export interface Port {
  id: EntityId;
  device_id: EntityId;
  direction: PortDirection;
  port_index: number;
  port_type: PortType;
  signal_type: SignalType;
  label?: string;
  status: PortStatus;
  current_format?: SignalFormat;
  connected_to?: EntityId;
}

// === Route & Signal Chain ===

export type RouteMedium = 'cable' | 'network' | 'internal' | 'wireless';
export type RouteQuality = 'good' | 'degraded' | 'error' | 'unknown';
export type ChainStatus = 'healthy' | 'degraded' | 'broken' | 'unknown';

export interface Route {
  id: EntityId;
  source_port_id: EntityId;
  dest_port_id: EntityId;
  signal_type: SignalType;
  active: boolean;
  medium: RouteMedium;
  cable_id?: string;
  latency_ms?: number;
  quality: RouteQuality;
}

export interface SignalChain {
  id: EntityId;
  name: string;
  route_ids: EntityId[];
  source_device_id: EntityId;
  dest_device_id: EntityId;
  signal_type: SignalType;
  status: ChainStatus;
  break_point?: EntityId;
  total_latency_ms?: number;
}

// === Graph Node (for topology view) ===

export interface GraphNode {
  device: Device;
  ports: Port[];
}

export interface GraphStats {
  total_devices: number;
  online_devices: number;
  total_ports: number;
  total_routes: number;
}

// === AI / CoPilot ===

export type SafetyLevel = 'read_only' | 'config_change' | 'critical_change' | 'bulk_change';

export interface AiResponse {
  answer: string;
  tool_calls: ToolCallResult[];
  confidence: number;
  evidence: string[];
  suggested_followups: string[];
  pending_approval?: PendingApproval;
}

export interface ToolCallResult {
  tool_name: string;
  success: boolean;
  result: unknown;
  explanation: string;
  safety_level: SafetyLevel;
  approval_required: boolean;
  rollback_available: boolean;
}

export interface PendingApproval {
  action_description: string;
  impact_description: string;
  diff_preview?: string;
  safety_level: SafetyLevel;
  rollback_description?: string;
}

// === Troubleshooting ===

export interface Diagnosis {
  issue: string;
  signal_chain: HopStatus[];
  break_point?: BreakPoint;
  probable_causes: ProbableCause[];
  recommended_actions: RecommendedAction[];
  confidence: number;
  evidence: string[];
}

export interface HopStatus {
  device_id: EntityId;
  device_name: string;
  port_id: EntityId;
  port_label: string;
  status: PortStatus;
  signal_present: boolean;
  format?: string;
  errors: string[];
}

export interface BreakPoint {
  between_device_a: EntityId;
  between_device_b: EntityId;
  description: string;
}

export interface ProbableCause {
  rank: number;
  description: string;
  probability: number;
  evidence: string[];
  category: string;
}

export interface RecommendedAction {
  rank: number;
  description: string;
  action_type: string;
  requires_approval: boolean;
  estimated_downtime?: string;
  rollback_available: boolean;
}

// === Labeling ===

export type LabelEntityType = 'device' | 'port' | 'cable' | 'rack' | 'endpoint';

export interface GeneratedLabel {
  entity_id: EntityId;
  entity_type: LabelEntityType;
  label: string;
  previous_label?: string;
  auto_generated: boolean;
  needs_review: boolean;
}

// === Audit ===

export type ChangeActor = 'user' | 'ai' | 'system' | 'external';

export interface ChangeRecord {
  id: EntityId;
  timestamp: number;
  actor: ChangeActor;
  action_type: string;
  target_device?: EntityId;
  description: string;
  before_state?: unknown;
  after_state?: unknown;
  rollback_status: 'available' | 'expired' | 'executed' | 'invalidated';
}

// === Discovery ===

export interface DiscoveryEvent {
  type: 'scan_started' | 'device_found' | 'device_identified' | 'scan_progress' | 'scan_complete' | 'scan_error';
  data: unknown;
}

export interface ScanConfig {
  networks: string[];
  timeout_ms: number;
  include_snmp: boolean;
  include_mdns: boolean;
  include_dante: boolean;
  include_ndi: boolean;
}

// === Alarm ===

export type AlarmSeverity = 'info' | 'warning' | 'critical';

export interface Alarm {
  id: EntityId;
  device_id: EntityId;
  port_id?: EntityId;
  severity: AlarmSeverity;
  alarm_type: string;
  message: string;
  first_seen: number;
  last_seen: number;
  acknowledged: boolean;
  resolved: boolean;
}
