import { useState, useEffect, useCallback, useRef } from 'react';
import type { PortInfo } from '../types';

// ---------------------------------------------------------------------------
// Renderer-specific mock types (not shared with main process)
// ---------------------------------------------------------------------------

/** Switch shape used exclusively by the renderer mock / discovery hooks. */
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

/** Device shape used exclusively by the renderer mock / discovery hooks. */
interface MockDiscoveredDevice {
  id: string;
  name: string;
  hostname?: string;
  ip: string;
  mac: string;
  manufacturer: string;
  protocol: string;
  connectedSwitch: string;
  connectedPort: number;
  status: 'online' | 'offline';
  lastSeen: string;
}

/** Scan progress payload from the main process. */
export interface ScanProgressPayload {
  scanned: number;
  total: number;
}

/** Mock-only API surface used when running outside Electron. */
interface MockElectronAPI {
  scanSubnet: (subnet: string) => Promise<SwitchInfo[]>;
  getSwitches: () => Promise<SwitchInfo[]>;
  getDiscoveredDevices: () => Promise<MockDiscoveredDevice[]>;
  pingSwitch: (ip: string) => Promise<{ alive: boolean; latency: number }>;
  openWebUI: (ip: string) => void;
  exportCSV: () => Promise<void>;
  getLocalSubnets: () => Promise<string[]>;
  getSwitchDetails: (switchId: string) => Promise<any>;
  onScanProgress: (cb: (progress: ScanProgressPayload) => void) => () => void;
  onSwitchUpdate: () => () => void;
}

// ---------------------------------------------------------------------------
// Mock data for development without Electron
// ---------------------------------------------------------------------------

function generateMockPorts(count: number, sfpCount: number) {
  const ports = [];
  for (let i = 1; i <= count - sfpCount; i++) {
    const isUp = Math.random() > 0.3;
    ports.push({
      port: i,
      label: `${i}`,
      adminStatus: 'up' as const,
      operStatus: isUp ? ('up' as const) : ('down' as const),
      speed: isUp ? '1G' : '',
      type: 'copper' as const,
      groupId: Math.ceil(Math.random() * 4),
      groupName: `VLAN ${Math.ceil(Math.random() * 4)}`,
      poeEnabled: true,
      poeWatts: isUp ? Math.floor(Math.random() * 30) : 0,
    });
  }
  for (let i = count - sfpCount + 1; i <= count; i++) {
    const isUp = Math.random() > 0.5;
    ports.push({
      port: i,
      label: `SFP${i - count + sfpCount}`,
      adminStatus: 'up' as const,
      operStatus: isUp ? ('up' as const) : ('down' as const),
      speed: isUp ? '10G' : '',
      type: 'sfp+' as const,
      groupId: 1,
      groupName: 'Trunk',
      poeEnabled: false,
    });
  }
  return ports;
}

const MOCK_SWITCHES: SwitchInfo[] = [
  {
    id: 'gc30i-001',
    name: 'FOH-Main-01',
    model: 'GC-30i',
    ip: '192.168.1.10',
    mac: '00:1A:2B:3C:4D:01',
    firmware: '2.5.1',
    status: 'healthy',
    ports: generateMockPorts(30, 6),
    poeBudgetWatts: 370,
    poeDrawWatts: 180,
    uptime: '14d 7h 32m',
    location: 'Stage Left',
    rackGroup: 'FOH Rack A',
    lastSeen: new Date().toISOString(),
  },
  {
    id: 'gc30i-002',
    name: 'Stage-Right-02',
    model: 'GC-30i',
    ip: '192.168.1.11',
    mac: '00:1A:2B:3C:4D:02',
    firmware: '2.5.1',
    status: 'warning',
    ports: generateMockPorts(30, 6),
    poeBudgetWatts: 370,
    poeDrawWatts: 330,
    uptime: '3d 12h 5m',
    location: 'Stage Right',
    rackGroup: 'Stage Rack B',
    lastSeen: new Date().toISOString(),
  },
  {
    id: 'gc16t-001',
    name: 'Monitor-World-01',
    model: 'GC-16t',
    ip: '192.168.1.20',
    mac: '00:1A:2B:3C:4D:03',
    firmware: '2.4.3',
    status: 'healthy',
    ports: generateMockPorts(16, 4),
    poeBudgetWatts: 240,
    poeDrawWatts: 85,
    uptime: '30d 2h 17m',
    location: 'Monitor World',
    rackGroup: 'MON Rack',
    lastSeen: new Date().toISOString(),
  },
  {
    id: 'gc10i-001',
    name: 'Broadcast-TX',
    model: 'GC-10i',
    ip: '192.168.1.30',
    mac: '00:1A:2B:3C:4D:04',
    firmware: '2.5.0',
    status: 'critical',
    ports: generateMockPorts(10, 2),
    poeBudgetWatts: 0,
    poeDrawWatts: 0,
    uptime: '0d 0h 45m',
    rackGroup: 'Broadcast',
    lastSeen: new Date().toISOString(),
  },
  {
    id: 'gc14r-001',
    name: 'Amp-Room-01',
    model: 'GC-14R',
    ip: '192.168.1.40',
    mac: '00:1A:2B:3C:4D:05',
    firmware: '2.3.8',
    status: 'offline',
    ports: generateMockPorts(14, 2),
    poeBudgetWatts: 180,
    poeDrawWatts: 0,
    lastSeen: new Date(Date.now() - 600000).toISOString(),
  },
  {
    id: 'gc16t-002',
    name: 'Green-Room-SW',
    model: 'GC-16t',
    ip: '192.168.1.21',
    mac: '00:1A:2B:3C:4D:06',
    firmware: '2.4.3',
    status: 'healthy',
    ports: generateMockPorts(16, 4),
    poeBudgetWatts: 240,
    poeDrawWatts: 42,
    uptime: '7d 19h 3m',
    rackGroup: 'Backstage',
    lastSeen: new Date().toISOString(),
  },
];

