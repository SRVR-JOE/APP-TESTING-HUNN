import { create } from 'zustand';

// ─── Extended types for log view ─────────────────────────────────────────────

export type LogCategory =
  | 'discovery'
  | 'config'
  | 'batch'
  | 'excel'
  | 'health'
  | 'error'
  | 'user';

export type LogSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface EventLogEntry {
  id: number;
  timestamp: string;
  category: LogCategory;
  severity: LogSeverity;
  switchName?: string;
  switchMac?: string;
  port?: number;
  message: string;
  details?: string;
}

export interface LogFilters {
  categories: LogCategory[];
  severities: LogSeverity[];
  switchName: string; // 'all' or a specific name
  timeRange: 'last-hour' | 'last-24h' | 'last-7d' | 'all' | { start: string; end: string };
  searchText: string;
}

export interface PortStatPoint {
  timestamp: string;
  txBytes?: number;
  rxBytes?: number;
  poeWatts?: number;
  poeBudget?: number;
  crcErrors?: number;
  collisions?: number;
  drops?: number;
  eventCount?: number;
  category?: string;
  switchName?: string;
}

export interface LogState {
  entries: EventLogEntry[];
  filteredEntries: EventLogEntry[];
  totalCount: number;
  filters: LogFilters;
  isLiveTail: boolean;
  isLoading: boolean;
  expandedRowId: number | null;
  sortColumn: string;
  sortDirection: 'asc' | 'desc';
  chartType: 'traffic' | 'poe' | 'errors' | 'frequency';
  chartData: PortStatPoint[];
  chartsCollapsed: boolean;
  selectedChartSwitch: string;
  selectedChartPort: number;
  bucketSize: '1min' | '5min' | '1hour' | '1day';
  newEventsCount: number;

  setFilters: (filters: Partial<LogFilters>) => void;
  clearFilters: () => void;
  toggleLiveTail: () => void;
  setSort: (column: string) => void;
  expandRow: (id: number | null) => void;
  loadEntries: () => Promise<void>;
  loadMore: () => Promise<void>;
  setChartType: (type: 'traffic' | 'poe' | 'errors' | 'frequency') => void;
  toggleChartsCollapsed: () => void;
  setSelectedChartSwitch: (name: string) => void;
  setSelectedChartPort: (port: number) => void;
  setBucketSize: (size: '1min' | '5min' | '1hour' | '1day') => void;
  acknowledgeNewEvents: () => void;
  applyFilters: () => void;
}

// ─── Mock switch names ──────────────────────────────────────────────────────

const SWITCH_NAMES = [
  'GC-FOH-01',
  'GC-MON-02',
  'GC-STAGE-03',
  'GC-BCAST-04',
  'GC-BACKSTAGE-05',
];

const SWITCH_MACS = [
  '00:50:C2:A0:10:01',
  '00:50:C2:A0:10:02',
  '00:50:C2:A0:10:03',
  '00:50:C2:A0:10:04',
  '00:50:C2:A0:10:05',
];

// ─── Generate mock log entries ──────────────────────────────────────────────

