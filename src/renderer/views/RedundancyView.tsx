import React, { useState, useMemo, useCallback } from 'react';
import {
  Shield,
  Network,
  Settings2,
  Zap,
  HeartPulse,
  ChevronDown,
  Save,
  Play,
  RotateCcw,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
  Crown,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import type {
  RedundancyConfig,
  RedundancyMember,
  FailoverSimResult,
} from '@shared/types';
import RedundancyRingDiagram from '../components/RedundancyRingDiagram';
import FailoverSimPanel from '../components/FailoverSimPanel';

/* ------------------------------------------------------------------ */
/*  Switch data                                                        */
/* ------------------------------------------------------------------ */

interface SwitchInfo {
  id: string;
  name: string;
  ip: string;
}

const SWITCHES: SwitchInfo[] = [
  { id: 'sw-core-01', name: 'GC-Core-01', ip: '10.0.1.1' },
  { id: 'sw-core-02', name: 'GC-Core-02', ip: '10.0.1.2' },
  { id: 'sw-foh', name: 'GC-FOH', ip: '10.0.1.20' },
  { id: 'sw-stage-l', name: 'GC-Stage-L', ip: '10.0.1.10' },
  { id: 'sw-stage-r', name: 'GC-Stage-R', ip: '10.0.1.11' },
  { id: 'sw-mon', name: 'GC-Monitor', ip: '10.0.1.30' },
];

const SWITCH_NAMES: Record<string, string> = Object.fromEntries(
  SWITCHES.map((s) => [s.id, s.name]),
);

/* ------------------------------------------------------------------ */
/*  Mock redundancy configs                                            */
/* ------------------------------------------------------------------ */

const RSTP_CONFIG: RedundancyConfig = {
  id: 'red-rstp-1',
  type: 'rstp',
  rootBridgeSwitchId: 'sw-core-01',
  status: 'healthy',
  lastFailover: '2026-03-15T14:22:00Z',
  members: [
    { switchId: 'sw-core-01', role: 'root', portA: 25, portB: 26, linkStatus: 'forwarding' },
    { switchId: 'sw-core-02', role: 'designated', portA: 25, portB: 26, linkStatus: 'forwarding' },
    { switchId: 'sw-foh', role: 'designated', portA: 13, portB: 14, linkStatus: 'forwarding' },
    { switchId: 'sw-stage-l', role: 'designated', portA: 11, portB: 12, linkStatus: 'forwarding' },
    { switchId: 'sw-stage-r', role: 'designated', portA: 11, portB: 12, linkStatus: 'forwarding' },
    { switchId: 'sw-mon', role: 'blocking', portA: 17, portB: 18, linkStatus: 'blocking' },
  ],
};

const RLINKX_CONFIG: RedundancyConfig = {
  id: 'red-rlinkx-1',
  type: 'rlinkx',
  rootBridgeSwitchId: 'sw-core-01',
  status: 'healthy',
  lastFailover: '2026-03-12T09:45:00Z',
  members: [
    { switchId: 'sw-core-01', role: 'root', portA: 25, portB: 26, linkStatus: 'forwarding' },
    { switchId: 'sw-core-02', role: 'designated', portA: 25, portB: 26, linkStatus: 'forwarding' },
    { switchId: 'sw-foh', role: 'designated', portA: 13, portB: 14, linkStatus: 'forwarding' },
    { switchId: 'sw-stage-l', role: 'designated', portA: 11, portB: 12, linkStatus: 'forwarding' },
    { switchId: 'sw-stage-r', role: 'designated', portA: 11, portB: 12, linkStatus: 'forwarding' },
    { switchId: 'sw-mon', role: 'designated', portA: 17, portB: 18, linkStatus: 'forwarding' },
  ],
};

/* ------------------------------------------------------------------ */
/*  Mock failover simulation results                                   */
/* ------------------------------------------------------------------ */

const SIM_RESULTS: FailoverSimResult[] = [
  {
    brokenLink: { switchA: 'sw-core-01', portA: 26, switchB: 'sw-core-02', portB: 25 },
    newPath: ['sw-core-01', 'sw-foh', 'sw-stage-l', 'sw-stage-r', 'sw-mon', 'sw-core-02'],
    convergenceTimeMs: 35,
    affectedFlows: ['flow-dante-1', 'flow-dante-2', 'flow-ndi-1'],
    status: 'recovered',
  },
  {
    brokenLink: { switchA: 'sw-foh', portA: 14, switchB: 'sw-stage-l', portB: 11 },
    newPath: ['sw-foh', 'sw-core-01', 'sw-core-02', 'sw-mon', 'sw-stage-r', 'sw-stage-l'],
    convergenceTimeMs: 120,
    affectedFlows: ['flow-sacn-1', 'flow-artnet-1', 'flow-dante-3', 'flow-manet-1', 'flow-comms-1'],
    status: 'partial',
  },
];

const FLOW_LABELS: Record<string, string> = {
  'flow-dante-1': 'Console L/R Main',
  'flow-dante-2': 'Console Aux 1-8',
  'flow-dante-3': 'Stage Box SL',
  'flow-sacn-1': 'sACN Univ 1-10',
  'flow-artnet-1': 'Art-Net Media Servers',
  'flow-ndi-1': 'NDI Camera 1 (4K)',
  'flow-manet-1': 'grandMA3 Session',
  'flow-comms-1': 'Intercom Matrix',
};

/* ------------------------------------------------------------------ */
/*  Link state history                                                 */
/* ------------------------------------------------------------------ */

interface LinkEvent {
  timestamp: string;
  fromSwitch: string;
  toSwitch: string;
  portA: number;
  portB: number;
  oldState: string;
  newState: string;
}

const LINK_HISTORY: LinkEvent[] = [
  { timestamp: '2026-03-15T14:22:00Z', fromSwitch: 'sw-core-01', toSwitch: 'sw-core-02', portA: 26, portB: 25, oldState: 'forwarding', newState: 'disabled' },
  { timestamp: '2026-03-15T14:22:01Z', fromSwitch: 'sw-mon', toSwitch: 'sw-core-02', portA: 18, portB: 26, oldState: 'blocking', newState: 'forwarding' },
  { timestamp: '2026-03-15T14:22:35Z', fromSwitch: 'sw-core-01', toSwitch: 'sw-core-02', portA: 26, portB: 25, oldState: 'disabled', newState: 'forwarding' },
  { timestamp: '2026-03-15T14:22:36Z', fromSwitch: 'sw-mon', toSwitch: 'sw-core-02', portA: 18, portB: 26, oldState: 'forwarding', newState: 'blocking' },
  { timestamp: '2026-03-12T09:45:00Z', fromSwitch: 'sw-foh', toSwitch: 'sw-stage-l', portA: 14, portB: 11, oldState: 'forwarding', newState: 'disabled' },
  { timestamp: '2026-03-12T09:45:02Z', fromSwitch: 'sw-foh', toSwitch: 'sw-stage-l', portA: 14, portB: 11, oldState: 'disabled', newState: 'learning' },
  { timestamp: '2026-03-12T09:45:05Z', fromSwitch: 'sw-foh', toSwitch: 'sw-stage-l', portA: 14, portB: 11, oldState: 'learning', newState: 'forwarding' },
];

/* ------------------------------------------------------------------ */
/*  Tabs                                                               */
/* ------------------------------------------------------------------ */

type TabId = 'topology' | 'config' | 'failover' | 'health';

const TABS: { id: TabId; label: string; Icon: React.ComponentType<any> }[] = [
  { id: 'topology', label: 'Topology', Icon: Network },
  { id: 'config', label: 'Configuration', Icon: Settings2 },
  { id: 'failover', label: 'Failover Simulation', Icon: Zap },
  { id: 'health', label: 'Health', Icon: HeartPulse },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function RedundancyView() {
  const [activeTab, setActiveTab] = useState<TabId>('topology');
  const [activeConfig, setActiveConfig] = useState<'rstp' | 'rlinkx'>('rstp');

  // Config tab state
  const [configType, setConfigType] = useState<'rstp' | 'rlinkx' | 'ring'>('rstp');
  const [rootBridge, setRootBridge] = useState('sw-core-01');
  const [rlinkxGroupAware, setRlinkxGroupAware] = useState(false);
  const [rlinkxVlans, setRlinkxVlans] = useState('10,11,20');
  const [configSaved, setConfigSaved] = useState(false);

  // Failover tab state
  const [selectedSimLink, setSelectedSimLink] = useState<{ from: string; to: string } | null>(null);
  const [simRunning, setSimRunning] = useState(false);
  const [simResult, setSimResult] = useState<FailoverSimResult | null>(null);

  const currentConfig = activeConfig === 'rstp' ? RSTP_CONFIG : RLINKX_CONFIG;

  /* ---- Failover sim ---- */
  const handleLinkClick = useCallback((fromId: string, toId: string) => {
    setSelectedSimLink({ from: fromId, to: toId });
    setSimResult(null);
  }, []);

  const runSimulation = useCallback(() => {
    if (!selectedSimLink) return;
    setSimRunning(true);
    // Simulate async computation
    setTimeout(() => {
      // Find a matching sim result or generate a generic one
      const match = SIM_RESULTS.find(
        (r) =>
          (r.brokenLink.switchA === selectedSimLink.from &&
            r.brokenLink.switchB === selectedSimLink.to) ||
          (r.brokenLink.switchA === selectedSimLink.to &&
            r.brokenLink.switchB === selectedSimLink.from),
      );
      setSimResult(
        match ?? {
          brokenLink: {
            switchA: selectedSimLink.from,
            portA: 25,
            switchB: selectedSimLink.to,
            portB: 25,
          },
          newPath: currentConfig.members
            .map((m) => m.switchId)
            .filter((id) => id !== selectedSimLink.from && id !== selectedSimLink.to),
          convergenceTimeMs: 45,
          affectedFlows: ['flow-dante-1'],
          status: 'recovered',
        },
      );
      setSimRunning(false);
    }, 800);
  }, [selectedSimLink, currentConfig]);

  const handleSaveConfig = useCallback(() => {
    setConfigSaved(true);
    setTimeout(() => setConfigSaved(false), 2000);
  }, []);

  /* ---- Status helpers ---- */
  const statusColor = (s: RedundancyConfig['status']) =>
    s === 'healthy' ? 'text-green-400' : s === 'degraded' ? 'text-yellow-400' : 'text-red-400';

  const statusBg = (s: RedundancyConfig['status']) =>
    s === 'healthy'
      ? 'bg-green-500/10 border-green-500/30'
      : s === 'degraded'
        ? 'bg-yellow-500/10 border-yellow-500/30'
        : 'bg-red-500/10 border-red-500/30';

  const linkStateColor = (ls: string) =>
    ls === 'forwarding'
      ? 'text-green-400'
      : ls === 'blocking'
        ? 'text-yellow-400'
        : ls === 'learning'
          ? 'text-blue-400'
          : 'text-gray-500';

  const linkStateBg = (ls: string) =>
    ls === 'forwarding'
      ? 'bg-green-500/10'
      : ls === 'blocking'
        ? 'bg-yellow-500/10'
        : ls === 'learning'
          ? 'bg-blue-500/10'
          : 'bg-gray-700/30';

  return (
    <div className="flex flex-col h-full bg-gc-dark text-gray-100">
      {/* ---- Header ---- */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-gc-accent" />
            Redundancy
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Network redundancy, failover simulation &amp; health monitoring
          </p>
        </div>

        {/* Config selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Active config:</span>
          <div className="flex rounded-lg overflow-hidden border border-gray-700">
            <button
              onClick={() => setActiveConfig('rstp')}
              className={`px-3 py-1.5 text-xs font-medium transition ${
                activeConfig === 'rstp'
                  ? 'bg-gc-accent text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              RSTP Ring
            </button>
            <button
              onClick={() => setActiveConfig('rlinkx')}
              className={`px-3 py-1.5 text-xs font-medium transition ${
                activeConfig === 'rlinkx'
                  ? 'bg-gc-accent text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              RLinkX
            </button>
          </div>
          <div className={`ml-2 px-2 py-0.5 rounded border text-xs font-medium ${statusBg(currentConfig.status)} ${statusColor(currentConfig.status)}`}>
            {currentConfig.status}
          </div>
        </div>
      </div>

      {/* ---- Tabs ---- */}
      <div className="flex border-b border-gray-700 px-6">
        {TABS.map((tab) => {
          const Icon = tab.Icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition ${
                activeTab === tab.id
                  ? 'border-gc-accent text-white'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ---- Tab content ---- */}
      <div className="flex-1 overflow-y-auto">
        {/* ======== TOPOLOGY TAB ======== */}
        {activeTab === 'topology' && (
          <div className="flex h-full">
            {/* Ring diagram */}
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="bg-gray-800/40 rounded-xl border border-gray-700 p-4">
                <RedundancyRingDiagram
                  config={currentConfig}
                  switches={SWITCHES}
                  width={480}
                  height={480}
                />
              </div>
            </div>

            {/* Member list */}
            <div className="w-72 border-l border-gray-700 p-4 overflow-y-auto">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Ring Members ({currentConfig.members.length})
              </h3>
              <div className="space-y-2">
                {currentConfig.members.map((m) => (
                  <div
                    key={m.switchId}
                    className="bg-gray-800 rounded-lg p-3 border border-gray-700"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        {m.role === 'root' && (
                          <Crown className="w-3.5 h-3.5 text-yellow-400" />
                        )}
                        <span className="text-sm font-medium text-gray-200">
                          {SWITCH_NAMES[m.switchId]}
                        </span>
                      </div>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${linkStateBg(m.linkStatus)} ${linkStateColor(m.linkStatus)}`}
                      >
                        {m.linkStatus}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>Role: <span className="text-gray-300">{m.role}</span></span>
                      <span>A:P{m.portA}</span>
                      <span>B:P{m.portB}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Type info */}
              <div className="mt-4 bg-gray-800/60 rounded-lg p-3 border border-gray-700/50">
                <div className="text-xs text-gray-500 space-y-1.5">
                  <div className="flex justify-between">
                    <span>Type</span>
                    <span className="text-gray-300 uppercase">{currentConfig.type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Root Bridge</span>
                    <span className="text-gray-300">
                      {SWITCH_NAMES[currentConfig.rootBridgeSwitchId ?? ''] ?? 'None'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Last Failover</span>
                    <span className="text-gray-300">
                      {currentConfig.lastFailover
                        ? new Date(currentConfig.lastFailover).toLocaleDateString()
                        : 'Never'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======== CONFIGURATION TAB ======== */}
        {activeTab === 'config' && (
          <div className="p-6 max-w-3xl">
            <div className="space-y-6">
              {/* Redundancy type */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2">
                  Redundancy Type
                </label>
                <div className="flex gap-2">
                  {(['rstp', 'rlinkx', 'ring'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setConfigType(t)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${
                        configType === t
                          ? 'bg-gc-accent/20 border-gc-accent text-white'
                          : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
                      }`}
                    >
                      {t.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Root bridge */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2">
                  Root Bridge
                </label>
                <div className="relative w-64">
                  <select
                    value={rootBridge}
                    onChange={(e) => setRootBridge(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 appearance-none focus:outline-none focus:border-gc-accent"
                  >
                    {SWITCHES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.ip})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                </div>
              </div>

              {/* RLinkX group-aware toggle */}
              {configType === 'rlinkx' && (
                <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="text-sm font-medium text-gray-200">
                        Group-Aware RLinkX
                      </h4>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Enable per-VLAN redundancy for RLinkX ring
                      </p>
                    </div>
                    <button
                      onClick={() => setRlinkxGroupAware(!rlinkxGroupAware)}
                      className="text-gc-accent"
                    >
                      {rlinkxGroupAware ? (
                        <ToggleRight className="w-8 h-8" />
                      ) : (
                        <ToggleLeft className="w-8 h-8 text-gray-600" />
                      )}
                    </button>
                  </div>
                  {rlinkxGroupAware && (
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        VLAN IDs (comma-separated)
                      </label>
                      <input
                        type="text"
                        value={rlinkxVlans}
                        onChange={(e) => setRlinkxVlans(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-600 rounded-md px-3 py-1.5 text-sm text-gray-200 font-mono focus:outline-none focus:border-gc-accent"
                        placeholder="10,11,20,30"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Member list with port assignments */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2">
                  Ring Members &amp; Port Assignments
                </label>
                <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-gray-500 border-b border-gray-700">
                        <th className="text-left px-4 py-2 font-medium">Switch</th>
                        <th className="text-left px-4 py-2 font-medium">IP</th>
                        <th className="text-center px-4 py-2 font-medium">Port A</th>
                        <th className="text-center px-4 py-2 font-medium">Port B</th>
                        <th className="text-center px-4 py-2 font-medium">Role</th>
                      </tr>
                    </thead>
                    <tbody>
                      {SWITCHES.map((sw) => {
                        const member = currentConfig.members.find(
                          (m) => m.switchId === sw.id,
                        );
                        return (
                          <tr key={sw.id} className="border-b border-gray-700/50">
                            <td className="px-4 py-2.5 text-gray-200 font-medium flex items-center gap-1.5">
                              {sw.id === rootBridge && (
                                <Crown className="w-3.5 h-3.5 text-yellow-400" />
                              )}
                              {sw.name}
                            </td>
                            <td className="px-4 py-2.5 text-gray-400 font-mono text-xs">
                              {sw.ip}
                            </td>
                            <td className="px-4 py-2.5 text-center text-gray-300 font-mono">
                              {member?.portA ?? '-'}
                            </td>
                            <td className="px-4 py-2.5 text-center text-gray-300 font-mono">
                              {member?.portB ?? '-'}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                  member?.role === 'root'
                                    ? 'bg-blue-500/10 text-blue-400'
                                    : member?.role === 'blocking'
                                      ? 'bg-yellow-500/10 text-yellow-400'
                                      : 'bg-gray-700 text-gray-400'
                                }`}
                              >
                                {member?.role ?? 'none'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Save button */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSaveConfig}
                  className="flex items-center gap-2 px-4 py-2 bg-gc-accent hover:bg-gc-accent/80 text-white rounded-lg text-sm font-medium transition"
                >
                  <Save className="w-4 h-4" />
                  Save Configuration
                </button>
                {configSaved && (
                  <span className="text-xs text-green-400 flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Configuration saved
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ======== FAILOVER SIMULATION TAB ======== */}
        {activeTab === 'failover' && (
          <div className="flex h-full">
            {/* Left: ring diagram for selecting links */}
            <div className="flex-1 flex flex-col items-center justify-center p-6">
              <p className="text-xs text-gray-500 mb-3">
                Click a link in the ring to select it for simulation
              </p>
              <div className="bg-gray-800/40 rounded-xl border border-gray-700 p-4">
                <RedundancyRingDiagram
                  config={currentConfig}
                  switches={SWITCHES}
                  selectedLink={selectedSimLink}
                  onLinkClick={handleLinkClick}
                  width={420}
                  height={420}
                />
              </div>
              {selectedSimLink && (
                <div className="mt-4 flex items-center gap-3">
                  <span className="text-xs text-gray-400">
                    Selected: {SWITCH_NAMES[selectedSimLink.from]} ---{' '}
                    {SWITCH_NAMES[selectedSimLink.to]}
                  </span>
                  <button
                    onClick={runSimulation}
                    disabled={simRunning}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-500 disabled:bg-gray-600 text-white rounded-lg text-xs font-medium transition"
                  >
                    {simRunning ? (
                      <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Play className="w-3.5 h-3.5" />
                    )}
                    {simRunning ? 'Simulating...' : 'Break Link & Simulate'}
                  </button>
                </div>
              )}
            </div>

            {/* Right: simulation results */}
            <div className="w-96 border-l border-gray-700 p-4 overflow-y-auto">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
                Simulation Results
              </h3>

              {simResult ? (
                <FailoverSimPanel
                  result={simResult}
                  switchNames={SWITCH_NAMES}
                  flowLabels={FLOW_LABELS}
                />
              ) : (
                <div className="text-center py-12">
                  <Zap className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">
                    Select a link and run simulation
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    Click on any link in the ring diagram
                  </p>
                </div>
              )}

              {/* Pre-computed scenarios */}
              <div className="mt-6">
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Saved Scenarios
                </h4>
                <div className="space-y-3">
                  {SIM_RESULTS.map((sr, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setSelectedSimLink({
                          from: sr.brokenLink.switchA,
                          to: sr.brokenLink.switchB,
                        });
                        setSimResult(sr);
                      }}
                      className="w-full text-left bg-gray-800 rounded-lg border border-gray-700 p-3 hover:border-gray-500 transition"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-300 font-medium">
                          {SWITCH_NAMES[sr.brokenLink.switchA]} &harr;{' '}
                          {SWITCH_NAMES[sr.brokenLink.switchB]}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            sr.status === 'recovered'
                              ? 'bg-green-500/10 text-green-400'
                              : sr.status === 'partial'
                                ? 'bg-yellow-500/10 text-yellow-400'
                                : 'bg-red-500/10 text-red-400'
                          }`}
                        >
                          {sr.status}
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-500">
                        {sr.convergenceTimeMs}ms &middot; {sr.affectedFlows.length} flows affected
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======== HEALTH TAB ======== */}
        {activeTab === 'health' && (
          <div className="p-6 space-y-6 max-w-4xl">
            {/* Status overview */}
            <div className="grid grid-cols-4 gap-4">
              <div className={`rounded-lg border p-4 ${statusBg(currentConfig.status)}`}>
                <div className="text-xs text-gray-400 mb-1">Status</div>
                <div className={`text-lg font-bold capitalize ${statusColor(currentConfig.status)}`}>
                  {currentConfig.status}
                </div>
              </div>
              <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
                <div className="text-xs text-gray-400 mb-1">Type</div>
                <div className="text-lg font-bold text-white uppercase">
                  {currentConfig.type}
                </div>
              </div>
              <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
                <div className="text-xs text-gray-400 mb-1">Members</div>
                <div className="text-lg font-bold text-white">
                  {currentConfig.members.length}
                </div>
              </div>
              <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-4">
                <div className="text-xs text-gray-400 mb-1">Last Failover</div>
                <div className="text-sm font-bold text-white">
                  {currentConfig.lastFailover
                    ? new Date(currentConfig.lastFailover).toLocaleString()
                    : 'Never'}
                </div>
              </div>
            </div>

            {/* Member health */}
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Member Link States
              </h3>
              <div className="grid grid-cols-3 gap-3">
                {currentConfig.members.map((m) => (
                  <div
                    key={m.switchId}
                    className="bg-gray-800 rounded-lg border border-gray-700 p-3"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-200 flex items-center gap-1.5">
                        {m.role === 'root' && <Crown className="w-3 h-3 text-yellow-400" />}
                        {SWITCH_NAMES[m.switchId]}
                      </span>
                      <span
                        className={`w-2 h-2 rounded-full ${
                          m.linkStatus === 'forwarding'
                            ? 'bg-green-400'
                            : m.linkStatus === 'blocking'
                              ? 'bg-yellow-400'
                              : 'bg-gray-500'
                        }`}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-gray-900/50 rounded px-2 py-1">
                        <span className="text-gray-500">Port A:</span>{' '}
                        <span className="text-gray-300">P{m.portA}</span>
                      </div>
                      <div className="bg-gray-900/50 rounded px-2 py-1">
                        <span className="text-gray-500">Port B:</span>{' '}
                        <span className="text-gray-300">P{m.portB}</span>
                      </div>
                    </div>
                    <div className="mt-2">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${linkStateBg(m.linkStatus)} ${linkStateColor(m.linkStatus)}`}
                      >
                        {m.linkStatus}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Link state history */}
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Link State History
              </h3>
              <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500 border-b border-gray-700">
                      <th className="text-left px-4 py-2 font-medium">Timestamp</th>
                      <th className="text-left px-4 py-2 font-medium">Link</th>
                      <th className="text-left px-4 py-2 font-medium">Ports</th>
                      <th className="text-center px-4 py-2 font-medium">Old State</th>
                      <th className="text-center px-4 py-2 font-medium"></th>
                      <th className="text-center px-4 py-2 font-medium">New State</th>
                    </tr>
                  </thead>
                  <tbody>
                    {LINK_HISTORY.map((ev, i) => (
                      <tr key={i} className="border-b border-gray-700/50">
                        <td className="px-4 py-2 text-gray-400 font-mono">
                          {new Date(ev.timestamp).toLocaleString()}
                        </td>
                        <td className="px-4 py-2 text-gray-300">
                          {SWITCH_NAMES[ev.fromSwitch]} &harr; {SWITCH_NAMES[ev.toSwitch]}
                        </td>
                        <td className="px-4 py-2 text-gray-500 font-mono">
                          P{ev.portA} &harr; P{ev.portB}
                        </td>
                        <td className="px-4 py-2 text-center">
                          <span className={`px-1.5 py-0.5 rounded ${linkStateBg(ev.oldState)} ${linkStateColor(ev.oldState)}`}>
                            {ev.oldState}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-center text-gray-600">
                          &rarr;
                        </td>
                        <td className="px-4 py-2 text-center">
                          <span className={`px-1.5 py-0.5 rounded ${linkStateBg(ev.newState)} ${linkStateColor(ev.newState)}`}>
                            {ev.newState}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