const MOCK_DEVICES: MockDiscoveredDevice[] = [
  {
    id: 'dev-001',
    name: 'Dante-Stagebox-1',
    hostname: 'rio3224d-01',
    ip: '192.168.1.100',
    mac: '00:1D:C1:AA:BB:01',
    manufacturer: 'Yamaha',
    protocol: 'Dante',
    connectedSwitch: 'FOH-Main-01',
    connectedPort: 3,
    status: 'online',
    lastSeen: new Date().toISOString(),
  },
  {
    id: 'dev-002',
    name: 'NDI-Camera-A',
    hostname: 'ptz-cam-01',
    ip: '192.168.1.101',
    mac: '00:50:C2:CC:DD:02',
    manufacturer: 'PTZOptics',
    protocol: 'NDI',
    connectedSwitch: 'Broadcast-TX',
    connectedPort: 1,
    status: 'online',
    lastSeen: new Date().toISOString(),
  },
  {
    id: 'dev-003',
    name: 'Console-CL5',
    hostname: 'cl5-main',
    ip: '192.168.1.102',
    mac: '00:1D:C1:EE:FF:03',
    manufacturer: 'Yamaha',
    protocol: 'Dante',
    connectedSwitch: 'FOH-Main-01',
    connectedPort: 5,
    status: 'online',
    lastSeen: new Date().toISOString(),
  },
  {
    id: 'dev-004',
    name: 'Art-Net-Node-1',
    ip: '192.168.1.150',
    mac: '00:23:8B:11:22:04',
    manufacturer: 'Luminex',
    protocol: 'Art-Net',
    connectedSwitch: 'Stage-Right-02',
    connectedPort: 8,
    status: 'online',
    lastSeen: new Date().toISOString(),
  },
  {
    id: 'dev-005',
    name: 'Dante-Amp-1',
    hostname: 'cdi4x1250-01',
    ip: '192.168.1.160',
    mac: '00:60:74:55:66:05',
    manufacturer: 'Crown',
    protocol: 'Dante',
    connectedSwitch: 'Amp-Room-01',
    connectedPort: 2,
    status: 'offline',
    lastSeen: new Date(Date.now() - 300000).toISOString(),
  },
  {
    id: 'dev-006',
    name: 'NDI-Encoder-B',
    ip: '192.168.1.170',
    mac: '00:11:22:33:44:06',
    manufacturer: 'BirdDog',
    protocol: 'NDI',
    connectedSwitch: 'Broadcast-TX',
    connectedPort: 3,
    status: 'online',
    lastSeen: new Date().toISOString(),
  },
  {
    id: 'dev-007',
    name: 'AES67-Mic-Pre',
    hostname: 'dpa-aes67',
    ip: '192.168.1.180',
    mac: '00:AA:BB:CC:DD:07',
    manufacturer: 'DPA',
    protocol: 'AES67',
    connectedSwitch: 'Monitor-World-01',
    connectedPort: 7,
    status: 'online',
    lastSeen: new Date().toISOString(),
  },
  {
    id: 'dev-008',
    name: 'Stagebox-Rio-2',
    hostname: 'rio1608d-02',
    ip: '192.168.1.103',
    mac: '00:1D:C1:AA:BB:08',
    manufacturer: 'Yamaha',
    protocol: 'Dante',
    connectedSwitch: 'Stage-Right-02',
    connectedPort: 1,
    status: 'online',
    lastSeen: new Date().toISOString(),
  },
];