function generateMockEntries(): EventLogEntry[] {
  const entries: EventLogEntry[] = [];
  const now = Date.now();
  let id = 1;

  const templates: Array<{
    category: LogCategory;
    severity: LogSeverity;
    message: string;
    details?: string;
    port?: number;
  }> = [
    // Discovery
    { category: 'discovery', severity: 'info', message: 'Switch discovered via mDNS on subnet 192.168.1.0/24', details: '{"protocol":"mDNS","responseTime":12}' },
    { category: 'discovery', severity: 'info', message: 'Switch responded to SNMP poll', details: '{"oid":"1.3.6.1.2.1.1.1.0","community":"public"}' },
    { category: 'discovery', severity: 'warning', message: 'Switch did not respond within timeout period (10s)', details: '{"timeout":10000,"retries":3}' },
    { category: 'discovery', severity: 'info', message: 'New device detected on port 5', port: 5, details: '{"mac":"AA:BB:CC:DD:EE:FF","protocol":"Dante"}' },
    { category: 'discovery', severity: 'info', message: 'ARP scan completed - 24 hosts found', details: '{"subnet":"192.168.1.0/24","hostsFound":24,"duration":4500}' },
    { category: 'discovery', severity: 'error', message: 'Switch went offline unexpectedly', details: '{"lastSeen":"2026-03-18T10:30:00Z","pingFailed":true}' },
    { category: 'discovery', severity: 'info', message: 'Switch came back online after 2m 34s downtime', details: '{"downtimeMs":154000}' },

    // Config
    { category: 'config', severity: 'info', message: 'VLAN 10 "Audio-Primary" created on ports 1-8', details: '{"vlanId":10,"name":"Audio-Primary","ports":[1,2,3,4,5,6,7,8],"tagged":false}' },
    { category: 'config', severity: 'info', message: 'Port 12 speed set to 1000Mbps full-duplex', port: 12, details: '{"speed":"1000","duplex":"full","autoNeg":false}' },
    { category: 'config', severity: 'warning', message: 'Configuration backup failed - storage full', details: '{"availableSpace":0,"requiredSpace":2048}' },
    { category: 'config', severity: 'info', message: 'PoE enabled on ports 1-16 (budget: 370W)', details: '{"ports":[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16],"budgetWatts":370}' },
    { category: 'config', severity: 'info', message: 'IGMP snooping enabled for multicast optimization', details: '{"igmpVersion":2,"querierEnabled":true}' },
    { category: 'config', severity: 'error', message: 'Failed to apply VLAN configuration - switch returned error', details: '{"error":"VLAN ID 4095 is reserved","code":400}' },
    { category: 'config', severity: 'info', message: 'Firmware update scheduled for maintenance window', details: '{"currentVersion":"2.4.1","targetVersion":"2.5.0","scheduledAt":"2026-03-19T02:00:00Z"}' },

    // Batch
    { category: 'batch', severity: 'info', message: 'Batch operation started: Apply profile "Concert-Standard" to 5 switches', details: '{"profileId":"concert-std","switchCount":5,"operations":["vlan","poe","ports"]}' },
    { category: 'batch', severity: 'info', message: 'Batch progress: 3/5 switches configured successfully', details: '{"completed":3,"total":5,"failed":0}' },
    { category: 'batch', severity: 'warning', message: 'Batch operation partial failure: 1 switch unreachable', details: '{"completed":4,"total":5,"failed":1,"failedSwitch":"GC-BACKSTAGE-05"}' },
    { category: 'batch', severity: 'info', message: 'Batch firmware update completed for all Stage switches', details: '{"switchCount":3,"version":"2.5.0","duration":320000}' },
    { category: 'batch', severity: 'error', message: 'Batch rollback triggered due to connectivity loss', details: '{"reason":"connectivity_loss","rollbackSwitches":["GC-MON-02","GC-STAGE-03"]}' },

    // Excel
    { category: 'excel', severity: 'info', message: 'Excel template generated for GigaCore 14R model', details: '{"model":"GC-14R","portCount":14,"sheets":["Ports","VLANs","PoE"]}' },
    { category: 'excel', severity: 'info', message: 'Excel import parsed: 14 port configs, 4 VLANs, PoE settings', details: '{"ports":14,"vlans":4,"poeEnabled":true,"fileName":"stage-config.xlsx"}' },
    { category: 'excel', severity: 'warning', message: 'Excel import warning: VLAN 99 referenced but not defined', details: '{"missingVlans":[99],"referencedOnPorts":[7,8]}' },
    { category: 'excel', severity: 'error', message: 'Excel parse error: Invalid port number 25 (max 14 for GC-14R)', details: '{"row":26,"column":"Port","value":25,"maxPort":14}' },
    { category: 'excel', severity: 'info', message: 'Configuration exported to Excel: FOH-config-2026-03-18.xlsx', details: '{"fileName":"FOH-config-2026-03-18.xlsx","size":48200}' },

    // Health
    { category: 'health', severity: 'info', message: 'Health check passed - all metrics nominal', details: '{"checks":8,"passed":8,"failed":0,"duration":1200}' },
    { category: 'health', severity: 'warning', message: 'PoE budget utilization at 82% (304W / 370W)', details: '{"poeDrawWatts":304,"poeBudgetWatts":370,"utilization":0.82}' },
    { category: 'health', severity: 'warning', message: 'Port 7 CRC error rate elevated: 0.02%', port: 7, details: '{"crcErrorRate":0.0002,"threshold":0.0001,"packets":1500000}' },
    { category: 'health', severity: 'critical', message: 'PoE budget EXCEEDED - load shedding activated', details: '{"poeDrawWatts":385,"poeBudgetWatts":370,"shedPorts":[15,16]}' },
    { category: 'health', severity: 'error', message: 'Temperature sensor reading 72C (threshold: 65C)', details: '{"temperature":72,"warningThreshold":55,"criticalThreshold":65}' },
    { category: 'health', severity: 'info', message: 'CPU utilization: 23%, Memory: 45%, Uptime: 14d 7h', details: '{"cpuPercent":23,"memoryPercent":45,"uptimeSeconds":1234800}' },
    { category: 'health', severity: 'warning', message: 'Ping latency to GC-BCAST-04 increased to 85ms', details: '{"latencyMs":85,"averageMs":12,"threshold":50}' },
    { category: 'health', severity: 'critical', message: 'Link flapping detected on port 3 - 12 state changes in 60s', port: 3, details: '{"stateChanges":12,"periodSeconds":60,"port":3}' },

    // Error
    { category: 'error', severity: 'error', message: 'SNMP request timed out after 5000ms', details: '{"host":"192.168.1.103","oid":"1.3.6.1.2.1.2.2.1.10","timeout":5000}' },
    { category: 'error', severity: 'error', message: 'WebSocket connection dropped to GC-MON-02', details: '{"url":"ws://192.168.1.102:8080","code":1006,"reason":"abnormal_closure"}' },
    { category: 'error', severity: 'critical', message: 'Database write failed - disk space critically low', details: '{"error":"SQLITE_FULL","availableBytes":1024,"requiredBytes":4096}' },
    { category: 'error', severity: 'error', message: 'HTTP 503 from switch management API', details: '{"url":"http://192.168.1.101/api/v1/ports","status":503,"body":"Service Unavailable"}' },
    { category: 'error', severity: 'warning', message: 'Retry attempt 2/3 for switch configuration push', details: '{"attempt":2,"maxRetries":3,"switchId":"GC-STAGE-03"}' },
    { category: 'error', severity: 'critical', message: 'Multiple switches reporting simultaneous link failures', details: '{"affectedSwitches":["GC-FOH-01","GC-MON-02","GC-STAGE-03"],"ports":[1,2,5,8]}' },

    // User
    { category: 'user', severity: 'info', message: 'User started network scan on 192.168.1.0/24', details: '{"subnet":"192.168.1.0/24","scanType":"full"}' },
    { category: 'user', severity: 'info', message: 'User applied profile "Concert-Standard" to GC-FOH-01', details: '{"profileName":"Concert-Standard","switchName":"GC-FOH-01"}' },
    { category: 'user', severity: 'info', message: 'User exported event logs as CSV (1,234 entries)', details: '{"format":"csv","entries":1234,"filters":{"timeRange":"last-24h"}}' },
    { category: 'user', severity: 'info', message: 'User created new rack group "Main Stage"', details: '{"groupName":"Main Stage","switches":["GC-FOH-01","GC-MON-02"]}' },
    { category: 'user', severity: 'warning', message: 'User attempted to delete active profile - operation blocked', details: '{"profileName":"Live-Show","activeSwitches":2}' },
    { category: 'user', severity: 'info', message: 'Application settings updated: polling interval changed to 5s', details: '{"setting":"pollInterval","oldValue":2000,"newValue":5000}' },
    { category: 'user', severity: 'info', message: 'User initiated firmware update on GC-STAGE-03', details: '{"switchName":"GC-STAGE-03","fromVersion":"2.4.1","toVersion":"2.5.0"}' },

    // Additional entries for volume
    { category: 'discovery', severity: 'info', message: 'Topology change detected - STP reconvergence', details: '{"rootBridge":"GC-FOH-01","convergenceMs":1200}' },
    { category: 'config', severity: 'info', message: 'Port mirror configured: port 1 -> port 14 (monitor)', port: 14, details: '{"sourcePort":1,"destinationPort":14,"direction":"both"}' },
    { category: 'health', severity: 'info', message: 'All switch temperatures within normal range', details: '{"switches":{"GC-FOH-01":38,"GC-MON-02":41,"GC-STAGE-03":39,"GC-BCAST-04":42,"GC-BACKSTAGE-05":37}}' },
    { category: 'error', severity: 'error', message: 'Multicast stream disruption on VLAN 10', details: '{"vlanId":10,"affectedPorts":[3,4,7],"duration":2400}' },
    { category: 'batch', severity: 'info', message: 'Batch counter reset completed on all FOH switches', details: '{"switches":["GC-FOH-01"],"countersReset":true}' },
    { category: 'health', severity: 'warning', message: 'Fan speed increased to 80% on GC-BCAST-04', details: '{"fanSpeed":80,"temperature":58,"threshold":55}' },
    { category: 'config', severity: 'info', message: 'LLDP neighbor table updated - 3 new neighbors', details: '{"newNeighbors":3,"totalNeighbors":18}' },
    { category: 'error', severity: 'error', message: 'ARP table overflow - clearing stale entries', details: '{"tableSize":4096,"staleEntries":1200,"cleared":1200}' },
    { category: 'discovery', severity: 'info', message: 'NDI device "Camera-1" detected on port 9', port: 9, details: '{"deviceName":"Camera-1","protocol":"NDI","ip":"192.168.1.50"}' },
    { category: 'user', severity: 'info', message: 'User opened web UI for GC-STAGE-03', details: '{"ip":"192.168.1.103","browser":"electron"}' },
  ];

  // Generate 60 entries spread over the last 24 hours
  for (let i = 0; i < 60; i++) {
    const template = templates[i % templates.length];
    const switchIdx = i % SWITCH_NAMES.length;
    const hoursAgo = (i / 60) * 24;
    const timestamp = new Date(now - hoursAgo * 3600 * 1000).toISOString();

    entries.push({
      id: id++,
      timestamp,
      category: template.category,
      severity: template.severity,
      switchName: SWITCH_NAMES[switchIdx],
      switchMac: SWITCH_MACS[switchIdx],
      port: template.port ?? (i % 3 === 0 ? ((i % 16) + 1) : undefined),
      message: template.message,
      details: template.details,
    });
  }

  // Sort newest first
  entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  // Re-assign IDs after sorting
  entries.forEach((e, idx) => { e.id = idx + 1; });
  return entries;
}

