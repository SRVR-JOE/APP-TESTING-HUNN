import React, { useState, useMemo, useCallback } from 'react';
import {
  ScrollText,
  BarChart3,
  Activity,
  Clock,
  Wifi,
  Server,
} from 'lucide-react';
import type {
  EventLogEntry,
  EventCategory,
  Severity,
  PortStats,
} from '../types/index';
import VirtualLogTable from '../components/VirtualLogTable';
import LogFilterBar, {
  type LogFilters,
  DEFAULT_FILTERS,
} from '../components/LogFilterBar';
import PortStatsChart from '../components/PortStatsChart';

// ═══════════════════════════════════════════════════════════════════════════
// Mock Data Generation
// ═══════════════════════════════════════════════════════════════════════════

const SWITCH_NAMES = ['FOH-SW-01', 'STG-SW-01', 'MON-SW-01', 'BCK-SW-02'];
const SWITCH_MACS = [
  '00:50:C2:AA:01:01',
  '00:50:C2:AA:02:01',
  '00:50:C2:AA:03:01',
  '00:50:C2:AA:04:01',
];

const MESSAGE_TEMPLATES: Record<
  EventCategory,
  { severity: Severity; msg: string; details?: string }[]
> = {
  discovery: [
    {
      severity: 'info',
      msg: 'Switch {switch} discovered at 10.0.1.{ip}',
      details: '{"ip":"10.0.1.{ip}","model":"GigaCore 16Xt","firmware":"2.5.1","serial":"GC16XT-00{ip}42"}',
    },
    {
      severity: 'info',
      msg: 'Switch {switch} responded to mDNS query — model GigaCore 16Xt',
    },
    {
      severity: 'warning',
      msg: 'Switch {switch} not responding to discovery probes — retrying',
      details: '{"lastSeen":"2m ago","retries":3,"timeout":"5000ms"}',
    },
    {
      severity: 'error',
      msg: 'Switch {switch} lost — no response for 60s',
      details: '{"lastIp":"10.0.1.{ip}","downSince":"{ts}","consecutiveFailures":12}',
    },
  ],
  link: [
    {
      severity: 'info',
      msg: 'Port {port} link up on {switch} at 1Gbps',
      details: '{"port":{port},"speed":"1Gbps","duplex":"full","mediaType":"copper"}',
    },
    {
      severity: 'info',
      msg: 'Port {port} link down on {switch}',
    },
    {
      severity: 'warning',
      msg: 'Port {port} on {switch} flapping — 5 state changes in 60s',
      details: '{"port":{port},"stateChanges":5,"window":"60s","lastState":"down"}',
    },
    {
      severity: 'error',
      msg: 'Port {port} on {switch} excessive CRC errors detected',
      details: '{"port":{port},"crcErrors":1247,"interval":"5m","threshold":100}',
    },
  ],
  poe: [
    {
      severity: 'info',
      msg: 'PoE enabled on port {port} of {switch} — drawing 12.5W',
    },
    {
      severity: 'warning',
      msg: 'PoE budget warning on {switch}: 92% utilized',
      details: '{"budget":60,"draw":55.2,"utilization":92,"highestPort":{"port":3,"watts":22.1}}',
    },
    {
      severity: 'error',
      msg: 'PoE overload on {switch} port {port} — device disconnected',
      details: '{"port":{port},"requestedW":35,"maxClassW":30,"pdType":"Class 4"}',
    },
    {
      severity: 'critical',
      msg: 'PoE budget exceeded on {switch} — shedding low-priority ports',
      details: '{"budget":60,"draw":63.5,"shedPorts":[7,8],"shedPolicy":"lowest-priority-first"}',
    },
  ],
  config: [
    {
      severity: 'info',
      msg: 'VLAN 10 created on {switch}: "Audio Primary"',
      details: '{"vlanId":10,"name":"Audio Primary","taggedPorts":[1,2,3,4],"untaggedPorts":[5,6]}',
    },
    {
      severity: 'info',
      msg: 'Profile "Dante-Standard" applied to {switch} — 16 ports configured',
    },
    {
      severity: 'warning',
      msg: 'Config backup failed for {switch}: connection timeout',
      details: '{"error":"ETIMEDOUT","retries":2,"backupType":"full","lastBackup":"3h ago"}',
    },
    {
      severity: 'error',
      msg: 'Config restore failed on {switch}: firmware mismatch',
      details: '{"expected":"2.5.1","actual":"2.3.0","profileName":"Dante-Standard"}',
    },
  ],
  health: [
    {
      severity: 'info',
      msg: 'Health check passed on {switch} — all 16 ports nominal',
    },
    {
      severity: 'warning',
      msg: 'CPU temperature elevated on {switch}: 72\u00B0C (threshold: 75\u00B0C)',
      details: '{"cpuTemp":72,"threshold":75,"fanSpeed":"high","ambient":28}',
    },
    {
      severity: 'error',
      msg: 'Memory usage critical on {switch}: 94% (236/256 MB)',
      details: '{"memUsedPercent":94,"memUsedMB":236,"memTotalMB":256,"topProcesses":["snmpd","httpd","linkmon"]}',
    },
    {
      severity: 'critical',
      msg: 'Switch {switch} unresponsive — possible hardware failure',
      details: '{"lastPing":"15s ago","consecutiveFailures":10,"lastKnownUptime":"14d 3h","action":"alerting"}',
    },
  ],
  system: [
    {
      severity: 'info',
      msg: 'GigaCore Command started — scanning network 10.0.1.0/24',
    },
    {
      severity: 'info',
      msg: 'Polling interval changed to 30s for all monitored switches',
    },
    {
      severity: 'warning',
      msg: 'Database size approaching limit: 450 MB / 500 MB',
      details: '{"dbSizeMB":450,"limitMB":500,"oldestEntry":"7d","eventCount":142803}',
    },
    {
      severity: 'info',
      msg: 'Firmware update available for {switch}: v2.6.0',
      details: '{"current":"2.5.1","available":"2.6.0","releaseNotes":"Bug fixes, IGMP snooping improvements, new REST API endpoints"}',
    },
  ],
};

