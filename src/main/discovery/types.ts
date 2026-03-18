export interface DiscoveredSwitch {
  id: string;
  name: string;
  model: string;
  ip: string;
  mac: string;
  firmware: string;
  generation: 1 | 2;
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
  healthStatus: 'healthy' | 'warning' | 'critical' | 'offline';
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

export interface MdnsDiscoveryResult {
  name: string;
  ip: string;
  port: number;
  type: string;
  txt: Record<string, string>;
}

export interface SubnetScanResult {
  ip: string;
  isGigaCore: boolean;
  model?: string;
  name?: string;
  firmware?: string;
  generation?: 1 | 2;
  mac?: string;
  responseTimeMs: number;
}

export interface SubnetScanOptions {
  concurrency?: number;
  timeoutMs?: number;
  onProgress?: (scanned: number, total: number) => void;
  onFound?: (result: SubnetScanResult) => void;
  signal?: AbortSignal;
}

export interface LldpNeighbor {
  localPort: number;
  remoteChassisId: string;
  remotePortId: string;
  remotePortDesc?: string;
  remoteSysName?: string;
  remoteSysDesc?: string;
  remoteMgmtAddr?: string;
}

export interface TopologyLink {
  sourceSwitch: string;
  sourcePort: number;
  targetSwitch: string;
  targetPort: number;
  linkSpeed?: string;
}

export interface LocalSubnet {
  address: string;
  cidr: string;
  netmask: string;
}

/**
 * Port counts by GigaCore model identifier.
 */
export const GIGACORE_PORT_COUNTS: Record<string, number> = {
  'GigaCore 10': 12,
  'GigaCore 12': 12,
  'GigaCore 14R': 14,
  'GigaCore 14r': 14,
  'GigaCore 16t': 16,
  'GigaCore 16RFO': 16,
  'GigaCore 16Xt': 16,
  'GigaCore 18t': 18,
  'GigaCore 20t': 20,
  'GigaCore 26i': 26,
  'GigaCore 30i': 30,
};

/**
 * Derive a port count from a model string by matching known models.
 */
export function getPortCountForModel(model: string): number {
  for (const [key, count] of Object.entries(GIGACORE_PORT_COUNTS)) {
    if (model.toLowerCase().includes(key.toLowerCase())) {
      return count;
    }
  }
  // Attempt to extract a number from the model string (e.g. "GigaCore 26" -> 26)
  const match = model.match(/(\d+)/);
  if (match) {
    const num = parseInt(match[1], 10);
    if (num >= 8 && num <= 48) return num;
  }
  return 0;
}
