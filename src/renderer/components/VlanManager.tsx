import React, { useState, useMemo } from 'react';
import {
  Network,
  Plus,
  Trash2,
  Send,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Check,
  Grid3X3,
  List,
  Search,
} from 'lucide-react';
import { VlanModal, VlanFormData } from './VlanModal';
import { ConfirmDialog } from './ConfirmDialog';

// ─── Types ──────────────────────────────────────────────────────────────────

interface MockPort {
  port: number;
  label: string;
  vlanIds: number[];
}

interface MockSwitchVlan {
  switchId: string;
  switchName: string;
  model: string;
  ip: string;
  ports: MockPort[];
  igmpQuerier: boolean;
  igmpSnooping: boolean;
}

interface VlanEntry {
  vlanId: number;
  name: string;
  color: string;
  protocol: string;
  switches: MockSwitchVlan[];
  totalPorts: number;
  querierSwitch: string | null;
  inconsistent: boolean;
}

// ─── Protocol Detection ─────────────────────────────────────────────────────

const PROTOCOL_MAP: Record<number, string> = {
  1: 'Management',
  10: 'D3',
  30: 'NDI',
  40: 'Art-Net',
  50: 'AES67',
  100: 'sACN',
  1300: 'Dante Pri',
  1301: 'Dante Sec',
};

function detectProtocol(vlanId: number): string {
  return PROTOCOL_MAP[vlanId] ?? 'Custom';
}

// ─── Mock Data ──────────────────────────────────────────────────────────────

const MOCK_SWITCHES = [
  { id: 'sw-1', name: 'GC-FOH-Main', model: 'GigaCore 30i', ip: '10.0.1.1', portCount: 30 },
  { id: 'sw-2', name: 'GC-Stage-L', model: 'GigaCore 16Xt', ip: '10.0.1.2', portCount: 16 },
  { id: 'sw-3', name: 'GC-Stage-R', model: 'GigaCore 16Xt', ip: '10.0.1.3', portCount: 16 },
  { id: 'sw-4', name: 'GC-Broadcast', model: 'GigaCore 14R', ip: '10.0.1.4', portCount: 14 },
];

function generatePorts(switchId: string, portCount: number, vlanIds: number[]): MockPort[] {
  return Array.from({ length: portCount }, (_, i) => ({
    port: i + 1,
    label: `Port ${i + 1}`,
    vlanIds: i < portCount * 0.7 ? vlanIds : [1],
  }));
}

