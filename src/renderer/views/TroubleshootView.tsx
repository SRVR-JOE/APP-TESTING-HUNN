// =============================================================================
// GigaCore Command — Troubleshooting Dashboard View
// =============================================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Activity,
  Play,
  Square,
  RefreshCw,
  Clock,
  ToggleLeft,
  ToggleRight,
  Wifi,
  GitCompare,
  RotateCcw,
  CheckCircle,
  AlertTriangle,
  XCircle,
  AlertOctagon,
  Trash2,
  Server,
} from 'lucide-react';

import { HealthCheckCard } from '../components/HealthCheckCard';
import { PingChart } from '../components/PingChart';
import { SwitchCompare } from '../components/SwitchCompare';

import type { HealthCheckResult, HealthStatus } from '../../main/troubleshoot/health-checks';
import type { PingResult } from '../../main/troubleshoot/ping-tool';
import type { CompareResult } from '../../main/troubleshoot/quick-compare';

// =============================================================================
// MOCK DATA
// =============================================================================

// -- Mock switches for dropdowns --
const MOCK_SWITCHES = [
  { name: 'GC-16xt-FOH', ip: '192.168.1.10', model: 'GigaCore 16Xt' },
  { name: 'GC-16xt-Stage', ip: '192.168.1.11', model: 'GigaCore 16Xt' },
  { name: 'GC-14R-Monitor', ip: '192.168.1.12', model: 'GigaCore 14R' },
  { name: 'GC-10-Broadcast', ip: '192.168.1.13', model: 'GigaCore 10' },
  { name: 'GC-30i-Main', ip: '192.168.1.14', model: 'GigaCore 30i' },
  { name: 'GC-16Xt-Backup', ip: '192.168.1.15', model: 'GigaCore 16Xt' },
];