function generateMockEventLogs(count: number): EventLogEntry[] {
  const now = Date.now();
  const entries: EventLogEntry[] = [];
  const categories: EventCategory[] = [
    'discovery', 'link', 'poe', 'config', 'health', 'system',
  ];

  for (let i = 0; i < count; i++) {
    const cat = categories[Math.floor(Math.random() * categories.length)];
    const templates = MESSAGE_TEMPLATES[cat];
    const tpl = templates[Math.floor(Math.random() * templates.length)];
    const swIdx = Math.floor(Math.random() * SWITCH_NAMES.length);
    const port = Math.floor(Math.random() * 16) + 1;
    const ip = 10 + swIdx;
    // Spread over last 24h with some clustering in recent hours
    const recencyBias = Math.pow(Math.random(), 1.5); // cluster toward recent
    const offset = recencyBias * 24 * 60 * 60 * 1000;
    const ts = new Date(now - offset);

    const isSystemOnly = cat === 'system' && Math.random() > 0.5;

    const msg = tpl.msg
      .replace('{switch}', SWITCH_NAMES[swIdx])
      .replace('{port}', String(port))
      .replace('{ip}', String(ip));

    const details = tpl.details
      ?.replace(/\{port\}/g, String(port))
      .replace(/\{ip\}/g, String(ip))
      .replace('{ts}', ts.toISOString());

    entries.push({
      id: i + 1,
      timestamp: ts.toISOString(),
      category: cat,
      severity: tpl.severity,
      switchMac: isSystemOnly ? undefined : SWITCH_MACS[swIdx],
      switchName: isSystemOnly ? undefined : SWITCH_NAMES[swIdx],
      message: msg,
      details,
    });
  }

  entries.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  entries.forEach((e, idx) => { e.id = idx + 1; });
  return entries;
}