// ─── Generate mock chart data ───────────────────────────────────────────────

function generateMockChartData(): PortStatPoint[] {
  const points: PortStatPoint[] = [];
  const now = Date.now();
  const interval = 15 * 60 * 1000; // 15 minutes

  for (let i = 0; i < 96; i++) {
    const timestamp = new Date(now - (95 - i) * interval).toISOString();
    const hour = new Date(now - (95 - i) * interval).getHours();
    const isBusinessHours = hour >= 8 && hour <= 22;
    const baseMultiplier = isBusinessHours ? 1.5 : 0.4;

    points.push({
      timestamp,
      txBytes: Math.round((800000 + Math.random() * 2000000) * baseMultiplier),
      rxBytes: Math.round((600000 + Math.random() * 1800000) * baseMultiplier),
      poeWatts: Math.round((180 + Math.random() * 120 + (isBusinessHours ? 60 : 0)) * 10) / 10,
      poeBudget: 370,
      crcErrors: Math.floor(Math.random() * (isBusinessHours ? 8 : 2)),
      collisions: Math.floor(Math.random() * (isBusinessHours ? 4 : 1)),
      drops: Math.floor(Math.random() * (isBusinessHours ? 12 : 3)),
      eventCount: Math.floor(2 + Math.random() * (isBusinessHours ? 15 : 4)),
      category: ['discovery', 'config', 'health', 'error', 'user', 'batch', 'excel'][i % 7],
      switchName: SWITCH_NAMES[i % SWITCH_NAMES.length],
    });
  }

  // Add more points for multi-switch PoE data
  for (let i = 0; i < 96; i++) {
    const timestamp = new Date(now - (95 - i) * interval).toISOString();
    for (let s = 1; s < SWITCH_NAMES.length; s++) {
      const hour = new Date(now - (95 - i) * interval).getHours();
      const isBusinessHours = hour >= 8 && hour <= 22;
      points.push({
        timestamp,
        poeWatts: Math.round((120 + Math.random() * 100 + (isBusinessHours ? 40 : 0) + s * 15) * 10) / 10,
        poeBudget: 370,
        switchName: SWITCH_NAMES[s],
      });
    }
  }

  return points;
}