// -- 11 Mock Health Check Results --
const MOCK_HEALTH_CHECKS: HealthCheckResult[] = [
  {
    checkName: 'pingSweep',
    displayName: 'Ping Sweep',
    status: 'pass',
    message: 'All 6 switches reachable with acceptable latency',
    runAt: new Date(Date.now() - 120000).toISOString(),
    details: MOCK_SWITCHES.map((sw) => ({
      switchName: sw.name,
      switchIp: sw.ip,
      value: `${Math.round(2 + Math.random() * 6)}ms`,
      threshold: '<10ms',
      status: 'pass' as HealthStatus,
      message: `${sw.name} responded within acceptable latency`,
    })),
  },
  {
    checkName: 'firmwareConsistency',
    displayName: 'Firmware Consistency',
    status: 'fail',
    message: '2 different firmware versions detected',
    runAt: new Date(Date.now() - 120000).toISOString(),
    details: [
      { switchName: 'GC-16xt-FOH', switchIp: '192.168.1.10', value: '4.2.1', threshold: '4.2.1', status: 'pass', message: 'Firmware matches fleet' },
      { switchName: 'GC-16xt-Stage', switchIp: '192.168.1.11', value: '4.2.1', threshold: '4.2.1', status: 'pass', message: 'Firmware matches fleet' },
      { switchName: 'GC-14R-Monitor', switchIp: '192.168.1.12', value: '4.1.3', threshold: '4.2.1', status: 'fail', message: 'Firmware 4.1.3 differs from fleet (4.2.1)' },
      { switchName: 'GC-10-Broadcast', switchIp: '192.168.1.13', value: '4.2.1', threshold: '4.2.1', status: 'pass', message: 'Firmware matches fleet' },
      { switchName: 'GC-30i-Main', switchIp: '192.168.1.14', value: '4.2.1', threshold: '4.2.1', status: 'pass', message: 'Firmware matches fleet' },
      { switchName: 'GC-16Xt-Backup', switchIp: '192.168.1.15', value: '4.2.1', threshold: '4.2.1', status: 'pass', message: 'Firmware matches fleet' },
    ],
  },
  {
    checkName: 'vlanConsistency',
    displayName: 'VLAN Consistency',
    status: 'warning',
    message: '1 switch(es) with VLAN mismatches',
    runAt: new Date(Date.now() - 120000).toISOString(),
    details: [
      { switchName: 'GC-16xt-FOH', switchIp: '192.168.1.10', value: 'VLANs: 1, 10, 20, 30', threshold: 'Matches reference', status: 'pass', message: 'VLANs match reference' },
      { switchName: 'GC-16xt-Stage', switchIp: '192.168.1.11', value: 'VLANs: 1, 10, 20, 30', threshold: 'Matches reference', status: 'pass', message: 'VLANs match reference' },
      { switchName: 'GC-14R-Monitor', switchIp: '192.168.1.12', value: 'VLANs: 1, 10, 20', threshold: 'Reference: 1, 10, 20, 30', status: 'warning', message: 'VLAN mismatch \u2014 missing: [30]' },
      { switchName: 'GC-30i-Main', switchIp: '192.168.1.14', value: 'VLANs: 1, 10, 20, 30', threshold: 'Matches reference', status: 'pass', message: 'VLANs match reference' },
    ],
  },
  {
    checkName: 'igmpAuditor',
    displayName: 'IGMP Auditor',
    status: 'critical',
    message: '1 VLAN(s) with querier issues',
    runAt: new Date(Date.now() - 120000).toISOString(),
    details: [
      { value: 'VLAN 1: 1 querier (GC-16xt-FOH)', threshold: '1 querier', status: 'pass', message: 'VLAN 1 has exactly 1 querier' },
      { value: 'VLAN 10: 2 queriers (GC-16xt-FOH, GC-30i-Main)', threshold: '1 querier', status: 'critical', message: 'VLAN 10 has 2 queriers \u2014 multicast storms possible' },
      { value: 'VLAN 20: 1 querier (GC-30i-Main)', threshold: '1 querier', status: 'pass', message: 'VLAN 20 has exactly 1 querier' },
      { value: 'VLAN 30: 1 querier (GC-16xt-FOH)', threshold: '1 querier', status: 'pass', message: 'VLAN 30 has exactly 1 querier' },
    ],
  },
  {
    checkName: 'poeBudget',
    displayName: 'PoE Budget',
    status: 'warning',
    message: '1 switch(es) with PoE budget concerns',
    runAt: new Date(Date.now() - 120000).toISOString(),
    details: [
      { switchName: 'GC-16xt-FOH', switchIp: '192.168.1.10', value: '145W / 240W (60.4%)', threshold: '<70%', status: 'pass', message: 'PoE draw at 60.4%' },
      { switchName: 'GC-16xt-Stage', switchIp: '192.168.1.11', value: '185W / 240W (77.1%)', threshold: '70-85%', status: 'warning', message: 'PoE draw at 77.1%' },
      { switchName: 'GC-14R-Monitor', switchIp: '192.168.1.12', value: '42W / 120W (35.0%)', threshold: '<70%', status: 'pass', message: 'PoE draw at 35.0%' },
    ],
  },
  {
    checkName: 'rlinkxValidation',
    displayName: 'RLinkX Validation',
    status: 'pass',
    message: 'All redundancy rings intact',
    runAt: new Date(Date.now() - 120000).toISOString(),
    details: [
      { switchName: 'GC-16xt-FOH', switchIp: '192.168.1.10', value: 'Ring closed', threshold: 'Ring closed', status: 'pass', message: 'RLinkX ring intact' },
      { switchName: 'GC-16xt-Stage', switchIp: '192.168.1.11', value: 'Ring closed', threshold: 'Ring closed', status: 'pass', message: 'RLinkX ring intact' },
      { switchName: 'GC-30i-Main', switchIp: '192.168.1.14', value: 'Ring closed', threshold: 'Ring closed', status: 'pass', message: 'RLinkX ring intact' },
    ],
  },
  {
    checkName: 'portErrorCheck',
    displayName: 'Port Error Check',
    status: 'fail',
    message: '2 port(s) with non-zero error counters',
    runAt: new Date(Date.now() - 120000).toISOString(),
    details: [
      { switchName: 'GC-16xt-Stage', switchIp: '192.168.1.11', port: 7, value: '12 errors/min', threshold: '0 errors/min', status: 'fail', message: 'Port 7: 12 errors/min' },
      { switchName: 'GC-14R-Monitor', switchIp: '192.168.1.12', port: 3, value: '2 errors/min', threshold: '0 errors/min', status: 'warning', message: 'Port 3: 2 errors/min' },
    ],
  },
  {
    checkName: 'linkSpeedAudit',
    displayName: 'Link Speed Audit',
    status: 'warning',
    message: '1 port(s) with unexpected link speed',
    runAt: new Date(Date.now() - 120000).toISOString(),
    details: [
      { switchName: 'GC-16xt-Stage', switchIp: '192.168.1.11', port: 7, value: '100 Mbps', threshold: '1000 Mbps (port capability)', status: 'warning', message: 'Port 7 linked at 100M instead of 1000M \u2014 possible bad cable' },
    ],
  },
  {
    checkName: 'cableSfpCheck',
    displayName: 'Cable & SFP Check',
    status: 'warning',
    message: '1 SFP(s) below slot capability',
    runAt: new Date(Date.now() - 120000).toISOString(),
    details: [
      { switchName: 'GC-30i-Main', switchIp: '192.168.1.14', port: 25, value: '1G SFP', threshold: '10G slot', status: 'warning', message: 'Slot 25: 1G SFP in 10G capable slot' },
      { switchName: 'GC-30i-Main', switchIp: '192.168.1.14', port: 26, value: '10G SFP', threshold: '10G slot', status: 'pass', message: 'Slot 26: SFP matches slot capability' },
    ],
  },
  {
    checkName: 'temperatureCheck',
    displayName: 'Temperature Check',
    status: 'pass',
    message: 'All switch temperatures normal',
    runAt: new Date(Date.now() - 120000).toISOString(),
    details: MOCK_SWITCHES.map((sw) => ({
      switchName: sw.name,
      switchIp: sw.ip,
      value: `${Math.round(28 + Math.random() * 10)}\u00B0C`,
      threshold: '<40\u00B0C',
      status: 'pass' as HealthStatus,
      message: `${sw.name} temperature normal`,
    })),
  },
  {
    checkName: 'duplicateIpCheck',
    displayName: 'Duplicate IP Check',
    status: 'pass',
    message: 'No duplicate IP addresses detected',
    runAt: new Date(Date.now() - 120000).toISOString(),
    details: MOCK_SWITCHES.map((sw) => ({
      switchName: sw.name,
      switchIp: sw.ip,
      value: '1 device',
      threshold: '1 device per IP',
      status: 'pass' as HealthStatus,
      message: `${sw.ip} uniquely assigned to ${sw.name}`,
    })),
  },
];