const MOCK_VLANS: VlanEntry[] = [
  {
    vlanId: 1,
    name: 'Management',
    color: '#6B7280',
    protocol: 'Management',
    switches: MOCK_SWITCHES.map((sw) => ({
      switchId: sw.id,
      switchName: sw.name,
      model: sw.model,
      ip: sw.ip,
      ports: generatePorts(sw.id, sw.portCount, [1]),
      igmpQuerier: false,
      igmpSnooping: false,
    })),
    totalPorts: 76,
    querierSwitch: null,
    inconsistent: false,
  },
  {
    vlanId: 10,
    name: 'D3 Network',
    color: '#3B82F6',
    protocol: 'D3',
    switches: MOCK_SWITCHES.map((sw) => ({
      switchId: sw.id,
      switchName: sw.name,
      model: sw.model,
      ip: sw.ip,
      ports: generatePorts(sw.id, sw.portCount, [10]),
      igmpQuerier: sw.id === 'sw-1',
      igmpSnooping: true,
    })),
    totalPorts: 52,
    querierSwitch: 'GC-FOH-Main',
    inconsistent: false,
  },
  {
    vlanId: 30,
    name: 'NDI',
    color: '#22C55E',
    protocol: 'NDI',
    switches: [
      {
        switchId: 'sw-1',
        switchName: 'GC-FOH-Main',
        model: 'GigaCore 30i',
        ip: '10.0.1.1',
        ports: generatePorts('sw-1', 30, [30]),
        igmpQuerier: true,
        igmpSnooping: true,
      },
      {
        switchId: 'sw-4',
        switchName: 'GC-Broadcast',
        model: 'GigaCore 14R',
        ip: '10.0.1.4',
        ports: generatePorts('sw-4', 14, [30]),
        igmpQuerier: false,
        igmpSnooping: true,
      },
    ],
    totalPorts: 30,
    querierSwitch: 'GC-FOH-Main',
    inconsistent: true, // Not on all ISL-connected switches
  },
  {
    vlanId: 40,
    name: 'Art-Net',
    color: '#F97316',
    protocol: 'Art-Net',
    switches: MOCK_SWITCHES.slice(0, 3).map((sw) => ({
      switchId: sw.id,
      switchName: sw.name,
      model: sw.model,
      ip: sw.ip,
      ports: generatePorts(sw.id, sw.portCount, [40]),
      igmpQuerier: false,
      igmpSnooping: false,
    })),
    totalPorts: 44,
    querierSwitch: null,
    inconsistent: true,
  },
  {
    vlanId: 1300,
    name: 'Dante Primary',
    color: '#EF4444',
    protocol: 'Dante Pri',
    switches: MOCK_SWITCHES.map((sw) => ({
      switchId: sw.id,
      switchName: sw.name,
      model: sw.model,
      ip: sw.ip,
      ports: generatePorts(sw.id, sw.portCount, [1300]),
      igmpQuerier: sw.id === 'sw-1',
      igmpSnooping: true,
    })),
    totalPorts: 60,
    querierSwitch: 'GC-FOH-Main',
    inconsistent: false,
  },
  {
    vlanId: 1301,
    name: 'Dante Secondary',
    color: '#A855F7',
    protocol: 'Dante Sec',
    switches: MOCK_SWITCHES.map((sw) => ({
      switchId: sw.id,
      switchName: sw.name,
      model: sw.model,
      ip: sw.ip,
      ports: generatePorts(sw.id, sw.portCount, [1301]),
      igmpQuerier: sw.id === 'sw-1',
      igmpSnooping: true,
    })),
    totalPorts: 60,
    querierSwitch: 'GC-FOH-Main',
    inconsistent: false,
  },
];

// ─── Component ──────────────────────────────────────────────────────────────