// ─── Filter helpers ─────────────────────────────────────────────────────────

const ALL_CATEGORIES: LogCategory[] = ['discovery', 'config', 'batch', 'excel', 'health', 'error', 'user'];
const ALL_SEVERITIES: LogSeverity[] = ['info', 'warning', 'error', 'critical'];

const defaultFilters: LogFilters = {
  categories: [...ALL_CATEGORIES],
  severities: [...ALL_SEVERITIES],
  switchName: 'all',
  timeRange: 'all',
  searchText: '',
};

function applyFiltersToEntries(entries: EventLogEntry[], filters: LogFilters): EventLogEntry[] {
  let result = entries;

  // Category filter
  result = result.filter((e) => filters.categories.includes(e.category));

  // Severity filter
  result = result.filter((e) => filters.severities.includes(e.severity));

  // Switch filter
  if (filters.switchName !== 'all') {
    result = result.filter((e) => e.switchName === filters.switchName);
  }

  // Time range filter
  if (filters.timeRange !== 'all') {
    const now = Date.now();
    let start: number;
    if (typeof filters.timeRange === 'string') {
      switch (filters.timeRange) {
        case 'last-hour':
          start = now - 3600 * 1000;
          break;
        case 'last-24h':
          start = now - 24 * 3600 * 1000;
          break;
        case 'last-7d':
          start = now - 7 * 24 * 3600 * 1000;
          break;
        default:
          start = 0;
      }
      result = result.filter((e) => new Date(e.timestamp).getTime() >= start);
    } else {
      const rangeStart = new Date(filters.timeRange.start).getTime();
      const rangeEnd = new Date(filters.timeRange.end).getTime();
      result = result.filter((e) => {
        const t = new Date(e.timestamp).getTime();
        return t >= rangeStart && t <= rangeEnd;
      });
    }
  }

  // Search text filter
  if (filters.searchText.trim()) {
    const q = filters.searchText.toLowerCase();
    result = result.filter(
      (e) =>
        e.message.toLowerCase().includes(q) ||
        (e.details && e.details.toLowerCase().includes(q)) ||
        (e.switchName && e.switchName.toLowerCase().includes(q))
    );
  }

  return result;
}