const MOCK_SUBNETS = ['192.168.1.0/24', '10.0.0.0/24', '172.16.0.0/24'];

// ---------------------------------------------------------------------------
// Mock API matching ElectronAPI interface
// ---------------------------------------------------------------------------

const mockAPI: MockElectronAPI = {
  scanSubnet: async (_subnet: string) => {
    await new Promise((r) => setTimeout(r, 2000));
    return MOCK_SWITCHES;
  },
  getSwitches: async () => MOCK_SWITCHES,
  getDiscoveredDevices: async () => MOCK_DEVICES,
  pingSwitch: async (_ip: string) => ({
    alive: Math.random() > 0.2,
    latency: Math.floor(Math.random() * 20) + 1,
  }),
  openWebUI: (ip: string) => {
    window.open(`http://${ip}`, '_blank');
  },
  exportCSV: async () => {
    // no-op in dev
  },
  getLocalSubnets: async () => MOCK_SUBNETS,
  getSwitchDetails: async (switchId: string) => {
    // Return mock details based on the switchId
    await new Promise((r) => setTimeout(r, 500));
    const sw = MOCK_SWITCHES.find((s) => s.id === switchId);
    if (!sw) return null;
    return {
      id: sw.id,
      name: sw.name,
      model: sw.model,
      ip: sw.ip,
      mac: sw.mac,
      firmware: sw.firmware,
      ports: sw.ports,
      groups: [],
      temperature: Math.floor(Math.random() * 20) + 30,
      uptime: sw.uptime,
      poe: sw.poeBudgetWatts > 0
        ? { budgetW: sw.poeBudgetWatts, drawW: sw.poeDrawWatts }
        : undefined,
    };
  },
  onScanProgress: (cb: (progress: ScanProgressPayload) => void) => {
    let scanned = 0;
    const total = 254;
    const id = setInterval(() => {
      scanned += Math.floor(Math.random() * 40) + 5;
      if (scanned > total) scanned = total;
      cb({ scanned, total });
      if (scanned >= total) clearInterval(id);
    }, 300);
    return () => clearInterval(id);
  },
  onSwitchUpdate: () => {
    // no-op for mock
    return () => {};
  },
};

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useElectronAPI(): MockElectronAPI {
  return (window.electronAPI as unknown as MockElectronAPI) ?? mockAPI;
}

export function useDiscovery() {
  const api = useElectronAPI();
  const [switches, setSwitches] = useState<SwitchInfo[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanScanned, setScanScanned] = useState(0);
  const [scanTotal, setScanTotal] = useState(0);
  const [lastScanTime, setLastScanTime] = useState<Date | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scan = useCallback(
    async (subnet: string) => {
      setIsScanning(true);
      setScanProgress(0);
      setScanScanned(0);
      setScanTotal(0);
      const unsub = api.onScanProgress((p) => {
        const { scanned, total } = p;
        setScanScanned(scanned);
        setScanTotal(total);
        setScanProgress(total > 0 ? Math.round((scanned / total) * 100) : 0);
      });
      try {
        const result = await api.scanSubnet(subnet);
        setSwitches(result);
        setLastScanTime(new Date());
      } finally {
        unsub();
        setIsScanning(false);
        setScanProgress(100);
      }
    },
    [api],
  );

  const startPolling = useCallback(
    (subnet: string, intervalMs = 30000) => {
      stopPolling();
      pollingRef.current = setInterval(() => {
        scan(subnet);
      }, intervalMs);
    },
    [scan],
  );

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  return {
    switches,
    isScanning,
    scanProgress,
    scanScanned,
    scanTotal,
    lastScanTime,
    scan,
    startPolling,
    stopPolling,
  };
}

export function useDiscoveredDevices() {
  const api = useElectronAPI();
  const [devices, setDevices] = useState<MockDiscoveredDevice[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadDevices = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await api.getDiscoveredDevices();
      setDevices(result);
    } finally {
      setIsLoading(false);
    }
  }, [api]);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  return { devices, isLoading, refresh: loadDevices };
}

export function useEventLog() {
  // Placeholder for event log subscription
  const [events] = useState<unknown[]>([]);
  return { events };
}