function generateMockPortStats(): PortStats[] {
  const now = Date.now();
  const stats: PortStats[] = [];
  let id = 1;

  for (let sw = 0; sw < 2; sw++) {
    for (let port = 1; port <= 4; port++) {
      let cumRx = Math.floor(Math.random() * 500_000_000);
      let cumTx = Math.floor(Math.random() * 400_000_000);
      let cumRxPkt = Math.floor(Math.random() * 5_000_000);
      let cumTxPkt = Math.floor(Math.random() * 4_000_000);

      for (let t = 119; t >= 0; t--) {
        const timestamp = new Date(now - t * 60_000).toISOString();
        cumRx += Math.floor(50_000 + Math.random() * 500_000);
        cumTx += Math.floor(40_000 + Math.random() * 400_000);
        cumRxPkt += Math.floor(500 + Math.random() * 5_000);
        cumTxPkt += Math.floor(400 + Math.random() * 4_000);

        const hasErrors = Math.random() < 0.08;
        stats.push({
          id: id++,
          switchMac: SWITCH_MACS[sw],
          port,
          timestamp,
          rxBytes: cumRx,
          txBytes: cumTx,
          rxPackets: cumRxPkt,
          txPackets: cumTxPkt,
          rxErrors: hasErrors ? Math.floor(Math.random() * 20) : 0,
          txErrors: hasErrors ? Math.floor(Math.random() * 5) : 0,
          linkUp: Math.random() > 0.02,
          speed: '1Gbps',
          poeWatts: port <= 2 ? 8 + Math.random() * 20 : undefined,
        });
      }
    }
  }
  return stats;
}

// Generate once
const MOCK_EVENTS = generateMockEventLogs(250);
const MOCK_PORT_STATS = generateMockPortStats();

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

function getTimeRangeMs(range: LogFilters['timeRange']): number {
  switch (range) {
    case 'last-hour': return 60 * 60 * 1000;
    case 'last-24h': return 24 * 60 * 60 * 1000;
    case 'last-7d': return 7 * 24 * 60 * 60 * 1000;
    case 'custom': return Infinity;
  }
}