export const VlanManager: React.FC = () => {
  const [vlans, setVlans] = useState<VlanEntry[]>(MOCK_VLANS);
  const [expandedVlan, setExpandedVlan] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'matrix'>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<VlanEntry | null>(null);
  const [bulkSelectVlan, setBulkSelectVlan] = useState<number | null>(null);
  const [bulkSwitchIds, setBulkSwitchIds] = useState<string[]>([]);

  const filteredVlans = useMemo(() => {
    if (!searchQuery.trim()) return vlans;
    const q = searchQuery.toLowerCase();
    return vlans.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        v.vlanId.toString().includes(q) ||
        v.protocol.toLowerCase().includes(q)
    );
  }, [vlans, searchQuery]);

  const toggleExpand = (vlanId: number) => {
    setExpandedVlan((prev) => (prev === vlanId ? null : vlanId));
  };

  const handleCreateVlan = (data: VlanFormData) => {
    const newVlan: VlanEntry = {
      vlanId: data.vlanId,
      name: data.name,
      color: data.color,
      protocol: detectProtocol(data.vlanId),
      switches: data.targetSwitchIds.map((sid) => {
        const sw = MOCK_SWITCHES.find((s) => s.id === sid)!;
        return {
          switchId: sw.id,
          switchName: sw.name,
          model: sw.model,
          ip: sw.ip,
          ports: generatePorts(sw.id, sw.portCount, [data.vlanId]),
          igmpQuerier: data.igmpQuerier && sid === data.targetSwitchIds[0],
          igmpSnooping: data.igmpSnooping,
        };
      }),
      totalPorts: 0,
      querierSwitch: data.igmpQuerier
        ? MOCK_SWITCHES.find((s) => s.id === data.targetSwitchIds[0])?.name ?? null
        : null,
      inconsistent: data.targetSwitchIds.length < MOCK_SWITCHES.length,
    };
    newVlan.totalPorts = newVlan.switches.reduce((sum, sw) => sum + sw.ports.length, 0);
    setVlans((prev) => [...prev, newVlan].sort((a, b) => a.vlanId - b.vlanId));
    setShowCreateModal(false);
  };

  const handleDeleteVlan = () => {
    if (!deleteTarget) return;
    setVlans((prev) => prev.filter((v) => v.vlanId !== deleteTarget.vlanId));
    setDeleteTarget(null);
  };

  const handleBulkApply = () => {
    if (bulkSelectVlan === null || bulkSwitchIds.length === 0) return;
    setVlans((prev) =>
      prev.map((v) => {
        if (v.vlanId !== bulkSelectVlan) return v;
        const existingSwitchIds = v.switches.map((s) => s.switchId);
        const newSwitches = bulkSwitchIds
          .filter((sid) => !existingSwitchIds.includes(sid))
          .map((sid) => {
            const sw = MOCK_SWITCHES.find((s) => s.id === sid)!;
            return {
              switchId: sw.id,
              switchName: sw.name,
              model: sw.model,
              ip: sw.ip,
              ports: generatePorts(sw.id, sw.portCount, [v.vlanId]),
              igmpQuerier: false,
              igmpSnooping: v.switches[0]?.igmpSnooping ?? false,
            };
          });
        const updatedSwitches = [...v.switches, ...newSwitches];
        return {
          ...v,
          switches: updatedSwitches,
          totalPorts: updatedSwitches.reduce((sum, sw) => sum + sw.ports.length, 0),
          inconsistent: updatedSwitches.length < MOCK_SWITCHES.length,
        };
      })
    );
    setBulkSelectVlan(null);
    setBulkSwitchIds([]);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-500/10 rounded-lg flex items-center justify-center">
            <Network className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-white font-semibold text-lg">VLAN Manager</h2>
            <p className="text-gray-400 text-xs">
              {vlans.length} VLANs across {MOCK_SWITCHES.length} switches
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center bg-gray-700 rounded-md p-0.5">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded transition-colors ${
                viewMode === 'table'
                  ? 'bg-gray-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
              title="Table view"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('matrix')}
              className={`p-1.5 rounded transition-colors ${
                viewMode === 'matrix'
                  ? 'bg-gray-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
              title="Matrix view"
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create VLAN
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search VLANs by name, ID, or protocol..."
          className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-md text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Consistency warnings */}
      {vlans.some((v) => v.inconsistent) && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-md p-3 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-yellow-300 text-sm font-medium">VLAN Consistency Warning</p>
            <p className="text-yellow-400/70 text-xs mt-1">
              {vlans.filter((v) => v.inconsistent).length} VLAN(s) are not configured on all
              ISL-connected switches. This may cause traffic isolation issues.
            </p>
          </div>
        </div>
      )}

      {viewMode === 'table' ? (
        /* ─── Table View ─────────────────────────────────────────────────── */
        <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-750 border-b border-gray-700">
                <th className="text-left px-4 py-3 text-gray-400 font-medium w-8" />
                <th className="text-left px-4 py-3 text-gray-400 font-medium">VLAN ID</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Name</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Color</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">Protocol</th>
                <th className="text-center px-4 py-3 text-gray-400 font-medium">Switches</th>
                <th className="text-center px-4 py-3 text-gray-400 font-medium">Ports</th>
                <th className="text-left px-4 py-3 text-gray-400 font-medium">IGMP Querier</th>
                <th className="text-right px-4 py-3 text-gray-400 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredVlans.map((vlan) => (
                <React.Fragment key={vlan.vlanId}>
                  {/* Main row */}
                  <tr
                    className={`border-b border-gray-700/50 hover:bg-gray-700/30 cursor-pointer transition-colors ${
                      vlan.inconsistent ? 'bg-yellow-500/5' : ''
                    }`}
                    onClick={() => toggleExpand(vlan.vlanId)}
                  >
                    <td className="px-4 py-3">
                      {expandedVlan === vlan.vlanId ? (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-white font-mono">{vlan.vlanId}</span>
                      {vlan.inconsistent && (
                        <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 inline ml-2" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-white">{vlan.name}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-4 h-4 rounded-sm"
                          style={{ backgroundColor: vlan.color }}
                        />
                        <span className="text-gray-400 text-xs">{vlan.color}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-gray-700 text-gray-300 text-xs rounded-full">
                        {vlan.protocol}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-white">{vlan.switches.length}</span>
                      <span className="text-gray-500">/{MOCK_SWITCHES.length}</span>
                    </td>
                    <td className="px-4 py-3 text-center text-white">{vlan.totalPorts}</td>
                    <td className="px-4 py-3 text-gray-300 text-sm">
                      {vlan.querierSwitch ?? (
                        <span className="text-gray-600">None</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setBulkSelectVlan(vlan.vlanId);
                          }}
                          className="p-1.5 text-gray-400 hover:text-blue-400 rounded transition-colors"
                          title="Bulk apply to switches"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                        {vlan.vlanId !== 1 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget(vlan);
                            }}
                            className="p-1.5 text-gray-400 hover:text-red-400 rounded transition-colors"
                            title="Delete VLAN"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Expanded row — per-switch breakdown */}
                  {expandedVlan === vlan.vlanId && (
                    <tr>
                      <td colSpan={9} className="bg-gray-850 px-4 py-3">
                        <div className="ml-8 space-y-2">
                          <p className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-2">
                            Per-Switch Breakdown
                          </p>
                          <div className="grid gap-2">
                            {vlan.switches.map((sw) => (
                              <div
                                key={sw.switchId}
                                className="flex items-center justify-between bg-gray-800 border border-gray-700 rounded-md px-4 py-2"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-2 h-2 bg-green-400 rounded-full" />
                                  <span className="text-white text-sm">{sw.switchName}</span>
                                  <span className="text-gray-500 text-xs">{sw.model}</span>
                                  <span className="text-gray-600 text-xs">{sw.ip}</span>
                                </div>
                                <div className="flex items-center gap-4 text-xs">
                                  <span className="text-gray-400">
                                    {sw.ports.filter((p) => p.vlanIds.includes(vlan.vlanId)).length} ports
                                  </span>
                                  <span
                                    className={
                                      sw.igmpSnooping ? 'text-green-400' : 'text-gray-600'
                                    }
                                  >
                                    Snooping: {sw.igmpSnooping ? 'ON' : 'OFF'}
                                  </span>
                                  <span
                                    className={
                                      sw.igmpQuerier ? 'text-blue-400' : 'text-gray-600'
                                    }
                                  >
                                    Querier: {sw.igmpQuerier ? 'YES' : 'NO'}
                                  </span>
                                </div>
                              </div>
                            ))}
                            {/* Show missing switches */}
                            {MOCK_SWITCHES.filter(
                              (ms) => !vlan.switches.some((vs) => vs.switchId === ms.id)
                            ).map((ms) => (
                              <div
                                key={ms.id}
                                className="flex items-center justify-between bg-gray-800/50 border border-yellow-500/20 rounded-md px-4 py-2"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-2 h-2 bg-yellow-400 rounded-full" />
                                  <span className="text-yellow-300/80 text-sm">{ms.name}</span>
                                  <span className="text-gray-500 text-xs">{ms.model}</span>
                                  <span className="text-xs text-yellow-500/60">
                                    VLAN not configured
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>

          {filteredVlans.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <Network className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No VLANs found</p>
            </div>
          )}
        </div>
      ) : (
        /* ─── Matrix View ────────────────────────────────────────────────── */
        <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="sticky left-0 bg-gray-800 text-left px-3 py-2 text-gray-400 font-medium z-10">
                  VLAN
                </th>
                {MOCK_SWITCHES.map((sw) => (
                  <th
                    key={sw.id}
                    className="text-center px-2 py-2 text-gray-400 font-medium min-w-[100px]"
                  >
                    <div className="text-white text-xs">{sw.name}</div>
                    <div className="text-gray-500 text-[10px]">{sw.model}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredVlans.map((vlan) => (
                <tr key={vlan.vlanId} className="border-b border-gray-700/50 hover:bg-gray-700/20">
                  <td className="sticky left-0 bg-gray-800 px-3 py-2 z-10">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-sm flex-shrink-0"
                        style={{ backgroundColor: vlan.color }}
                      />
                      <div>
                        <span className="text-white font-mono">{vlan.vlanId}</span>
                        <span className="text-gray-500 ml-2">{vlan.name}</span>
                      </div>
                    </div>
                  </td>
                  {MOCK_SWITCHES.map((sw) => {
                    const swVlan = vlan.switches.find((s) => s.switchId === sw.id);
                    const portCount = swVlan
                      ? swVlan.ports.filter((p) => p.vlanIds.includes(vlan.vlanId)).length
                      : 0;
                    return (
                      <td key={sw.id} className="text-center px-2 py-2">
                        {swVlan ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <Check className="w-4 h-4 text-green-400" />
                            <span className="text-gray-400">{portCount}p</span>
                          </div>
                        ) : (
                          <span className="text-gray-600">--</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Bulk Apply Panel */}
      {bulkSelectVlan !== null && (
        <div className="bg-gray-800 border border-blue-500/30 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white text-sm font-medium">
              Bulk Apply VLAN {bulkSelectVlan} to Switches
            </h3>
            <button
              onClick={() => {
                setBulkSelectVlan(null);
                setBulkSwitchIds([]);
              }}
              className="text-gray-400 hover:text-white text-xs transition-colors"
            >
              Cancel
            </button>
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            {MOCK_SWITCHES.map((sw) => {
              const alreadyHas = vlans
                .find((v) => v.vlanId === bulkSelectVlan)
                ?.switches.some((s) => s.switchId === sw.id);
              return (
                <label
                  key={sw.id}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer transition-colors ${
                    alreadyHas
                      ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                      : bulkSwitchIds.includes(sw.id)
                      ? 'bg-blue-500/10 border border-blue-500/30 text-blue-400'
                      : 'bg-gray-700 border border-gray-600 text-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={alreadyHas || bulkSwitchIds.includes(sw.id)}
                    disabled={alreadyHas}
                    onChange={() => {
                      if (alreadyHas) return;
                      setBulkSwitchIds((prev) =>
                        prev.includes(sw.id)
                          ? prev.filter((id) => id !== sw.id)
                          : [...prev, sw.id]
                      );
                    }}
                    className="w-3.5 h-3.5 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-0"
                  />
                  <span className="text-xs">{sw.name}</span>
                  {alreadyHas && <Check className="w-3 h-3 text-green-400" />}
                </label>
              );
            })}
          </div>
          <button
            onClick={handleBulkApply}
            disabled={bulkSwitchIds.length === 0}
            className="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:text-gray-400 text-white rounded-md transition-colors"
          >
            Apply to {bulkSwitchIds.length} switch(es)
          </button>
        </div>
      )}

      {/* Create VLAN Modal */}
      <VlanModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSave={handleCreateVlan}
        existingVlanIds={vlans.map((v) => v.vlanId)}
        switches={MOCK_SWITCHES.map((s) => ({
          id: s.id,
          name: s.name,
          model: s.model,
        }))}
        mode="create"
      />

      {/* Delete Confirmation */}
      {deleteTarget && (
        <ConfirmDialog
          title="Delete VLAN"
          message={`Are you sure you want to delete VLAN ${deleteTarget.vlanId} (${deleteTarget.name})? This will remove it from ${deleteTarget.switches.length} switch(es) and ${deleteTarget.totalPorts} ports will be reassigned to the default VLAN.`}
          confirmLabel="Delete VLAN"
          confirmVariant="danger"
          onConfirm={handleDeleteVlan}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
};

export default VlanManager;
