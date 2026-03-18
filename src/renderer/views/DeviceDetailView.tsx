import React, { useState, useCallback, useMemo } from 'react';
import {
  ArrowLeft, Monitor, Pencil, Check, X, Cpu, Thermometer, Fan, Clock,
  Network, Shield, Activity, ScrollText, Cable, Zap, Layers, Radio,
  Info, ChevronRight,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { VIEWS } from '@shared/constants';
import { HealthIndicator } from '../components/HealthIndicator';
import { PortDetailGrid } from '../components/PortDetailGrid';
import { GroupEditor, type GroupConfig } from '../components/GroupEditor';
import { PoEPanel, type PoeSummary, type PoePortInfo } from '../components/PoEPanel';
import { PortTable, type PortInfoExtended } from '../components/PortTable';
import { TrunkConfig, type TrunkPort } from '../components/TrunkConfig';
import type { PortInfo } from '../types';

// ─── Tab Definitions ─────────────────────────────────────────────────────────

type TabId = 'overview' | 'groups' | 'poe' | 'ports' | 'trunks' | 'igmp' | 'logs';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <Info size={14} /> },
  { id: 'groups', label: 'Groups', icon: <Layers size={14} /> },
  { id: 'poe', label: 'PoE', icon: <Zap size={14} /> },
  { id: 'ports', label: 'Ports', icon: <Network size={14} /> },
  { id: 'trunks', label: 'Trunks', icon: <Cable size={14} /> },
  { id: 'igmp', label: 'IGMP', icon: <Radio size={14} /> },
  { id: 'logs', label: 'Logs', icon: <ScrollText size={14} /> },
];

// ─── Mock Data Generator ─────────────────────────────────────────────────────

const SOLOTECH_GROUPS: GroupConfig[] = [
  { id: 1, name: 'Mgmt', vlanId: 1, color: '#6366f1', igmpSnooping: true, igmpQuerier: true, flooding: false },
  { id: 2, name: 'D3-Net', vlanId: 10, color: '#3b82f6', igmpSnooping: true, igmpQuerier: false, flooding: true },
  { id: 3, name: 'D3-Ctrl', vlanId: 20, color: '#06b6d4', igmpSnooping: true, igmpQuerier: false, flooding: true },
  { id: 4, name: 'NDI', vlanId: 30, color: '#22c55e', igmpSnooping: true, igmpQuerier: true, flooding: false },
  { id: 5, name: 'Art-Net', vlanId: 40, color: '#eab308', igmpSnooping: false, igmpQuerier: false, flooding: true },
  { id: 6, name: 'Intercom', vlanId: 50, color: '#f97316', igmpSnooping: false, igmpQuerier: false, flooding: true },
  { id: 7, name: 'Control', vlanId: 100, color: '#ec4899', igmpSnooping: false, igmpQuerier: false, flooding: true },
  { id: 8, name: 'Dante-Pri', vlanId: 1300, color: '#a855f7', igmpSnooping: true, igmpQuerier: true, flooding: false },
  { id: 9, name: 'Dante-Sec', vlanId: 1301, color: '#8b5cf6', igmpSnooping: true, igmpQuerier: true, flooding: false },
];

const DEVICES = [
  'Dante AVIO', 'Shure ULXD4', 'PTZ Camera 1', 'Barco E2', 'disguise gx2c',
  'ClearCom Agent-IC', 'Luminaire #1', 'NDI Encoder', '', '', '', '', '', '', '', '',
];