// ─── Store ──────────────────────────────────────────────────────────────────

const mockEntries = generateMockEntries();
const mockChartData = generateMockChartData();

export const useLogStore = create<LogState>((set, get) => ({
  entries: mockEntries,
  filteredEntries: mockEntries,
  totalCount: mockEntries.length,
  filters: { ...defaultFilters },
  isLiveTail: false,
  isLoading: false,
  expandedRowId: null,
  sortColumn: 'timestamp',
  sortDirection: 'desc',
  chartType: 'traffic',
  chartData: mockChartData,
  chartsCollapsed: false,
  selectedChartSwitch: SWITCH_NAMES[0],
  selectedChartPort: 1,
  bucketSize: '1hour',
  newEventsCount: 0,

  setFilters: (partial) => {
    set((state) => {
      const newFilters = { ...state.filters, ...partial };
      const filtered = applyFiltersToEntries(state.entries, newFilters);
      return { filters: newFilters, filteredEntries: filtered };
    });
  },

  clearFilters: () => {
    set((state) => ({
      filters: { ...defaultFilters },
      filteredEntries: state.entries,
    }));
  },

  toggleLiveTail: () => set((state) => ({ isLiveTail: !state.isLiveTail, newEventsCount: 0 })),

  setSort: (column) =>
    set((state) => {
      const direction =
        state.sortColumn === column && state.sortDirection === 'desc' ? 'asc' : 'desc';
      const sorted = [...state.filteredEntries].sort((a, b) => {
        const aVal = (a as unknown as Record<string, unknown>)[column];
        const bVal = (b as unknown as Record<string, unknown>)[column];
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return direction === 'asc'
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
        }
        return direction === 'asc'
          ? Number(aVal) - Number(bVal)
          : Number(bVal) - Number(aVal);
      });
      return { sortColumn: column, sortDirection: direction, filteredEntries: sorted };
    }),

  expandRow: (id) => set({ expandedRowId: id }),

  loadEntries: async () => {
    set({ isLoading: true });
    // Simulating async load
    await new Promise((r) => setTimeout(r, 200));
    const state = get();
    const filtered = applyFiltersToEntries(state.entries, state.filters);
    set({ isLoading: false, filteredEntries: filtered });
  },

  loadMore: async () => {
    // In a real app this would fetch more from the DB
    await new Promise((r) => setTimeout(r, 100));
  },

  setChartType: (type) => set({ chartType: type }),

  toggleChartsCollapsed: () => set((state) => ({ chartsCollapsed: !state.chartsCollapsed })),

  setSelectedChartSwitch: (name) => set({ selectedChartSwitch: name }),

  setSelectedChartPort: (port) => set({ selectedChartPort: port }),

  setBucketSize: (size) => set({ bucketSize: size }),

  acknowledgeNewEvents: () => set({ newEventsCount: 0 }),

  applyFilters: () => {
    set((state) => ({
      filteredEntries: applyFiltersToEntries(state.entries, state.filters),
    }));
  },
}));

export { ALL_CATEGORIES, ALL_SEVERITIES, SWITCH_NAMES, defaultFilters };
