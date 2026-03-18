// ============================================================
// Luminex Configurator — Renderer Type Definitions
// ============================================================

// Re-export all shared types as the single source of truth
export type {
  EventCategory,
  Severity,
  HealthStatus,
  SwitchGeneration,
  DiscoveredSwitch,
  DiscoveredDevice,
  EventLogEntry,
  PortStats,
  LogFilters,
  EventLogStats,
  SwitchGroup,
  SwitchPort,
  RackGroup,
  MapLayout,
  MapConnection,
  ShowPreset,
  SwitchPresetConfig,
  PortOverride,
  SwitchProfile,
  PortConfig,
  VlanConfig,
  HealthCheckResult,
  HealthCheck,
} from '../../shared/types';

// ---- Renderer-specific types ------------------------------------------------

/**
 * SwitchInfo is the renderer-side view-model for a discovered switch,
 * shaped for UI components (SwitchCard, ScannerView, etc.).
 */
export interface SwitchInfo {
  id: string;
  name: string;
  model: string;
  ip: string;
  mac: string;
  firmware: string;
  status: 'healthy' | 'warning' | 'critical' | 'offline';
  ports: PortInfo[];
  poeBudgetWatts: number;
  poeDrawWatts: number;
  uptime?: string;
  location?: string;
  rackGroup?: string;
  lastSeen: string;
}

/**
 * Renderer-side ElectronAPI surface used by hooks/useElectronAPI.
 * Covers the mock API methods consumed throughout the renderer.
 */
export interface ElectronAPI {
  scanSubnet: (subnet: string) => Promise<SwitchInfo[]>;
  getSwitches: () => Promise<SwitchInfo[]>;
  getDiscoveredDevices: () => Promise<import('../../shared/types').DiscoveredDevice[]>;
  pingSwitch: (ip: string) => Promise<{ alive: boolean; latency: number }>;
  openWebUI: (ip: string) => void;
  exportCSV: (data: unknown[], filename: string) => Promise<void>;
  getLocalSubnets: () => Promise<string[]>;
  onScanProgress: (cb: (progress: number) => void) => () => void;
  onSwitchUpdate: (cb: (switches: SwitchInfo[]) => void) => () => void;
}

export interface PortInfo {
  port: number;
  label: string;
  adminStatus: 'up' | 'down';
  operStatus: 'up' | 'down';
  speed: string;
  type: 'copper' | 'sfp' | 'sfp+';
  groupId?: number;
  groupName?: string;
  groupColor?: string;
  poeEnabled?: boolean;
  poeWatts?: number;
}

export interface FilterDefinition {
  key: string;
  label: string;
  options: { value: string; label: string }[];
}

export interface SortOption {
  value: string;
  label: string;
}
