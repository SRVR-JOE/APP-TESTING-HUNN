// ============================================================
// GigaCore Command — Shared Type Definitions
// ============================================================

// Re-export shared types used by logging components
export type { EventCategory, Severity, EventLogEntry, PortStats } from '../../shared/types';

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

export type HealthStatus = 'healthy' | 'warning' | 'critical' | 'offline';

export interface SwitchInfo {
  id: string;
  name: string;
  model: string;
  ip: string;
  mac: string;
  firmware: string;
  status: HealthStatus;
  ports: PortInfo[];
  poeBudgetWatts: number;
  poeDrawWatts: number;
  uptime?: string;
  location?: string;
  rackGroup?: string;
  lastSeen: string;
}

export interface DiscoveredDevice {
  id: string;
  name: string;
  hostname?: string;
  ip: string;
  mac: string;
  manufacturer: string;
  protocol: 'Dante' | 'NDI' | 'Art-Net' | 'AES67' | 'unknown';
  connectedSwitch?: string;
  connectedPort?: number;
  status: 'online' | 'offline';
  lastSeen: string;
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

export interface ElectronAPI {
  scanSubnet: (subnet: string) => Promise<SwitchInfo[]>;
  getSwitches: () => Promise<SwitchInfo[]>;
  getDiscoveredDevices: () => Promise<DiscoveredDevice[]>;
  pingSwitch: (ip: string) => Promise<{ alive: boolean; latency: number }>;
  openWebUI: (ip: string) => void;
  exportCSV: (data: unknown[], filename: string) => Promise<void>;
  getLocalSubnets: () => Promise<string[]>;
  onScanProgress: (callback: (progress: number) => void) => () => void;
  onSwitchUpdate: (callback: (switches: SwitchInfo[]) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