function generateMockPorts(model: string): (PortInfo & PortInfoExtended)[] {
  let total = 16;
  if (model.includes('10')) total = 12;
  else if (model.includes('14')) total = 14;
  else if (model.includes('16')) total = 16;
  else if (model.includes('18')) total = 18;
  else if (model.includes('20')) total = 20;
  else if (model.includes('26')) total = 26;
  else if (model.includes('30')) total = 30;

  const sfpCount = total <= 14 ? 2 : total <= 20 ? 4 : total <= 26 ? 2 : 6;
  const copperCount = total - sfpCount;

  const ports: (PortInfo & PortInfoExtended)[] = [];
  for (let i = 1; i <= total; i++) {
    const isSfp = i > copperCount;
    const isUp = Math.random() > 0.3;
    const groupIdx = Math.floor(Math.random() * SOLOTECH_GROUPS.length);
    const group = SOLOTECH_GROUPS[groupIdx];
    const speeds = isSfp ? ['1G', '10G'] : ['100M', '1G'];
    const speed = isUp ? speeds[Math.floor(Math.random() * speeds.length)] : '';
    const device = DEVICES[i % DEVICES.length];

    ports.push({
      port: i,
      label: isSfp ? `SFP${i - copperCount}` : `Port ${i}`,
      adminStatus: 'up',
      operStatus: isUp ? 'up' : 'down',
      speed,
      type: isSfp ? (i === total ? 'sfp+' : 'sfp') : 'copper',
      groupId: group.id,
      groupName: group.name,
      groupColor: group.color,
      poeEnabled: !isSfp && Math.random() > 0.3,
      poeWatts: !isSfp && isUp ? Math.round(Math.random() * 30 * 10) / 10 : 0,
      connectedDevice: isUp ? device : undefined,
      duplex: isUp ? 'Full' : undefined,
      vlanMode: Math.random() > 0.5 ? 'Access' : 'Trunk',
      txBytes: isUp ? Math.floor(Math.random() * 50 * 1024 * 1024 * 1024) : 0,
      rxBytes: isUp ? Math.floor(Math.random() * 50 * 1024 * 1024 * 1024) : 0,
      errors: Math.random() > 0.9 ? Math.floor(Math.random() * 15) : 0,
    });
  }
  return ports;
}

function generateMockPoeSummary(ports: (PortInfo & PortInfoExtended)[]): PoeSummary {
  const poePorts: PoePortInfo[] = ports
    .filter((p) => p.type === 'copper')
    .map((p) => ({
      port: p.port,
      label: p.label,
      enabled: p.poeEnabled ?? false,
      status: !p.poeEnabled ? 'disabled' as const
        : p.operStatus === 'up' && (p.poeWatts ?? 0) > 0 ? 'delivering' as const
        : p.operStatus === 'up' ? 'searching' as const
        : 'searching' as const,
      class: (p.poeWatts ?? 0) > 25 ? 'Class 4' : (p.poeWatts ?? 0) > 15 ? 'Class 3' : (p.poeWatts ?? 0) > 7 ? 'Class 2' : 'Class 1',
      drawWatts: p.poeWatts ?? 0,
      maxWatts: (p.poeWatts ?? 0) > 25 ? 30 : (p.poeWatts ?? 0) > 15 ? 25.5 : 15.4,
      priority: 'low' as const,
    }));

  const totalDraw = poePorts.reduce((sum, p) => sum + p.drawWatts, 0);
  return {
    totalBudgetWatts: 370,
    totalDrawWatts: totalDraw,
    ports: poePorts,
  };
}

function generateMockTrunks(ports: (PortInfo & PortInfoExtended)[]): TrunkPort[] {
  return ports
    .filter((p) => p.vlanMode === 'Trunk' && p.operStatus === 'up')
    .slice(0, 4)
    .map((p, idx) => ({
      port: p.port,
      label: p.label,
      operStatus: p.operStatus,
      isISL: idx < 2,
      connectedSwitch: idx < 2 ? `GC-${idx === 0 ? '26' : '16'}` : undefined,
      allowedGroups: SOLOTECH_GROUPS.slice(0, 3 + idx).map((g) => ({
        id: g.id,
        name: g.name,
        color: g.color,
        tagged: Math.random() > 0.5,
      })),
    }));
}

