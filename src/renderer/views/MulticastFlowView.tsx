import React, { useState, useMemo, useCallback } from 'react';
import {
  Radio,
  Filter,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  X,
  Activity,
  AlertTriangle,
  Wifi,
  ArrowRight,
  BarChart3,
  Grid3X3,
  Search,
} from 'lucide-react';
import type { MulticastFlow, MulticastReceiver, AVProtocol } from '@shared/types';
import { PROTOCOL_VLAN_PRESETS } from '@shared/constants';
import MulticastFlowCard from '../components/MulticastFlowCard';

/* ------------------------------------------------------------------ */
/*  Switch name lookup                                                 */
/* ------------------------------------------------------------------ */

const SWITCH_NAMES: Record<string, string> = {
  'sw-core-01': 'GC-Core-01',
  'sw-core-02': 'GC-Core-02',
  'sw-foh': 'GC-FOH',
  'sw-stage-l': 'GC-Stage-L',
  'sw-stage-r': 'GC-Stage-R',
  'sw-mon': 'GC-Monitor',
  'sw-broadcast': 'GC-Broadcast',
  'sw-truss-1': 'GC-Truss-1',
  'sw-truss-2': 'GC-Truss-2',
  'sw-floor': 'GC-Floor',
};

/* ------------------------------------------------------------------ */
/*  Mock data: 18 multicast flows                                      */
/* ------------------------------------------------------------------ */