function downloadFile(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportCSV(entries: EventLogEntry[]): void {
  const header = 'Timestamp,Category,Severity,Switch,Message\n';
  const rows = entries
    .map(
      (e) =>
        `"${e.timestamp}","${e.category}","${e.severity}","${e.switchName ?? ''}","${e.message.replace(/"/g, '""')}"`
    )
    .join('\n');
  downloadFile(header + rows, 'event-log.csv', 'text/csv');
}

function exportJSON(entries: EventLogEntry[]): void {
  downloadFile(JSON.stringify(entries, null, 2), 'event-log.json', 'application/json');
}

function exportExcel(entries: EventLogEntry[]): void {
  const header = 'Timestamp\tCategory\tSeverity\tSwitch\tMessage\n';
  const rows = entries
    .map(
      (e) =>
        `${e.timestamp}\t${e.category}\t${e.severity}\t${e.switchName ?? ''}\t${e.message}`
    )
    .join('\n');
  downloadFile(header + rows, 'event-log.xls', 'application/vnd.ms-excel');
}

function formatBytesCompact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)} GB`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} MB`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)} KB`;
  return `${n} B`;
}

// ═══════════════════════════════════════════════════════════════════════════
// Port Statistics Tab
// ═══════════════════════════════════════════════════════════════════════════

type StatsMetric = 'throughput' | 'errors' | 'poe' | 'packets';
type StatsTimeRange = '1h' | '6h' | '24h' | '7d';

const TIME_RANGE_MS: Record<StatsTimeRange, number> = {
  '1h': 60 * 60_000,
  '6h': 6 * 60 * 60_000,
  '24h': 24 * 60 * 60_000,
  '7d': 7 * 24 * 60 * 60_000,
};

function PortStatisticsTab() {
  const [selectedSwitch, setSelectedSwitch] = useState(SWITCH_MACS[0]);
  const [selectedPorts, setSelectedPorts] = useState<number[]>([1]);
  const [timeRange, setTimeRange] = useState<StatsTimeRange>('1h');
  const [metric, setMetric] = useState<StatsMetric>('throughput');

  const switchName =
    SWITCH_NAMES[SWITCH_MACS.indexOf(selectedSwitch)] ?? selectedSwitch;

  const filteredStats = useMemo(() => {
    const cutoff = Date.now() - TIME_RANGE_MS[timeRange];
    return MOCK_PORT_STATS.filter(
      (s) =>
        s.switchMac === selectedSwitch &&
        selectedPorts.includes(s.port) &&
        new Date(s.timestamp).getTime() >= cutoff
    ).sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }, [selectedSwitch, selectedPorts, timeRange]);

  const latestStats = useMemo(() => {
    const latest: Record<number, PortStats> = {};
    for (const s of MOCK_PORT_STATS) {
      if (s.switchMac === selectedSwitch && selectedPorts.includes(s.port)) {
        if (
          !latest[s.port] ||
          new Date(s.timestamp) > new Date(latest[s.port].timestamp)
        ) {
          latest[s.port] = s;
        }
      }
    }
    return Object.values(latest);
  }, [selectedSwitch, selectedPorts]);

  const togglePort = (port: number) => {
    setSelectedPorts((prev) =>
      prev.includes(port)
        ? prev.length > 1
          ? prev.filter((p) => p !== port)
          : prev
        : [...prev, port]
    );
  };

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Controls bar */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-gray-800/50 border border-gray-700 rounded-lg flex-shrink-0">
        {/* Switch selector */}
        <div className="flex items-center gap-2">
          <Server size={14} className="text-gray-400" />
          <select
            value={selectedSwitch}
            onChange={(e) => setSelectedSwitch(e.target.value)}
            className="bg-gray-700 text-sm text-gray-200 px-2 py-1 rounded border border-gray-600 focus:outline-none focus:border-blue-500"
          >
            {SWITCH_MACS.map((mac, i) => (
              <option key={mac} value={mac}>
                {SWITCH_NAMES[i]}
              </option>
            ))}
          </select>
        </div>

        <div className="w-px h-6 bg-gray-700" />

        {/* Port multi-select */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-400 mr-1">Ports:</span>
          {[1, 2, 3, 4].map((port) => (
            <button
              key={port}
              onClick={() => togglePort(port)}
              className={`px-2 py-1 text-xs rounded border transition-all ${
                selectedPorts.includes(port)
                  ? 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                  : 'bg-gray-700/30 text-gray-500 border-gray-700'
              }`}
            >
              {port}
            </button>
          ))}
        </div>

        <div className="w-px h-6 bg-gray-700" />

        {/* Time range */}
        <div className="flex items-center gap-1">
          <Clock size={14} className="text-gray-400" />
          {(['1h', '6h', '24h', '7d'] as StatsTimeRange[]).map((tr) => (
            <button
              key={tr}
              onClick={() => setTimeRange(tr)}
              className={`px-2 py-1 text-xs rounded border transition-all ${
                timeRange === tr
                  ? 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                  : 'bg-gray-700/30 text-gray-500 border-gray-700'
              }`}
            >
              {tr}
            </button>
          ))}
        </div>

        <div className="w-px h-6 bg-gray-700" />

        {/* Metric selector */}
        <div className="flex items-center gap-1">
          <Activity size={14} className="text-gray-400" />
          {(
            [
              { key: 'throughput' as const, label: 'Throughput' },
              { key: 'errors' as const, label: 'Errors' },
              { key: 'poe' as const, label: 'PoE Draw' },
              { key: 'packets' as const, label: 'Packets' },
            ]
          ).map((m) => (
            <button
              key={m.key}
              onClick={() => setMetric(m.key)}
              className={`px-2 py-1 text-xs rounded border transition-all ${
                metric === m.key
                  ? 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                  : 'bg-gray-700/30 text-gray-500 border-gray-700'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main content: chart + live counters sidebar */}
      <div className="flex flex-1 gap-4 min-h-0">
        {/* Chart area */}
        <div className="flex-1 bg-gray-800/30 border border-gray-700 rounded-lg p-4 min-w-0">
          <h3 className="text-sm font-medium text-gray-300 mb-3">
            {switchName} — Port{selectedPorts.length > 1 ? 's' : ''}{' '}
            {selectedPorts.join(', ')} —{' '}
            {metric.charAt(0).toUpperCase() + metric.slice(1)}
          </h3>
          <PortStatsChart
            data={filteredStats}
            metric={metric}
            height={320}
            poeBudget={60}
          />
        </div>

        {/* Current values sidebar */}
        <div className="w-64 flex-shrink-0 bg-gray-800/30 border border-gray-700 rounded-lg p-4 overflow-auto">
          <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
            <Wifi size={14} className="text-green-400" />
            Live Counters
          </h3>
          {latestStats.length === 0 ? (
            <p className="text-xs text-gray-500">
              No data for selected ports.
            </p>
          ) : (
            latestStats.map((s) => (
              <div
                key={s.port}
                className="mb-4 pb-3 border-b border-gray-700 last:border-0"
              >
                <div className="text-xs font-medium text-gray-400 mb-2">
                  Port {s.port}{' '}
                  <span
                    className={`ml-1 px-1.5 py-0.5 rounded text-[10px] ${
                      s.linkUp
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}
                  >
                    {s.linkUp ? 'UP' : 'DOWN'}
                  </span>
                  <span className="ml-1 text-gray-600">{s.speed}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <div>
                    <span className="text-gray-500">TX Bytes</span>
                    <div className="text-blue-400 font-mono">
                      {formatBytesCompact(s.txBytes)}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500">RX Bytes</span>
                    <div className="text-green-400 font-mono">
                      {formatBytesCompact(s.rxBytes)}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500">TX Packets</span>
                    <div className="text-gray-300 font-mono">
                      {s.txPackets.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500">RX Packets</span>
                    <div className="text-gray-300 font-mono">
                      {s.rxPackets.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500">Errors</span>
                    <div
                      className={`font-mono ${
                        s.rxErrors + s.txErrors > 0
                          ? 'text-red-400'
                          : 'text-gray-500'
                      }`}
                    >
                      {s.rxErrors + s.txErrors}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500">Drops</span>
                    <div className="text-gray-500 font-mono">0</div>
                  </div>
                  {s.poeWatts != null && (
                    <div className="col-span-2">
                      <span className="text-gray-500">PoE Draw</span>
                      <div className="text-yellow-400 font-mono">
                        {s.poeWatts.toFixed(1)} W
                      </div>
                    </div>
                  )}
                  <div className="col-span-2">
                    <span className="text-gray-500">Link Duration</span>
                    <div className="text-gray-300 font-mono">
                      {s.linkUp ? '2h 14m' : '--'}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Main LogsView Component
// ═══════════════════════════════════════════════════════════════════════════

type TabId = 'event-log' | 'port-stats';

export default function LogsView() {
  const [activeTab, setActiveTab] = useState<TabId>('event-log');
  const [filters, setFilters] = useState<LogFilters>({ ...DEFAULT_FILTERS });

  // ── Derived data ──────────────────────────────────────────────────────

  const switchNames = useMemo(() => {
    const names = new Set<string>();
    MOCK_EVENTS.forEach((e) => {
      if (e.switchName) names.add(e.switchName);
    });
    return Array.from(names).sort();
  }, []);

  const filteredEntries = useMemo(() => {
    const now = Date.now();
    const cutoff = now - getTimeRangeMs(filters.timeRange);
    const search = filters.searchText.toLowerCase();

    return MOCK_EVENTS.filter((e) => {
      if (!filters.categories.has(e.category)) return false;
      if (filters.severity !== 'all' && e.severity !== filters.severity) return false;
      if (filters.switchName && e.switchName !== filters.switchName) return false;
      if (new Date(e.timestamp).getTime() < cutoff) return false;
      if (search && !e.message.toLowerCase().includes(search)) return false;
      return true;
    });
  }, [filters]);

  const errorsLastHour = useMemo(() => {
    const cutoff = Date.now() - 60 * 60 * 1000;
    return MOCK_EVENTS.filter(
      (e) =>
        (e.severity === 'error' || e.severity === 'critical') &&
        new Date(e.timestamp).getTime() >= cutoff
    ).length;
  }, []);

  const warningsLastHour = useMemo(() => {
    const cutoff = Date.now() - 60 * 60 * 1000;
    return MOCK_EVENTS.filter(
      (e) =>
        e.severity === 'warning' &&
        new Date(e.timestamp).getTime() >= cutoff
    ).length;
  }, []);

  const eventsPerMinute = useMemo(() => {
    if (MOCK_EVENTS.length < 2) return 0;
    const newest = new Date(MOCK_EVENTS[0].timestamp).getTime();
    const oldest = new Date(MOCK_EVENTS[MOCK_EVENTS.length - 1].timestamp).getTime();
    const minutes = (newest - oldest) / 60_000;
    return minutes > 0 ? MOCK_EVENTS.length / minutes : 0;
  }, []);

  // ── Callbacks ─────────────────────────────────────────────────────────

  const handleExport = useCallback(
    (format: 'csv' | 'excel' | 'json') => {
      switch (format) {
        case 'csv':   exportCSV(filteredEntries); break;
        case 'excel': exportExcel(filteredEntries); break;
        case 'json':  exportJSON(filteredEntries); break;
      }
    },
    [filteredEntries]
  );

  const handleFilterBySwitch = useCallback((switchName: string) => {
    setFilters((prev) => ({ ...prev, switchName }));
  }, []);

  // ── Tab definitions ───────────────────────────────────────────────────

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'event-log', label: 'Event Log', icon: <ScrollText size={16} /> },
    { id: 'port-stats', label: 'Port Statistics', icon: <BarChart3 size={16} /> },
  ];

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* Header + Tab bar */}
      <div className="flex items-center gap-4 mb-4 flex-shrink-0">
        <ScrollText size={24} className="text-blue-400" />
        <h2 className="text-xl font-semibold text-gray-100">
          Data Logging &amp; History
        </h2>

        <div className="flex items-center gap-1 ml-6 bg-gray-800/50 rounded-lg p-1 border border-gray-700">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-gray-700 text-white shadow'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'event-log' ? (
        <div className="flex flex-col flex-1 min-h-0">
          {/* Filter bar + stats footer (integrated in LogFilterBar) */}
          <LogFilterBar
            filters={filters}
            onChange={setFilters}
            switchNames={switchNames}
            onExport={handleExport}
            totalEntries={MOCK_EVENTS.length}
            filteredEntries={filteredEntries.length}
            errorsLastHour={errorsLastHour}
            warningsLastHour={warningsLastHour}
            eventsPerMinute={eventsPerMinute}
          />
          {/* Virtual log table */}
          <div className="flex-1 min-h-0 border-x border-gray-700 bg-gray-900/50">
            <VirtualLogTable
              entries={filteredEntries}
              liveTail={filters.liveTail}
              onFilterBySwitch={handleFilterBySwitch}
            />
          </div>
        </div>
      ) : (
        <PortStatisticsTab />
      )}
    </div>
  );
}