interface MockLogEntry {
  id: number;
  timestamp: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  category: string;
  message: string;
}

function generateMockLogs(): MockLogEntry[] {
  const now = Date.now();
  const entries: MockLogEntry[] = [
    { id: 1, timestamp: new Date(now - 60000).toISOString(), severity: 'info', category: 'link', message: 'Port 3 link up at 1G Full-Duplex' },
    { id: 2, timestamp: new Date(now - 120000).toISOString(), severity: 'info', category: 'link', message: 'Port 7 link down' },
    { id: 3, timestamp: new Date(now - 300000).toISOString(), severity: 'warning', category: 'poe', message: 'Port 5 PoE overcurrent detected, renegotiating' },
    { id: 4, timestamp: new Date(now - 600000).toISOString(), severity: 'info', category: 'discovery', message: 'LLDP neighbor discovered on port 12: Shure ULXD4' },
    { id: 5, timestamp: new Date(now - 900000).toISOString(), severity: 'error', category: 'health', message: 'Fan 2 speed below threshold (1200 RPM)' },
    { id: 6, timestamp: new Date(now - 1200000).toISOString(), severity: 'info', category: 'config', message: 'Port 8 VLAN changed from 10 to 30' },
    { id: 7, timestamp: new Date(now - 1800000).toISOString(), severity: 'info', category: 'link', message: 'Port 15 SFP module inserted (10G-SR)' },
    { id: 8, timestamp: new Date(now - 3600000).toISOString(), severity: 'warning', category: 'health', message: 'Temperature sensor reading 62C (threshold: 65C)' },
    { id: 9, timestamp: new Date(now - 7200000).toISOString(), severity: 'info', category: 'system', message: 'Configuration saved to flash' },
    { id: 10, timestamp: new Date(now - 14400000).toISOString(), severity: 'critical', category: 'poe', message: 'PoE budget exceeded 95%, low-priority ports may be denied' },
  ];
  return entries;
}

// ─── IGMP Mock Data ──────────────────────────────────────────────────────────

interface IgmpGroupEntry {
  multicastGroup: string;
  vlan: number;
  groupName: string;
  subscriberPorts: number[];
  version: string;
  lastReport: string;
}

function generateMockIgmp(): IgmpGroupEntry[] {
  return [
    { multicastGroup: '239.255.0.1', vlan: 30, groupName: 'NDI', subscriberPorts: [1, 3, 5, 7], version: 'v3', lastReport: '2s ago' },
    { multicastGroup: '239.255.0.2', vlan: 30, groupName: 'NDI', subscriberPorts: [1, 5], version: 'v3', lastReport: '5s ago' },
    { multicastGroup: '239.69.0.1', vlan: 1300, groupName: 'Dante-Pri', subscriberPorts: [2, 4, 6, 8, 10, 12], version: 'v2', lastReport: '1s ago' },
    { multicastGroup: '239.69.0.2', vlan: 1300, groupName: 'Dante-Pri', subscriberPorts: [4, 8], version: 'v2', lastReport: '3s ago' },
    { multicastGroup: '239.69.0.1', vlan: 1301, groupName: 'Dante-Sec', subscriberPorts: [2, 4, 6, 8, 10, 12], version: 'v2', lastReport: '1s ago' },
    { multicastGroup: '239.255.255.250', vlan: 1, groupName: 'Mgmt', subscriberPorts: [1], version: 'v2', lastReport: '30s ago' },
  ];
}

// ─── Editable Name ───────────────────────────────────────────────────────────