// -- 30 Mock Ping Results --
function generateMockPingResults(count: number): PingResult[] {
  const results: PingResult[] = [];
  const baseTime = Date.now() - count * 1000;
  for (let i = 0; i < count; i++) {
    const roll = Math.random();
    if (roll < 0.05) {
      results.push({
        host: '192.168.1.10',
        alive: false,
        latencyMs: -1,
        timestamp: new Date(baseTime + i * 1000).toISOString(),
        error: 'Request timed out',
      });
    } else {
      const base = 4 + Math.sin(i / 5) * 3;
      const jitter = (Math.random() - 0.5) * 4;
      results.push({
        host: '192.168.1.10',
        alive: true,
        latencyMs: Math.round((Math.max(0.5, base + jitter)) * 100) / 100,
        timestamp: new Date(baseTime + i * 1000).toISOString(),
        ttl: 64,
      });
    }
  }
  return results;
}

const INITIAL_PING_RESULTS = generateMockPingResults(30);

// -- Mock Comparison Result --
const MOCK_COMPARE_RESULT: CompareResult = {
  switchA: { name: 'GC-16xt-FOH', ip: '192.168.1.10', model: 'GigaCore 16Xt' },
  switchB: { name: 'GC-16xt-Stage', ip: '192.168.1.11', model: 'GigaCore 16Xt' },
  sections: [
    {
      name: 'System',
      isIdentical: false,
      differences: [
        { field: 'Model', valueA: 'GigaCore 16Xt', valueB: 'GigaCore 16Xt', match: true },
        { field: 'Firmware', valueA: '4.2.1', valueB: '4.2.1', match: true },
        { field: 'MAC Address', valueA: '00:60:73:A1:00:01', valueB: '00:60:73:A1:00:02', match: false },
        { field: 'IP Address', valueA: '192.168.1.10', valueB: '192.168.1.11', match: false },
        { field: 'Temperature', valueA: '34\u00B0C', valueB: '38\u00B0C', match: false },
        { field: 'Total Ports', valueA: '16', valueB: '16', match: true },
      ],
    },
    {
      name: 'Groups',
      isIdentical: false,
      differences: [
        { field: 'VLAN 1 \u2014 Name', valueA: 'Default', valueB: 'Default', match: true },
        { field: 'VLAN 1 \u2014 Tagged', valueA: 'none', valueB: 'none', match: true },
        { field: 'VLAN 1 \u2014 Untagged', valueA: '1, 2, 3, 4', valueB: '1, 2, 3, 4', match: true },
        { field: 'VLAN 10 \u2014 Name', valueA: 'Audio', valueB: 'Audio-Main', match: false },
        { field: 'VLAN 10 \u2014 Tagged', valueA: '15, 16', valueB: '15, 16', match: true },
        { field: 'VLAN 10 \u2014 Untagged', valueA: '5, 6, 7, 8', valueB: '5, 6, 7', match: false },
        { field: 'VLAN 20 \u2014 Name', valueA: 'Video', valueB: 'Video', match: true },
        { field: 'VLAN 20 \u2014 Tagged', valueA: '15, 16', valueB: '15, 16', match: true },
        { field: 'VLAN 20 \u2014 Untagged', valueA: '9, 10', valueB: '9, 10, 11', match: false },
        { field: 'VLAN 30 \u2014 Name', valueA: 'Management', valueB: 'Management', match: true },
        { field: 'VLAN 30 \u2014 Tagged', valueA: '15, 16', valueB: '15, 16', match: true },
        { field: 'VLAN 30 \u2014 Untagged', valueA: '11, 12', valueB: '12', match: false },
      ],
    },
    {
      name: 'Ports',
      isIdentical: false,
      differences: [
        { field: 'Port 1', valueA: '1000M, VLANs: 1', valueB: '1000M, VLANs: 1', match: true },
        { field: 'Port 2', valueA: '1000M, VLANs: 1', valueB: '1000M, VLANs: 1', match: true },
        { field: 'Port 7 \u2014 Speed', valueA: '1000 Mbps', valueB: '100 Mbps', match: false },
        { field: 'Port 7 \u2014 VLANs', valueA: '10', valueB: '10', match: true },
        { field: 'Port 8', valueA: '1000M, VLANs: 10', valueB: '1000M, VLANs: 10', match: true },
        { field: 'Port 15 \u2014 Trunk', valueA: 'Yes', valueB: 'Yes', match: true },
        { field: 'Port 16 \u2014 Trunk', valueA: 'Yes', valueB: 'Yes', match: true },
      ],
    },
    {
      name: 'IGMP',
      isIdentical: false,
      differences: [
        { field: 'IGMP Enabled', valueA: 'Yes', valueB: 'Yes', match: true },
        { field: 'Querier Enabled', valueA: 'Yes', valueB: 'No', match: false },
        { field: 'Querier VLANs', valueA: '1, 10, 30', valueB: 'none', match: false },
      ],
    },
    {
      name: 'PoE',
      isIdentical: false,
      differences: [
        { field: 'PoE Budget', valueA: '240W', valueB: '240W', match: true },
        { field: 'PoE Draw', valueA: '145W', valueB: '185W', match: false },
        { field: 'PoE Utilization', valueA: '60.4%', valueB: '77.1%', match: false },
      ],
    },
  ],
};