const MOCK_FLOWS: MulticastFlow[] = [
  // Dante Primary flows
  {
    id: 'flow-dante-1',
    groupAddress: '239.69.0.1',
    sourceIP: '10.10.0.10',
    sourceSwitchId: 'sw-foh',
    sourcePort: 1,
    protocol: 'dante-primary',
    vlanId: 10,
    bandwidthMbps: 12.8,
    label: 'Console L/R Main',
    receivers: [
      { switchId: 'sw-stage-l', port: 3, deviceName: 'L-Amp-1' },
      { switchId: 'sw-stage-r', port: 3, deviceName: 'R-Amp-1' },
      { switchId: 'sw-stage-l', port: 4, deviceName: 'L-Amp-2' },
      { switchId: 'sw-stage-r', port: 4, deviceName: 'R-Amp-2' },
    ],
  },
  {
    id: 'flow-dante-2',
    groupAddress: '239.69.0.2',
    sourceIP: '10.10.0.11',
    sourceSwitchId: 'sw-foh',
    sourcePort: 2,
    protocol: 'dante-primary',
    vlanId: 10,
    bandwidthMbps: 6.4,
    label: 'Console Aux 1-8',
    receivers: [
      { switchId: 'sw-mon', port: 1, deviceName: 'Mon Wedge L' },
      { switchId: 'sw-mon', port: 2, deviceName: 'Mon Wedge R' },
      { switchId: 'sw-mon', port: 3, deviceName: 'IEM Rack' },
    ],
  },
  {
    id: 'flow-dante-3',
    groupAddress: '239.69.0.3',
    sourceIP: '10.10.0.20',
    sourceSwitchId: 'sw-stage-l',
    sourcePort: 1,
    protocol: 'dante-primary',
    vlanId: 10,
    bandwidthMbps: 4.2,
    label: 'Stage Box SL',
    receivers: [
      { switchId: 'sw-foh', port: 5, deviceName: 'FOH Console' },
      { switchId: 'sw-mon', port: 5, deviceName: 'Mon Console' },
    ],
  },
  {
    id: 'flow-dante-4',
    groupAddress: '239.69.0.4',
    sourceIP: '10.10.0.21',
    sourceSwitchId: 'sw-stage-r',
    sourcePort: 1,
    protocol: 'dante-primary',
    vlanId: 10,
    bandwidthMbps: 4.2,
    label: 'Stage Box SR',
    receivers: [
      { switchId: 'sw-foh', port: 6, deviceName: 'FOH Console' },
      { switchId: 'sw-mon', port: 6, deviceName: 'Mon Console' },
    ],
  },
  // Dante Secondary
  {
    id: 'flow-dante-sec-1',
    groupAddress: '239.69.1.1',
    sourceIP: '10.11.0.10',
    sourceSwitchId: 'sw-foh',
    sourcePort: 3,
    protocol: 'dante-secondary',
    vlanId: 11,
    bandwidthMbps: 12.8,
    label: 'Console L/R (Sec)',
    receivers: [
      { switchId: 'sw-stage-l', port: 5, deviceName: 'L-Amp-1' },
      { switchId: 'sw-stage-r', port: 5, deviceName: 'R-Amp-1' },
    ],
  },
  // sACN flows
  {
    id: 'flow-sacn-1',
    groupAddress: '239.255.0.1',
    sourceIP: '10.20.0.50',
    sourceSwitchId: 'sw-foh',
    sourcePort: 8,
    protocol: 'sacn',
    vlanId: 20,
    bandwidthMbps: 0.8,
    label: 'sACN Univ 1-10',
    receivers: [
      { switchId: 'sw-truss-1', port: 1, deviceName: 'Truss Dimmer 1' },
      { switchId: 'sw-truss-1', port: 2, deviceName: 'Truss Movers 1' },
      { switchId: 'sw-truss-2', port: 1, deviceName: 'Truss Dimmer 2' },
      { switchId: 'sw-truss-2', port: 2, deviceName: 'Truss Movers 2' },
      { switchId: 'sw-stage-l', port: 7, deviceName: 'SL Dimmer Rack' },
      { switchId: 'sw-stage-r', port: 7, deviceName: 'SR Dimmer Rack' },
    ],
  },
  {
    id: 'flow-sacn-2',
    groupAddress: '239.255.0.11',
    sourceIP: '10.20.0.50',
    sourceSwitchId: 'sw-foh',
    sourcePort: 8,
    protocol: 'sacn',
    vlanId: 20,
    bandwidthMbps: 0.4,
    label: 'sACN Univ 11-20',
    receivers: [
      { switchId: 'sw-floor', port: 1, deviceName: 'Floor LED Strips' },
      { switchId: 'sw-floor', port: 2, deviceName: 'Floor Movers' },
    ],
  },
  {
    id: 'flow-sacn-3',
    groupAddress: '239.255.0.21',
    sourceIP: '10.20.0.51',
    sourceSwitchId: 'sw-foh',
    sourcePort: 9,
    protocol: 'sacn',
    vlanId: 20,
    bandwidthMbps: 0.2,
    label: 'sACN Univ 21-30 Backup',
    receivers: [
      { switchId: 'sw-truss-1', port: 3, deviceName: 'Truss Backup Node' },
    ],
  },
  // Art-Net flows
  {
    id: 'flow-artnet-1',
    groupAddress: '239.255.1.1',
    sourceIP: '10.21.0.100',
    sourceSwitchId: 'sw-foh',
    sourcePort: 10,
    protocol: 'artnet',
    vlanId: 21,
    bandwidthMbps: 1.5,
    label: 'Art-Net Media Servers',
    receivers: [
      { switchId: 'sw-stage-l', port: 8, deviceName: 'Media Server 1' },
      { switchId: 'sw-stage-r', port: 8, deviceName: 'Media Server 2' },
      { switchId: 'sw-truss-1', port: 4, deviceName: 'LED Wall Proc' },
    ],
  },
  {
    id: 'flow-artnet-2',
    groupAddress: '239.255.1.2',
    sourceIP: '10.21.0.101',
    sourceSwitchId: 'sw-stage-l',
    sourcePort: 9,
    protocol: 'artnet',
    vlanId: 21,
    bandwidthMbps: 0.6,
    label: 'Art-Net Pixel Mapper',
    receivers: [
      { switchId: 'sw-truss-2', port: 3, deviceName: 'Pixel Bar Array' },
    ],
  },
  // NDI flows
  {
    id: 'flow-ndi-1',
    groupAddress: '239.255.10.1',
    sourceIP: '10.30.0.10',
    sourceSwitchId: 'sw-broadcast',
    sourcePort: 1,
    protocol: 'ndi',
    vlanId: 30,
    bandwidthMbps: 85.0,
    label: 'NDI Camera 1 (4K)',
    receivers: [
      { switchId: 'sw-foh', port: 12, deviceName: 'vMix Workstation' },
      { switchId: 'sw-broadcast', port: 5, deviceName: 'Replay Server' },
    ],
  },
  {
    id: 'flow-ndi-2',
    groupAddress: '239.255.10.2',
    sourceIP: '10.30.0.11',
    sourceSwitchId: 'sw-broadcast',
    sourcePort: 2,
    protocol: 'ndi',
    vlanId: 30,
    bandwidthMbps: 45.0,
    label: 'NDI Camera 2 (1080p)',
    receivers: [
      { switchId: 'sw-foh', port: 12, deviceName: 'vMix Workstation' },
    ],
  },
  {
    id: 'flow-ndi-3',
    groupAddress: '239.255.10.3',
    sourceIP: '10.30.0.12',
    sourceSwitchId: 'sw-broadcast',
    sourcePort: 3,
    protocol: 'ndi',
    vlanId: 30,
    bandwidthMbps: 45.0,
    label: 'NDI Camera 3 (1080p)',
    receivers: [
      { switchId: 'sw-foh', port: 12, deviceName: 'vMix Workstation' },
      { switchId: 'sw-broadcast', port: 5, deviceName: 'Replay Server' },
    ],
  },
  {
    id: 'flow-ndi-4',
    groupAddress: '239.255.10.10',
    sourceIP: '10.30.0.50',
    sourceSwitchId: 'sw-foh',
    sourcePort: 13,
    protocol: 'ndi',
    vlanId: 30,
    bandwidthMbps: 25.0,
    label: 'NDI PGM Out',
    receivers: [
      { switchId: 'sw-broadcast', port: 6, deviceName: 'Stream Encoder' },
      { switchId: 'sw-stage-l', port: 10, deviceName: 'Stage Monitor' },
    ],
  },
  // AES67
  {
    id: 'flow-aes67-1',
    groupAddress: '239.69.5.1',
    sourceIP: '10.12.0.10',
    sourceSwitchId: 'sw-broadcast',
    sourcePort: 8,
    protocol: 'aes67',
    vlanId: 12,
    bandwidthMbps: 3.2,
    label: 'AES67 Broadcast Feed',
    receivers: [
      { switchId: 'sw-foh', port: 14, deviceName: 'Broadcast Console' },
    ],
  },
  // MA-Net
  {
    id: 'flow-manet-1',
    groupAddress: '239.192.0.1',
    sourceIP: '10.22.0.10',
    sourceSwitchId: 'sw-foh',
    sourcePort: 15,
    protocol: 'ma-net',
    vlanId: 22,
    bandwidthMbps: 2.0,
    label: 'grandMA3 Session',
    receivers: [
      { switchId: 'sw-stage-l', port: 11, deviceName: 'MA3 NPU SL' },
      { switchId: 'sw-stage-r', port: 11, deviceName: 'MA3 NPU SR' },
      { switchId: 'sw-truss-1', port: 5, deviceName: 'MA3 onPC Backup' },
    ],
  },
  // Management
  {
    id: 'flow-mgmt-1',
    groupAddress: '239.0.0.1',
    sourceIP: '10.0.0.1',
    sourceSwitchId: 'sw-core-01',
    sourcePort: 1,
    protocol: 'management',
    vlanId: 1,
    bandwidthMbps: 0.1,
    label: 'IGMP Querier',
    receivers: [
      { switchId: 'sw-core-02', port: 1, deviceName: 'Core-02' },
      { switchId: 'sw-foh', port: 1, deviceName: 'FOH SW' },
    ],
  },
  // Comms
  {
    id: 'flow-comms-1',
    groupAddress: '239.100.0.1',
    sourceIP: '10.50.0.10',
    sourceSwitchId: 'sw-foh',
    sourcePort: 16,
    protocol: 'comms',
    vlanId: 50,
    bandwidthMbps: 1.2,
    label: 'Intercom Matrix',
    receivers: [
      { switchId: 'sw-stage-l', port: 12, deviceName: 'Beltpack SL' },
      { switchId: 'sw-stage-r', port: 12, deviceName: 'Beltpack SR' },
      { switchId: 'sw-mon', port: 8, deviceName: 'Beltpack Mon' },
      { switchId: 'sw-broadcast', port: 10, deviceName: 'Beltpack BC' },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  sACN Universe mock data                                            */
/* ------------------------------------------------------------------ */

interface SacnUniverse {
  universe: number;
  sourceSwitchId: string;
  sourcePort: number;
  destSwitchIds: string[];
  active: boolean;
}

const SACN_UNIVERSES: SacnUniverse[] = Array.from({ length: 30 }, (_, i) => ({
  universe: i + 1,
  sourceSwitchId: 'sw-foh',
  sourcePort: i < 20 ? 8 : 9,
  destSwitchIds:
    i < 10
      ? ['sw-truss-1', 'sw-truss-2', 'sw-stage-l', 'sw-stage-r']
      : i < 20
        ? ['sw-floor']
        : ['sw-truss-1'],
  active: i < 25,
}));

/* ------------------------------------------------------------------ */
/*  Protocol helpers                                                   */
/* ------------------------------------------------------------------ */

const PROTOCOL_FILTER_LIST: AVProtocol[] = [
  'dante-primary',
  'dante-secondary',
  'aes67',
  'sacn',
  'artnet',
  'ndi',
  'ma-net',
  'comms',
  'management',
];

type SortField = 'protocol' | 'groupAddress' | 'bandwidth' | 'receivers' | 'vlan';
type SortDir = 'asc' | 'desc';

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function MulticastFlowView() {
  const [activeProtocols, setActiveProtocols] = useState<Set<AVProtocol>>(
    new Set(PROTOCOL_FILTER_LIST),
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('bandwidth');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'flows' | 'sacn'>('flows');

  /* ---- Filtering ---- */
  const toggleProtocol = useCallback((p: AVProtocol) => {
    setActiveProtocols((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }, []);

  const selectAllProtocols = useCallback(() => {
    setActiveProtocols(new Set(PROTOCOL_FILTER_LIST));
  }, []);

  const clearAllProtocols = useCallback(() => {
    setActiveProtocols(new Set());
  }, []);

  /* ---- Sorting ---- */
  const toggleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortField(field);
        setSortDir('desc');
      }
    },
    [sortField],
  );

  /* ---- Filtered/sorted flows ---- */
  const filteredFlows = useMemo(() => {
    let flows = MOCK_FLOWS.filter((f) => activeProtocols.has(f.protocol));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      flows = flows.filter(
        (f) =>
          f.groupAddress.includes(q) ||
          f.label?.toLowerCase().includes(q) ||
          f.protocol.includes(q) ||
          (SWITCH_NAMES[f.sourceSwitchId] ?? '').toLowerCase().includes(q),
      );
    }
    flows.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      switch (sortField) {
        case 'bandwidth':
          return (a.bandwidthMbps - b.bandwidthMbps) * dir;
        case 'receivers':
          return (a.receivers.length - b.receivers.length) * dir;
        case 'vlan':
          return (a.vlanId - b.vlanId) * dir;
        case 'groupAddress':
          return a.groupAddress.localeCompare(b.groupAddress) * dir;
        case 'protocol':
          return a.protocol.localeCompare(b.protocol) * dir;
        default:
          return 0;
      }
    });
    return flows;
  }, [activeProtocols, searchQuery, sortField, sortDir]);

  const selectedFlow = selectedFlowId
    ? MOCK_FLOWS.find((f) => f.id === selectedFlowId) ?? null
    : null;

  /* ---- Bandwidth summary ---- */
  const bandwidthByProtocol = useMemo(() => {
    const map: Record<string, { total: number; count: number; capacity: number }> = {};
    for (const f of MOCK_FLOWS) {
      if (!map[f.protocol]) {
        const capacity =
          f.protocol === 'ndi' || f.protocol === 'st2110' || f.protocol === 'video'
            ? 1000
            : f.protocol === 'dante-primary' || f.protocol === 'dante-secondary' || f.protocol === 'aes67'
              ? 100
              : 50;
        map[f.protocol] = { total: 0, count: 0, capacity };
      }
      map[f.protocol].total += f.bandwidthMbps;
      map[f.protocol].count += 1;
    }
    return map;
  }, []);

  /* ---- Render helpers ---- */
  const getPreset = (protocol: AVProtocol) =>
    PROTOCOL_VLAN_PRESETS.find((p) => p.protocol === protocol);

  const SortHeader: React.FC<{ field: SortField; label: string; className?: string }> = ({
    field,
    label,
    className,
  }) => (
    <button
      onClick={() => toggleSort(field)}
      className={`flex items-center gap-1 text-xs font-medium text-gray-400 hover:text-gray-200 transition ${className ?? ''}`}
    >
      {label}
      <ArrowUpDown
        className={`w-3 h-3 ${sortField === field ? 'text-gc-accent' : 'text-gray-600'}`}
      />
    </button>
  );

  return (
    <div className="flex flex-col h-full bg-gc-dark text-gray-100">
      {/* ---- Header ---- */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Radio className="w-5 h-5 text-gc-accent" />
            Multicast Flows
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {MOCK_FLOWS.length} flows &middot;{' '}
            {MOCK_FLOWS.reduce((s, f) => s + f.bandwidthMbps, 0).toFixed(1)} Mbps total
          </p>
        </div>

        {/* Tab toggle */}
        <div className="flex rounded-lg overflow-hidden border border-gray-700">
          <button
            onClick={() => setActiveTab('flows')}
            className={`px-4 py-1.5 text-xs font-medium transition ${
              activeTab === 'flows'
                ? 'bg-gc-accent text-white'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 inline mr-1" />
            Flow Table
          </button>
          <button
            onClick={() => setActiveTab('sacn')}
            className={`px-4 py-1.5 text-xs font-medium transition ${
              activeTab === 'sacn'
                ? 'bg-gc-accent text-white'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            <Grid3X3 className="w-3.5 h-3.5 inline mr-1" />
            sACN Universe Map
          </button>
        </div>
      </div>

      {/* ---- Protocol filter bar ---- */}
      <div className="px-6 py-3 border-b border-gray-700/60 flex items-center gap-3 flex-wrap">
        <Filter className="w-4 h-4 text-gray-500" />
        {PROTOCOL_FILTER_LIST.map((proto) => {
          const preset = getPreset(proto);
          const active = activeProtocols.has(proto);
          return (
            <button
              key={proto}
              onClick={() => toggleProtocol(proto)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                active
                  ? 'text-white border-transparent'
                  : 'text-gray-500 border-gray-700 bg-transparent hover:border-gray-500'
              }`}
              style={active ? { backgroundColor: preset?.color ?? '#6b7280' } : undefined}
            >
              {preset?.name ?? proto}
            </button>
          );
        })}
        <span className="ml-auto flex items-center gap-2 text-xs text-gray-500">
          <button onClick={selectAllProtocols} className="hover:text-gray-300 transition">
            All
          </button>
          <span>|</span>
          <button onClick={clearAllProtocols} className="hover:text-gray-300 transition">
            None
          </button>
        </span>
      </div>

      {activeTab === 'flows' ? (
        <div className="flex flex-1 overflow-hidden">
          {/* ---- Left: Flow table ---- */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Search + sort bar */}
            <div className="px-6 py-2 flex items-center gap-4 border-b border-gray-800">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search flows..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-800 border border-gray-700 rounded-md text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gc-accent"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                  >
                    <X className="w-3 h-3 text-gray-500 hover:text-gray-300" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <SortHeader field="protocol" label="Protocol" />
                <SortHeader field="groupAddress" label="Group" />
                <SortHeader field="bandwidth" label="Bandwidth" />
                <SortHeader field="receivers" label="Receivers" />
                <SortHeader field="vlan" label="VLAN" />
              </div>
              <span className="text-xs text-gray-500 ml-auto">
                {filteredFlows.length} flow{filteredFlows.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-y-auto px-6 py-3">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 border-b border-gray-800">
                    <th className="text-left py-2 font-medium">Protocol</th>
                    <th className="text-left py-2 font-medium">Label</th>
                    <th className="text-left py-2 font-medium font-mono">Group Address</th>
                    <th className="text-left py-2 font-medium">Source</th>
                    <th className="text-right py-2 font-medium">VLAN</th>
                    <th className="text-right py-2 font-medium">Bandwidth</th>
                    <th className="text-right py-2 font-medium">Receivers</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFlows.map((flow) => {
                    const preset = getPreset(flow.protocol);
                    const isSelected = selectedFlowId === flow.id;
                    return (
                      <tr
                        key={flow.id}
                        onClick={() => setSelectedFlowId(isSelected ? null : flow.id)}
                        className={`border-b border-gray-800/50 cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-gc-accent/10'
                            : 'hover:bg-gray-800/50'
                        }`}
                      >
                        <td className="py-2.5">
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold text-white"
                            style={{ backgroundColor: preset?.color ?? '#6b7280' }}
                          >
                            {preset?.name ?? flow.protocol}
                          </span>
                        </td>
                        <td className="py-2.5 text-gray-300">{flow.label ?? '-'}</td>
                        <td className="py-2.5 font-mono text-gray-200 text-xs">
                          {flow.groupAddress}
                        </td>
                        <td className="py-2.5 text-gray-400 text-xs">
                          {SWITCH_NAMES[flow.sourceSwitchId] ?? flow.sourceSwitchId}:
                          {flow.sourcePort}
                        </td>
                        <td className="py-2.5 text-right text-gray-400 font-mono text-xs">
                          {flow.vlanId}
                        </td>
                        <td className="py-2.5 text-right">
                          <span
                            className={`font-mono text-xs ${
                              flow.bandwidthMbps > 80
                                ? 'text-red-400'
                                : flow.bandwidthMbps > 40
                                  ? 'text-yellow-400'
                                  : 'text-gray-300'
                            }`}
                          >
                            {flow.bandwidthMbps.toFixed(1)}
                          </span>
                          <span className="text-gray-600 text-[10px] ml-0.5">Mbps</span>
                        </td>
                        <td className="py-2.5 text-right text-gray-300 text-xs">
                          {flow.receivers.length}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredFlows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-gray-500 text-sm">
                        No flows match current filters
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ---- Right sidebar: Detail + Bandwidth ---- */}
          <div className="w-80 border-l border-gray-700 flex flex-col overflow-y-auto">
            {/* Bandwidth Summary */}
            <div className="p-4 border-b border-gray-700">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5" />
                Bandwidth by Protocol
              </h3>
              <div className="space-y-3">
                {Object.entries(bandwidthByProtocol).map(([proto, data]) => {
                  const preset = getPreset(proto as AVProtocol);
                  const pct = Math.min((data.total / data.capacity) * 100, 100);
                  const isWarning = pct > 70;
                  const isCritical = pct > 90;
                  return (
                    <div key={proto}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: preset?.color ?? '#6b7280' }}
                          />
                          <span className="text-xs text-gray-300">{preset?.name ?? proto}</span>
                          <span className="text-[10px] text-gray-500">({data.count})</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {isCritical && (
                            <AlertTriangle className="w-3 h-3 text-red-400" />
                          )}
                          {isWarning && !isCritical && (
                            <AlertTriangle className="w-3 h-3 text-yellow-400" />
                          )}
                          <span className="text-xs font-mono text-gray-400">
                            {data.total.toFixed(1)}/{data.capacity}
                          </span>
                          <span className="text-[10px] text-gray-600">Mbps</span>
                        </div>
                      </div>
                      <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isCritical
                              ? 'bg-red-500'
                              : isWarning
                                ? 'bg-yellow-500'
                                : 'bg-green-500'
                          }`}
                          style={{
                            width: `${pct}%`,
                            backgroundColor: !isWarning ? preset?.color : undefined,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Flow Detail */}
            {selectedFlow ? (
              <div className="p-4 flex-1">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Flow Detail
                  </h3>
                  <button
                    onClick={() => setSelectedFlowId(null)}
                    className="text-gray-500 hover:text-gray-300"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <MulticastFlowCard
                  flow={selectedFlow}
                  switchNames={SWITCH_NAMES}
                  selected
                />

                {/* Source info */}
                <div className="mt-4 space-y-2">
                  <h4 className="text-xs text-gray-500 font-medium">Source</h4>
                  <div className="bg-gray-800 rounded-md p-2.5 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Switch</span>
                      <span className="text-gray-200">
                        {SWITCH_NAMES[selectedFlow.sourceSwitchId]}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Port</span>
                      <span className="text-gray-200">{selectedFlow.sourcePort}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">IP</span>
                      <span className="text-gray-200 font-mono">{selectedFlow.sourceIP}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Group</span>
                      <span className="text-gray-200 font-mono">
                        {selectedFlow.groupAddress}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Receivers */}
                <div className="mt-4 space-y-2">
                  <h4 className="text-xs text-gray-500 font-medium">
                    Receivers ({selectedFlow.receivers.length})
                  </h4>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {selectedFlow.receivers.map((r, i) => (
                      <div
                        key={i}
                        className="bg-gray-800 rounded-md px-2.5 py-2 text-xs flex items-center justify-between"
                      >
                        <div>
                          <div className="text-gray-200 font-medium">
                            {r.deviceName ?? 'Unknown Device'}
                          </div>
                          <div className="text-gray-500">
                            {SWITCH_NAMES[r.switchId] ?? r.switchId}:{r.port}
                          </div>
                        </div>
                        <Wifi className="w-3.5 h-3.5 text-gray-600" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bandwidth chart (simple bar) */}
                <div className="mt-4 space-y-2">
                  <h4 className="text-xs text-gray-500 font-medium">Bandwidth</h4>
                  <div className="bg-gray-800 rounded-md p-3">
                    <div className="text-2xl font-bold text-white font-mono">
                      {selectedFlow.bandwidthMbps.toFixed(1)}
                      <span className="text-sm text-gray-500 ml-1">Mbps</span>
                    </div>
                    <div className="mt-2 w-full h-3 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          selectedFlow.bandwidthMbps > 80
                            ? 'bg-red-500'
                            : selectedFlow.bandwidthMbps > 40
                              ? 'bg-yellow-500'
                              : 'bg-green-500'
                        }`}
                        style={{
                          width: `${Math.min((selectedFlow.bandwidthMbps / 100) * 100, 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center p-4">
                <div className="text-center text-gray-500">
                  <Radio className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Select a flow to view details</p>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ---- sACN Universe Map tab ---- */
        <div className="flex-1 overflow-y-auto p-6">
          <h2 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
            <Grid3X3 className="w-4 h-4 text-yellow-400" />
            sACN Universe Map
            <span className="text-xs text-gray-500 font-normal ml-2">
              {SACN_UNIVERSES.filter((u) => u.active).length} active /{' '}
              {SACN_UNIVERSES.length} total
            </span>
          </h2>
          <div className="grid grid-cols-10 gap-2">
            {SACN_UNIVERSES.map((u) => (
              <div
                key={u.universe}
                className={`rounded-lg border p-3 text-center transition-all ${
                  u.active
                    ? 'bg-yellow-500/10 border-yellow-500/30 hover:border-yellow-500/60'
                    : 'bg-gray-800/50 border-gray-700/50 opacity-50'
                }`}
              >
                <div
                  className={`text-lg font-bold font-mono ${
                    u.active ? 'text-yellow-400' : 'text-gray-600'
                  }`}
                >
                  {u.universe}
                </div>
                <div className="text-[10px] text-gray-500 mt-1">
                  {SWITCH_NAMES[u.sourceSwitchId]?.replace('GC-', '')}:P{u.sourcePort}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-0.5 justify-center">
                  {u.destSwitchIds.map((d) => (
                    <span
                      key={d}
                      className={`inline-block w-1.5 h-1.5 rounded-full ${
                        u.active ? 'bg-yellow-400' : 'bg-gray-600'
                      }`}
                      title={SWITCH_NAMES[d]}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="mt-6 flex items-center gap-6 text-xs text-gray-500">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border bg-yellow-500/10 border-yellow-500/30" />
              <span>Active Universe</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border bg-gray-800/50 border-gray-700/50 opacity-50" />
              <span>Inactive Universe</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
              <span>Destination Switch</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