const EditableName: React.FC<{ name: string; onSave: (name: string) => void }> = ({ name, onSave }) => {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { onSave(value); setEditing(false); }
            if (e.key === 'Escape') { setValue(name); setEditing(false); }
          }}
          className="bg-gray-800 border border-gc-accent/50 rounded px-3 py-1 text-xl font-semibold text-white outline-none"
        />
        <button onClick={() => { onSave(value); setEditing(false); }} className="p-1 text-green-400 hover:bg-green-400/20 rounded">
          <Check size={16} />
        </button>
        <button onClick={() => { setValue(name); setEditing(false); }} className="p-1 text-gray-400 hover:bg-gray-600 rounded">
          <X size={16} />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="flex items-center gap-2 group"
    >
      <h1 className="text-xl font-semibold text-white">{name}</h1>
      <Pencil size={14} className="text-gray-600 group-hover:text-gray-400 transition-colors" />
    </button>
  );
};

// ─── Info Card ───────────────────────────────────────────────────────────────

const InfoCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string | React.ReactNode;
  subValue?: string;
}> = ({ icon, label, value, subValue }) => (
  <div className="bg-gc-panel rounded-lg border border-gray-700 p-4 flex items-start gap-3">
    <div className="p-2 bg-gray-800 rounded-lg text-gc-accent">{icon}</div>
    <div>
      <div className="text-xs text-gray-400 uppercase tracking-wider">{label}</div>
      <div className="text-lg font-semibold text-white mt-0.5">{value}</div>
      {subValue && <div className="text-xs text-gray-500 mt-0.5">{subValue}</div>}
    </div>
  </div>
);

// ─── Severity Badge ──────────────────────────────────────────────────────────

const severityClasses: Record<string, string> = {
  info: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  error: 'bg-red-500/20 text-red-400 border-red-500/30',
  critical: 'bg-red-600/30 text-red-300 border-red-500/40',
};

// ─── Main Component ──────────────────────────────────────────────────────────