// -- Mock ports for counter reset --
const MOCK_PORTS = Array.from({ length: 16 }, (_, i) => ({
  port: i + 1,
  label: `Port ${i + 1}`,
}));

// =============================================================================
// STATUS HELPERS
// =============================================================================

function statusCounts(checks: HealthCheckResult[]) {
  let pass = 0, warning = 0, fail = 0, critical = 0;
  for (const c of checks) {
    if (c.status === 'pass') pass++;
    else if (c.status === 'warning') warning++;
    else if (c.status === 'fail') fail++;
    else if (c.status === 'critical') critical++;
  }
  return { pass, warning, fail, critical };
}

// =============================================================================
// COMPONENT
// =============================================================================

export const TroubleshootView: React.FC = () => {
  // -------------------------------------------------------------------------
  // Health Checks State
  // -------------------------------------------------------------------------
  const [healthChecks, setHealthChecks] = useState<HealthCheckResult[]>(MOCK_HEALTH_CHECKS);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [autoRun, setAutoRun] = useState(false);
  const [lastRunAt, setLastRunAt] = useState<string>(new Date(Date.now() - 120000).toISOString());
  const autoRunRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // -------------------------------------------------------------------------
  // Ping State
  // -------------------------------------------------------------------------
  const [pingHost, setPingHost] = useState('192.168.1.10');
  const [pingResults, setPingResults] = useState<PingResult[]>(INITIAL_PING_RESULTS);
  const [isPinging, setIsPinging] = useState(false);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // -------------------------------------------------------------------------
  // Compare State
  // -------------------------------------------------------------------------
  const [compareA, setCompareA] = useState(MOCK_SWITCHES[0].ip);
  const [compareB, setCompareB] = useState(MOCK_SWITCHES[1].ip);
  const [compareResult, setCompareResult] = useState<CompareResult | null>(MOCK_COMPARE_RESULT);

  // -------------------------------------------------------------------------
  // Counter Reset State
  // -------------------------------------------------------------------------
  const [resetSwitch, setResetSwitch] = useState(MOCK_SWITCHES[0].ip);
  const [selectedPorts, setSelectedPorts] = useState<Set<number>>(new Set());
  const [resetLog, setResetLog] = useState<string[]>([]);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // -------------------------------------------------------------------------
  // Active Tab
  // -------------------------------------------------------------------------
  const [activeTab, setActiveTab] = useState<'ping' | 'compare' | 'reset'>('ping');

  // -------------------------------------------------------------------------
  // Auto-run timer
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (autoRun) {
      autoRunRef.current = setInterval(() => {
        handleRunAll();
      }, 5 * 60 * 1000); // 5 min
    }
    return () => {
      if (autoRunRef.current) clearInterval(autoRunRef.current);
    };
  }, [autoRun]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleRunAll = useCallback(() => {
    setIsRunningAll(true);
    // Simulate running checks
    setTimeout(() => {
      const updated = healthChecks.map((c) => ({
        ...c,
        runAt: new Date().toISOString(),
      }));
      setHealthChecks(updated);
      setLastRunAt(new Date().toISOString());
      setIsRunningAll(false);
    }, 2000);
  }, [healthChecks]);

  const handleRerun = useCallback((checkName: string) => {
    setHealthChecks((prev) =>
      prev.map((c) =>
        c.checkName === checkName ? { ...c, runAt: new Date().toISOString() } : c,
      ),
    );
  }, []);

  const handleToggleCard = useCallback((checkName: string) => {
    setExpandedCard((prev) => (prev === checkName ? null : checkName));
  }, []);

  // -- Ping --
  const handleStartPing = useCallback(() => {
    setIsPinging(true);
    setPingResults([]);
    pingIntervalRef.current = setInterval(() => {
      const roll = Math.random();
      const isTimeout = roll < 0.05;
      const result: PingResult = isTimeout
        ? {
            host: pingHost,
            alive: false,
            latencyMs: -1,
            timestamp: new Date().toISOString(),
            error: 'Request timed out',
          }
        : {
            host: pingHost,
            alive: true,
            latencyMs: Math.round((2 + Math.random() * 8) * 100) / 100,
            timestamp: new Date().toISOString(),
            ttl: 64,
          };
      setPingResults((prev) => [...prev.slice(-59), result]);
    }, 1000);
  }, [pingHost]);

  const handleStopPing = useCallback(() => {
    setIsPinging(false);
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    };
  }, []);

  // -- Compare --
  const handleCompare = useCallback(() => {
    // In a real app this would call QuickCompare.compare()
    setCompareResult(MOCK_COMPARE_RESULT);
  }, []);

  const handleSync = useCallback((field: string, direction: 'AtoB' | 'BtoA') => {
    const arrow = direction === 'AtoB' ? '\u2192' : '\u2190';
    console.log(`Sync ${field} ${arrow}`);
  }, []);

  // -- Counter Reset --
  const handleTogglePort = useCallback((port: number) => {
    setSelectedPorts((prev) => {
      const next = new Set(prev);
      if (next.has(port)) next.delete(port);
      else next.add(port);
      return next;
    });
  }, []);

  const handleSelectAllPorts = useCallback(() => {
    if (selectedPorts.size === MOCK_PORTS.length) {
      setSelectedPorts(new Set());
    } else {
      setSelectedPorts(new Set(MOCK_PORTS.map((p) => p.port)));
    }
  }, [selectedPorts.size]);

  const handleResetCounters = useCallback(() => {
    const sw = MOCK_SWITCHES.find((s) => s.ip === resetSwitch);
    const ports = [...selectedPorts].sort((a, b) => a - b).join(', ');
    const entry = `[${new Date().toLocaleTimeString()}] Reset counters on ${sw?.name ?? resetSwitch} ports: ${ports}`;
    setResetLog((prev) => [entry, ...prev]);
    setSelectedPorts(new Set());
    setShowResetConfirm(false);
  }, [resetSwitch, selectedPorts]);

  // -------------------------------------------------------------------------
  // Computed
  // -------------------------------------------------------------------------
  const counts = statusCounts(healthChecks);

  // Ping stats
  const aliveResults = pingResults.filter((r) => r.alive);
  const latencies = aliveResults.map((r) => r.latencyMs);
  const pingStats = {
    min: latencies.length > 0 ? Math.min(...latencies) : 0,
    max: latencies.length > 0 ? Math.max(...latencies) : 0,
    avg: latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0,
    jitter:
      latencies.length > 1
        ? latencies.reduce((sum, l, i) => (i > 0 ? sum + Math.abs(l - latencies[i - 1]) : sum), 0) /
          (latencies.length - 1)
        : 0,
    loss: pingResults.length > 0 ? ((pingResults.length - aliveResults.length) / pingResults.length) * 100 : 0,
    total: pingResults.length,
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="flex h-full flex-col overflow-hidden bg-gray-900 text-gray-100">
      {/* ================================================================= */}
      {/* HEADER                                                            */}
      {/* ================================================================= */}
      <header className="flex flex-shrink-0 items-center justify-between border-b border-gray-700/50 bg-gray-900/95 px-6 py-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <Activity className="h-6 w-6 text-cyan-400" />
          <h1 className="text-xl font-bold text-gray-100">Network Health</h1>
        </div>

        <div className="flex items-center gap-4">
          {/* Last run */}
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Clock className="h-3.5 w-3.5" />
            <span>
              Last run:{' '}
              {new Date(lastRunAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </span>
          </div>

          {/* Auto-run toggle */}
          <button
            onClick={() => setAutoRun(!autoRun)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              autoRun
                ? 'bg-cyan-500/20 text-cyan-400'
                : 'bg-gray-800 text-gray-500 hover:text-gray-300'
            }`}
          >
            {autoRun ? (
              <ToggleRight className="h-4 w-4" />
            ) : (
              <ToggleLeft className="h-4 w-4" />
            )}
            Auto (5m)
          </button>

          {/* Run All */}
          <button
            onClick={handleRunAll}
            disabled={isRunningAll}
            className="flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-cyan-600/20 transition-all hover:bg-cyan-500 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isRunningAll ? 'animate-spin' : ''}`} />
            {isRunningAll ? 'Running...' : 'Run All Checks'}
          </button>
        </div>
      </header>

      {/* ================================================================= */}
      {/* SCROLLABLE CONTENT                                                */}
      {/* ================================================================= */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {/* --------------------------------------------------------------- */}
        {/* Summary Strip                                                    */}
        {/* --------------------------------------------------------------- */}
        <div className="mb-6 flex items-center gap-4 rounded-lg border border-gray-700/50 bg-gray-800/50 px-5 py-3">
          <span className="mr-2 text-sm font-medium text-gray-400">Summary:</span>
          <div className="flex items-center gap-1.5 text-sm">
            <CheckCircle className="h-4 w-4 text-emerald-400" />
            <span className="font-bold text-emerald-400">{counts.pass}</span>
            <span className="text-gray-500">pass</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <AlertTriangle className="h-4 w-4 text-yellow-400" />
            <span className="font-bold text-yellow-400">{counts.warning}</span>
            <span className="text-gray-500">warnings</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <XCircle className="h-4 w-4 text-orange-400" />
            <span className="font-bold text-orange-400">{counts.fail}</span>
            <span className="text-gray-500">fail</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <AlertOctagon className="h-4 w-4 text-red-400" />
            <span className="font-bold text-red-400">{counts.critical}</span>
            <span className="text-gray-500">critical</span>
          </div>
        </div>

        {/* --------------------------------------------------------------- */}
        {/* Health Check Cards (3-col grid)                                  */}
        {/* --------------------------------------------------------------- */}
        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {healthChecks.map((check) => (
            <HealthCheckCard
              key={check.checkName}
              result={check}
              isExpanded={expandedCard === check.checkName}
              onToggle={() => handleToggleCard(check.checkName)}
              onRerun={() => handleRerun(check.checkName)}
            />
          ))}
        </div>

        {/* --------------------------------------------------------------- */}
        {/* Live Tools — Tabbed Section                                      */}
        {/* --------------------------------------------------------------- */}
        <div className="rounded-xl border border-gray-700/50 bg-gray-800/30">
          {/* Tab bar */}
          <div className="flex border-b border-gray-700/50">
            {([
              { id: 'ping' as const, label: 'Ping', icon: Wifi },
              { id: 'compare' as const, label: 'Quick Compare', icon: GitCompare },
              { id: 'reset' as const, label: 'Counter Reset', icon: RotateCcw },
            ]).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors ${
                  activeTab === id
                    ? 'border-b-2 border-cyan-500 text-cyan-400'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="p-5">
            {/* ============================================================= */}
            {/* PING TAB                                                       */}
            {/* ============================================================= */}
            {activeTab === 'ping' && (
              <div className="space-y-5">
                {/* Controls */}
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={pingHost}
                    onChange={(e) => setPingHost(e.target.value)}
                    placeholder="IP address..."
                    className="w-56 rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                    disabled={isPinging}
                  />
                  {!isPinging ? (
                    <button
                      onClick={handleStartPing}
                      className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
                    >
                      <Play className="h-4 w-4" />
                      Go
                    </button>
                  ) : (
                    <button
                      onClick={handleStopPing}
                      className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-500"
                    >
                      <Square className="h-4 w-4" />
                      Stop
                    </button>
                  )}
                  <span className="text-xs text-gray-500">
                    {pingResults.length} ping{pingResults.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Chart */}
                <PingChart results={pingResults} maxPoints={60} />

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
                  {[
                    { label: 'Min', value: `${pingStats.min.toFixed(2)} ms`, color: 'text-emerald-400' },
                    { label: 'Avg', value: `${pingStats.avg.toFixed(2)} ms`, color: 'text-cyan-400' },
                    { label: 'Max', value: `${pingStats.max.toFixed(2)} ms`, color: 'text-yellow-400' },
                    { label: 'Jitter', value: `${pingStats.jitter.toFixed(2)} ms`, color: 'text-purple-400' },
                    { label: 'Loss', value: `${pingStats.loss.toFixed(1)}%`, color: pingStats.loss > 0 ? 'text-red-400' : 'text-emerald-400' },
                    { label: 'Total', value: `${pingStats.total}`, color: 'text-gray-300' },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="rounded-lg border border-gray-700/50 bg-gray-900/50 px-3 py-2 text-center"
                    >
                      <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500">
                        {stat.label}
                      </p>
                      <p className={`mt-0.5 font-mono text-sm font-bold ${stat.color}`}>{stat.value}</p>
                    </div>
                  ))}
                </div>

                {/* Results table */}
                <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-700/50">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-gray-800">
                      <tr className="text-gray-500">
                        <th className="px-3 py-2 text-left font-medium">#</th>
                        <th className="px-3 py-2 text-left font-medium">Host</th>
                        <th className="px-3 py-2 text-left font-medium">Latency</th>
                        <th className="px-3 py-2 text-left font-medium">TTL</th>
                        <th className="px-3 py-2 text-left font-medium">Status</th>
                        <th className="px-3 py-2 text-left font-medium">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700/30">
                      {[...pingResults].reverse().map((r, idx) => (
                        <tr key={idx} className="text-gray-300 hover:bg-gray-800/50">
                          <td className="px-3 py-1.5 text-gray-500">{pingResults.length - idx}</td>
                          <td className="px-3 py-1.5 font-mono">{r.host}</td>
                          <td className="px-3 py-1.5 font-mono">
                            {r.alive ? `${r.latencyMs.toFixed(2)} ms` : '-'}
                          </td>
                          <td className="px-3 py-1.5">{r.ttl ?? '-'}</td>
                          <td className="px-3 py-1.5">
                            {r.alive ? (
                              <span className="inline-flex items-center gap-1 text-emerald-400">
                                <CheckCircle className="h-3 w-3" /> OK
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-red-400">
                                <XCircle className="h-3 w-3" /> {r.error ?? 'Timeout'}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-1.5 text-gray-500">
                            {new Date(r.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ============================================================= */}
            {/* COMPARE TAB                                                    */}
            {/* ============================================================= */}
            {activeTab === 'compare' && (
              <div className="space-y-5">
                {/* Dropdowns + button */}
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <label className="mb-1 block text-xs font-medium text-gray-400">Switch A</label>
                    <select
                      value={compareA}
                      onChange={(e) => setCompareA(e.target.value)}
                      className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-cyan-500 focus:outline-none"
                    >
                      {MOCK_SWITCHES.map((sw) => (
                        <option key={sw.ip} value={sw.ip}>
                          {sw.name} ({sw.ip})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="mb-1 block text-xs font-medium text-gray-400">Switch B</label>
                    <select
                      value={compareB}
                      onChange={(e) => setCompareB(e.target.value)}
                      className="w-full rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-cyan-500 focus:outline-none"
                    >
                      {MOCK_SWITCHES.map((sw) => (
                        <option key={sw.ip} value={sw.ip}>
                          {sw.name} ({sw.ip})
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={handleCompare}
                    className="flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-cyan-500"
                  >
                    <GitCompare className="h-4 w-4" />
                    Compare
                  </button>
                </div>

                {/* Comparison result */}
                {compareResult && (
                  <SwitchCompare result={compareResult} onSync={handleSync} />
                )}
              </div>
            )}

            {/* ============================================================= */}
            {/* COUNTER RESET TAB                                              */}
            {/* ============================================================= */}
            {activeTab === 'reset' && (
              <div className="space-y-5">
                {/* Switch selector */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-400">Switch</label>
                  <select
                    value={resetSwitch}
                    onChange={(e) => setResetSwitch(e.target.value)}
                    className="w-72 rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-cyan-500 focus:outline-none"
                  >
                    {MOCK_SWITCHES.map((sw) => (
                      <option key={sw.ip} value={sw.ip}>
                        {sw.name} ({sw.ip})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Port selection */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-xs font-medium text-gray-400">Select Ports</label>
                    <button
                      onClick={handleSelectAllPorts}
                      className="text-xs text-cyan-400 hover:text-cyan-300"
                    >
                      {selectedPorts.size === MOCK_PORTS.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                  <div className="grid grid-cols-8 gap-2">
                    {MOCK_PORTS.map((p) => (
                      <label
                        key={p.port}
                        className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs transition-colors ${
                          selectedPorts.has(p.port)
                            ? 'border-cyan-500 bg-cyan-500/10 text-cyan-300'
                            : 'border-gray-700 bg-gray-900/50 text-gray-400 hover:border-gray-600'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedPorts.has(p.port)}
                          onChange={() => handleTogglePort(p.port)}
                          className="sr-only"
                        />
                        <Server className="h-3 w-3" />
                        {p.port}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Reset button */}
                <div className="flex items-center gap-3">
                  {!showResetConfirm ? (
                    <button
                      onClick={() => setShowResetConfirm(true)}
                      disabled={selectedPorts.size === 0}
                      className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-500 disabled:opacity-50"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Reset Counters ({selectedPorts.size} port{selectedPorts.size !== 1 ? 's' : ''})
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-2">
                      <span className="text-sm text-red-300">
                        Reset {selectedPorts.size} port counter{selectedPorts.size !== 1 ? 's' : ''}?
                      </span>
                      <button
                        onClick={handleResetCounters}
                        className="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-500"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setShowResetConfirm(false)}
                        className="rounded bg-gray-700 px-3 py-1 text-xs font-medium text-gray-300 hover:bg-gray-600"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>

                {/* Reset log */}
                {resetLog.length > 0 && (
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <h4 className="text-xs font-medium text-gray-400">Reset Log</h4>
                      <button
                        onClick={() => setResetLog([])}
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300"
                      >
                        <Trash2 className="h-3 w-3" />
                        Clear
                      </button>
                    </div>
                    <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-700/50 bg-gray-900/50 p-3">
                      {resetLog.map((entry, idx) => (
                        <p key={idx} className="font-mono text-xs text-gray-400">
                          {entry}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* CSS for critical pulse animation                                   */}
      {/* ================================================================= */}
      <style>{`
        @keyframes criticalPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
          50% { box-shadow: 0 0 16px 4px rgba(239, 68, 68, 0.2); }
        }
        .animate-critical-pulse {
          animation: criticalPulse 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default TroubleshootView;