export default function DeviceDetailView() {
  const { setView, selectedSwitchId, switches } = useAppStore();

  // Find selected switch or use mock
  const switchData = switches.find((s) => s.id === selectedSwitchId);

  // Local state
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [switchName, setSwitchName] = useState(switchData?.name ?? 'GC-16 Main Rack');
  const [selectedPorts, setSelectedPorts] = useState<number[]>([]);
  const [colorMode, setColorMode] = useState<'group' | 'status' | 'poe' | 'speed'>('group');

  // Mock data (stable across renders)
  const model = switchData?.model ?? 'GC-16';
  const [ports, setPorts] = useState<(PortInfo & PortInfoExtended)[]>(() => generateMockPorts(model));
  const [groups, setGroups] = useState<GroupConfig[]>(() => [...SOLOTECH_GROUPS]);
  const [poeSummary, setPoeSummary] = useState<PoeSummary>(() => generateMockPoeSummary(ports));
  const [trunkPorts, setTrunkPorts] = useState<TrunkPort[]>(() => generateMockTrunks(ports));
  const [logs] = useState<MockLogEntry[]>(() => generateMockLogs());
  const [igmpData] = useState<IgmpGroupEntry[]>(() => generateMockIgmp());

  // Device info
  const ip = switchData?.ip ?? '192.168.1.100';
  const mac = switchData?.mac ?? '00:50:C2:AB:12:34';
  const firmware = switchData?.firmware ?? '2.8.1';
  const serial = switchData?.serial ?? 'LUM-GC16-2024-00142';
  const uptime = '14d 7h 23m';
  const temperature = '48';
  const fanStatus = 'Normal (3200 RPM)';
  const health = switchData?.healthStatus ?? 'healthy';

  // ─── Port Selection ──────────────────────────────────────────────────────

  const handlePortSelect = useCallback((port: number, multiSelect: boolean) => {
    setSelectedPorts((prev) => {
      if (multiSelect) {
        return prev.includes(port) ? prev.filter((p) => p !== port) : [...prev, port];
      }
      return prev.includes(port) && prev.length === 1 ? [] : [port];
    });
  }, []);

  // ─── Group Handlers ──────────────────────────────────────────────────────

  const handleGroupUpdate = useCallback((id: number, updates: Partial<GroupConfig>) => {
    setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, ...updates } : g)));
  }, []);

  const handleGroupCreate = useCallback((config: Omit<GroupConfig, 'id'>) => {
    setGroups((prev) => [...prev, { ...config, id: Math.max(...prev.map((g) => g.id)) + 1 }]);
  }, []);

  const handleGroupDelete = useCallback((id: number) => {
    setGroups((prev) => prev.filter((g) => g.id !== id));
  }, []);

  // ─── PoE Handlers ────────────────────────────────────────────────────────

  const handleTogglePoe = useCallback((port: number, enabled: boolean) => {
    setPoeSummary((prev) => ({
      ...prev,
      ports: prev.ports.map((p) =>
        p.port === port ? { ...p, enabled, status: enabled ? 'searching' : 'disabled' } : p
      ),
    }));
  }, []);

  const handleSetPriority = useCallback((port: number, priority: 'low' | 'high' | 'critical') => {
    setPoeSummary((prev) => ({
      ...prev,
      ports: prev.ports.map((p) => (p.port === port ? { ...p, priority } : p)),
    }));
  }, []);

  // ─── Port Handlers ───────────────────────────────────────────────────────

  const handlePortUpdate = useCallback((port: number, updates: Partial<PortInfoExtended>) => {
    setPorts((prev) => prev.map((p) => (p.port === port ? { ...p, ...updates } : p)));
  }, []);

  const handlePortToggle = useCallback((port: number, enabled: boolean) => {
    setPorts((prev) =>
      prev.map((p) => (p.port === port ? { ...p, adminStatus: enabled ? 'up' : 'down' } : p))
    );
  }, []);

  // ─── Trunk Handlers ──────────────────────────────────────────────────────

  const handleAddGroupToTrunk = useCallback((port: number, groupId: number, tagged: boolean) => {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;
    setTrunkPorts((prev) =>
      prev.map((t) =>
        t.port === port
          ? { ...t, allowedGroups: [...t.allowedGroups, { id: group.id, name: group.name, color: group.color, tagged }] }
          : t
      )
    );
  }, [groups]);

  const handleRemoveGroupFromTrunk = useCallback((port: number, groupId: number) => {
    setTrunkPorts((prev) =>
      prev.map((t) =>
        t.port === port ? { ...t, allowedGroups: t.allowedGroups.filter((g) => g.id !== groupId) } : t
      )
    );
  }, []);

  const handleToggleTrunk = useCallback((port: number, _enabled: boolean) => {
    setTrunkPorts((prev) => prev.filter((t) => t.port !== port));
  }, []);

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 max-w-full">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setView(VIEWS.SCANNER)}
          className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={18} />
        </button>

        <EditableName name={switchName} onSave={setSwitchName} />

        <span className="px-2.5 py-1 rounded-md bg-gc-blue/20 text-gc-blue text-xs font-semibold border border-gc-blue/30">
          {model}
        </span>

        <HealthIndicator status={health as 'healthy' | 'warning' | 'critical' | 'offline'} size="md" showLabel pulse />

        <div className="flex-1" />

        <div className="flex items-center gap-4 text-sm text-gray-400">
          <span className="flex items-center gap-1.5">
            <Network size={14} />
            {ip}
          </span>
          <span className="hidden lg:flex items-center gap-1.5">
            <Cpu size={14} />
            FW {firmware}
          </span>
          <span className="hidden lg:flex items-center gap-1.5">
            <Clock size={14} />
            {uptime}
          </span>
        </div>
      </div>

      {/* Port Diagram */}
      <PortDetailGrid
        ports={ports}
        model={model}
        selectedPorts={selectedPorts}
        onPortSelect={handlePortSelect}
        colorMode={colorMode}
        onColorModeChange={(m) => setColorMode(m as typeof colorMode)}
      />

      {/* Selected port side info */}
      {selectedPorts.length === 1 && (() => {
        const sp = ports.find((p) => p.port === selectedPorts[0]);
        if (!sp) return null;
        return (
          <div className="bg-gc-panel rounded-lg border border-gray-700 p-4 flex items-center gap-6">
            <div className="text-sm font-medium text-white">Port {sp.port}: {sp.label}</div>
            <div className="text-xs text-gray-400">Status: <span className={sp.operStatus === 'up' ? 'text-green-400' : 'text-gray-500'}>{sp.operStatus}</span></div>
            <div className="text-xs text-gray-400">Speed: {sp.speed || 'N/A'}</div>
            <div className="text-xs text-gray-400">Group: {sp.groupName || 'None'}</div>
            {sp.connectedDevice && <div className="text-xs text-gray-400">Device: {sp.connectedDevice}</div>}
            {sp.poeEnabled && <div className="text-xs text-gray-400">PoE: {sp.poeWatts}W</div>}
          </div>
        );
      })()}

      {/* Tab Bar */}
      <div className="flex items-center gap-1 border-b border-gray-700">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px
              ${activeTab === tab.id
                ? 'border-gc-accent text-gc-accent'
                : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-600'}
            `}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {/* ─── Overview Tab ─────────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <InfoCard icon={<Monitor size={20} />} label="Model" value={model} subValue="Luminex GigaCore" />
              <InfoCard icon={<Network size={20} />} label="MAC Address" value={mac} />
              <InfoCard icon={<Shield size={20} />} label="Serial Number" value={serial} />
              <InfoCard icon={<Cpu size={20} />} label="Firmware" value={`v${firmware}`} subValue="Latest: v2.8.2" />
              <InfoCard icon={<Clock size={20} />} label="Uptime" value={uptime} subValue="Last reboot: Feb 28, 2026" />
              <InfoCard
                icon={<Thermometer size={20} />}
                label="Temperature"
                value={`${temperature}°C`}
                subValue={Number(temperature) > 60 ? 'Above normal' : 'Normal range'}
              />
              <InfoCard icon={<Fan size={20} />} label="Fan Status" value={fanStatus} />
              <InfoCard
                icon={<Zap size={20} />}
                label="PoE Draw"
                value={`${poeSummary.totalDrawWatts.toFixed(1)}W`}
                subValue={`Budget: ${poeSummary.totalBudgetWatts}W`}
              />
              <InfoCard
                icon={<Activity size={20} />}
                label="Ports Active"
                value={`${ports.filter((p) => p.operStatus === 'up').length} / ${ports.length}`}
                subValue={`${ports.filter((p) => p.type === 'copper' && p.operStatus === 'up').length} copper, ${ports.filter((p) => p.type !== 'copper' && p.operStatus === 'up').length} SFP`}
              />
            </div>
          </div>
        )}

        {/* ─── Groups Tab ───────────────────────────────────────────────── */}
        {activeTab === 'groups' && (
          <GroupEditor
            groups={groups}
            onGroupUpdate={handleGroupUpdate}
            onGroupCreate={handleGroupCreate}
            onGroupDelete={handleGroupDelete}
          />
        )}

        {/* ─── PoE Tab ──────────────────────────────────────────────────── */}
        {activeTab === 'poe' && (
          <PoEPanel
            poeSummary={poeSummary}
            onTogglePoe={handleTogglePoe}
            onSetPriority={handleSetPriority}
          />
        )}

        {/* ─── Ports Tab ────────────────────────────────────────────────── */}
        {activeTab === 'ports' && (
          <PortTable
            ports={ports}
            onPortUpdate={handlePortUpdate}
            onPortToggle={handlePortToggle}
            onPortSelect={(p) => handlePortSelect(p, false)}
            selectedPorts={selectedPorts}
          />
        )}

        {/* ─── Trunks Tab ───────────────────────────────────────────────── */}
        {activeTab === 'trunks' && (
          <TrunkConfig
            trunkPorts={trunkPorts}
            availableGroups={groups.map((g) => ({ id: g.id, name: g.name, color: g.color }))}
            onAddGroupToTrunk={handleAddGroupToTrunk}
            onRemoveGroupFromTrunk={handleRemoveGroupFromTrunk}
            onToggleTrunk={handleToggleTrunk}
          />
        )}

        {/* ─── IGMP Tab ─────────────────────────────────────────────────── */}
        {activeTab === 'igmp' && (
          <div className="space-y-4">
            {/* IGMP snooping status per group */}
            <div className="bg-gc-panel rounded-lg border border-gray-700 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-700 flex items-center gap-2">
                <Radio size={16} className="text-gc-accent" />
                <h3 className="text-sm font-medium text-white">IGMP Snooping Status by Group</h3>
              </div>
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-800/60 border-b border-gray-700">
                    <th className="px-4 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wider">Group</th>
                    <th className="px-4 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wider">VLAN</th>
                    <th className="px-4 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wider">Snooping</th>
                    <th className="px-4 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wider">Querier</th>
                    <th className="px-4 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wider">Querier IP</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.filter((g) => g.igmpSnooping).map((g) => (
                    <tr key={g.id} className="border-t border-gray-700/50 hover:bg-gray-800/30">
                      <td className="px-4 py-2.5 text-sm">
                        <span className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: g.color }} />
                          <span className="text-white">{g.name}</span>
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-sm text-gray-300">{g.vlanId}</td>
                      <td className="px-4 py-2.5">
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">Active</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium border ${g.igmpQuerier ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}>
                          {g.igmpQuerier ? 'Enabled' : 'Disabled'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-sm text-gray-400 font-mono">
                        {g.igmpQuerier ? `192.168.${g.vlanId}.1` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Multicast group table */}
            <div className="bg-gc-panel rounded-lg border border-gray-700 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-700">
                <h3 className="text-sm font-medium text-white">Active Multicast Groups</h3>
              </div>
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-800/60 border-b border-gray-700">
                    <th className="px-4 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wider">Multicast Address</th>
                    <th className="px-4 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wider">VLAN</th>
                    <th className="px-4 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wider">Group Name</th>
                    <th className="px-4 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wider">Subscriber Ports</th>
                    <th className="px-4 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wider">Version</th>
                    <th className="px-4 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wider">Last Report</th>
                  </tr>
                </thead>
                <tbody>
                  {igmpData.map((entry, idx) => (
                    <tr key={idx} className="border-t border-gray-700/50 hover:bg-gray-800/30">
                      <td className="px-4 py-2.5 text-sm text-white font-mono">{entry.multicastGroup}</td>
                      <td className="px-4 py-2.5 text-sm text-gray-300">{entry.vlan}</td>
                      <td className="px-4 py-2.5 text-sm text-gray-300">{entry.groupName}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {entry.subscriberPorts.map((p) => (
                            <span key={p} className="px-1.5 py-0.5 rounded bg-gray-700 text-xs text-gray-300 font-mono">{p}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-sm text-gray-400">{entry.version}</td>
                      <td className="px-4 py-2.5 text-sm text-gray-400">{entry.lastReport}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─── Logs Tab ─────────────────────────────────────────────────── */}
        {activeTab === 'logs' && (
          <div className="bg-gc-panel rounded-lg border border-gray-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
              <h3 className="text-sm font-medium text-white">Event Log — {switchName}</h3>
              <span className="text-xs text-gray-500">{logs.length} events</span>
            </div>
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-800/60 border-b border-gray-700">
                  <th className="px-4 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wider w-44">Timestamp</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wider w-20">Severity</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wider w-24">Category</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wider">Message</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-t border-gray-700/50 hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-2.5 text-xs text-gray-400 font-mono">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium border ${severityClasses[log.severity]}`}>
                        {log.severity}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-300 capitalize">{log.category}</td>
                    <td className="px-4 py-2.5 text-sm text-gray-300">{log.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
