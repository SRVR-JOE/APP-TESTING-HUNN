import React, { useState, useMemo, useCallback } from 'react';
import {
  Plus,
  Search,
  Filter,
  Download,
  ChevronDown,
  ChevronRight,
  Trash2,
  Edit3,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Network,
  Radio,
} from 'lucide-react';
import VLANMembershipMatrix from '../components/VLANMembershipMatrix';
import CreateVLANModal, { DiscoveredSwitch, NewVLANConfig } from '../components/CreateVLANModal';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface VLANEntry {
  id: number;
  name: string;
  color: string;
  protocolType: string;
  switches: Array<{
    name: string;
    ip: string;
    portCount: number;
    memberPorts: number[];
  }>;
  subnet: string;
  igmpQuerier: string | null;
}

type SortField = 'id' | 'name' | 'protocolType' | 'switches' | 'ports' | 'subnet' | 'querier';
type SortDir = 'asc' | 'desc';

/* ------------------------------------------------------------------ */
/*  Protocol type mapping                                              */
/* ------------------------------------------------------------------ */

const PROTOCOL_MAP: Record<number, string> = {
  1: 'Mgmt',
  10: 'D3 Net',
  20: 'D3 Ctrl',
  30: 'NDI',
  40: 'Art-Net',
  50: 'Intercom',
  100: 'Control',
  1300: 'Dante Pri',
  1301: 'Dante Sec',
};

const PROTOCOL_BADGE_COLORS: Record<string, string> = {
  Mgmt: 'bg-gray-600 text-gray-200',
  'D3 Net': 'bg-red-900/60 text-red-300',
  'D3 Ctrl': 'bg-amber-900/60 text-amber-300',
  NDI: 'bg-green-900/60 text-green-300',
  'Art-Net': 'bg-purple-900/60 text-purple-300',
  Intercom: 'bg-pink-900/60 text-pink-300',
  Control: 'bg-blue-900/60 text-blue-300',
  'Dante Pri': 'bg-teal-900/60 text-teal-300',
  'Dante Sec': 'bg-cyan-900/60 text-cyan-300',
};

const VLAN_COLORS: Record<number, string> = {
  1: '#6b7280',
  10: '#ef4444',
  20: '#f59e0b',
  30: '#22c55e',
  40: '#a855f7',
  50: '#ec4899',
  100: '#3b82f6',
  1300: '#14b8a6',
  1301: '#06b6d4',
};

/* ------------------------------------------------------------------ */
/*  Mock switch data                                                   */
/* ------------------------------------------------------------------ */

const MOCK_SWITCHES: DiscoveredSwitch[] = [
  { name: 'GC-Core-01', ip: '10.0.1.1', model: 'GigaCore 30i', portCount: 30 },
  { name: 'GC-Core-02', ip: '10.0.1.2', model: 'GigaCore 30i', portCount: 30 },
  { name: 'GC-Stage-L', ip: '10.0.1.10', model: 'GigaCore 16Xt', portCount: 16 },
  { name: 'GC-Stage-R', ip: '10.0.1.11', model: 'GigaCore 16Xt', portCount: 16 },
  { name: 'GC-FOH', ip: '10.0.1.20', model: 'GigaCore 14R', portCount: 14 },
  { name: 'GC-Broadcast', ip: '10.0.1.30', model: 'GigaCore 16RFO', portCount: 16 },
];

/* ------------------------------------------------------------------ */
/*  Mock VLAN data (Solotech standard)                                 */
/* ------------------------------------------------------------------ */

function buildMockVlans(): VLANEntry[] {
  const sw = MOCK_SWITCHES;
  return [
    {
      id: 1, name: 'Management', color: VLAN_COLORS[1], protocolType: PROTOCOL_MAP[1],
      switches: sw.map((s) => ({ name: s.name, ip: s.ip, portCount: s.portCount, memberPorts: [1] })),
      subnet: '10.0.1.0/24', igmpQuerier: null,
    },
    {
      id: 10, name: 'D3 Net', color: VLAN_COLORS[10], protocolType: PROTOCOL_MAP[10],
      switches: sw.slice(0, 4).map((s) => ({ name: s.name, ip: s.ip, portCount: s.portCount, memberPorts: [2, 3, 4, 5, 6] })),
      subnet: '10.10.0.0/24', igmpQuerier: null,
    },
    {
      id: 20, name: 'D3 Control', color: VLAN_COLORS[20], protocolType: PROTOCOL_MAP[20],
      switches: sw.slice(0, 4).map((s) => ({ name: s.name, ip: s.ip, portCount: s.portCount, memberPorts: [7, 8] })),
      subnet: '10.20.0.0/24', igmpQuerier: null,
    },
    {
      id: 30, name: 'NDI', color: VLAN_COLORS[30], protocolType: PROTOCOL_MAP[30],
      switches: [
        { name: sw[0].name, ip: sw[0].ip, portCount: sw[0].portCount, memberPorts: [9, 10, 11, 12, 13, 14, 15, 16] },
        { name: sw[1].name, ip: sw[1].ip, portCount: sw[1].portCount, memberPorts: [9, 10, 11, 12] },
        { name: sw[4].name, ip: sw[4].ip, portCount: sw[4].portCount, memberPorts: [5, 6, 7, 8] },
        { name: sw[5].name, ip: sw[5].ip, portCount: sw[5].portCount, memberPorts: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
      ],
      subnet: '10.30.0.0/24', igmpQuerier: 'GC-Core-01',
    },
    {
      id: 40, name: 'Art-Net', color: VLAN_COLORS[40], protocolType: PROTOCOL_MAP[40],
      switches: [
        { name: sw[2].name, ip: sw[2].ip, portCount: sw[2].portCount, memberPorts: [9, 10, 11, 12] },
        { name: sw[3].name, ip: sw[3].ip, portCount: sw[3].portCount, memberPorts: [9, 10, 11, 12] },
        { name: sw[4].name, ip: sw[4].ip, portCount: sw[4].portCount, memberPorts: [9, 10] },
      ],
      subnet: '10.40.0.0/24', igmpQuerier: null,
    },
    {
      id: 50, name: 'Intercom', color: VLAN_COLORS[50], protocolType: PROTOCOL_MAP[50],
      switches: sw.map((s) => ({ name: s.name, ip: s.ip, portCount: s.portCount, memberPorts: [s.portCount - 1, s.portCount] })),
      subnet: '10.50.0.0/24', igmpQuerier: null,
    },
    {
      id: 100, name: 'Control', color: VLAN_COLORS[100], protocolType: PROTOCOL_MAP[100],
      switches: [
        { name: sw[0].name, ip: sw[0].ip, portCount: sw[0].portCount, memberPorts: [17, 18, 19, 20] },
        { name: sw[4].name, ip: sw[4].ip, portCount: sw[4].portCount, memberPorts: [11, 12, 13, 14] },
      ],
      subnet: '10.100.0.0/24', igmpQuerier: null,
    },
    {
      id: 1300, name: 'Dante Primary', color: VLAN_COLORS[1300], protocolType: PROTOCOL_MAP[1300],
      switches: [
        { name: sw[0].name, ip: sw[0].ip, portCount: sw[0].portCount, memberPorts: [21, 22, 23, 24, 25, 26] },
        { name: sw[1].name, ip: sw[1].ip, portCount: sw[1].portCount, memberPorts: [21, 22, 23, 24, 25, 26] },
        { name: sw[2].name, ip: sw[2].ip, portCount: sw[2].portCount, memberPorts: [13, 14, 15, 16] },
        { name: sw[3].name, ip: sw[3].ip, portCount: sw[3].portCount, memberPorts: [13, 14, 15, 16] },
        { name: sw[4].name, ip: sw[4].ip, portCount: sw[4].portCount, memberPorts: [1, 2, 3, 4] },
      ],
      subnet: '10.130.0.0/24', igmpQuerier: 'GC-Core-01',
    },
    {
      id: 1301, name: 'Dante Secondary', color: VLAN_COLORS[1301], protocolType: PROTOCOL_MAP[1301],
      switches: [
        { name: sw[0].name, ip: sw[0].ip, portCount: sw[0].portCount, memberPorts: [27, 28, 29, 30] },
        { name: sw[1].name, ip: sw[1].ip, portCount: sw[1].portCount, memberPorts: [27, 28, 29, 30] },
        { name: sw[2].name, ip: sw[2].ip, portCount: sw[2].portCount, memberPorts: [13, 14, 15, 16] },
        { name: sw[3].name, ip: sw[3].ip, portCount: sw[3].portCount, memberPorts: [13, 14, 15, 16] },
      ],
      subnet: '10.131.0.0/24', igmpQuerier: 'GC-Core-02',
    },
  ];
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function VLANConfigView() {
  const [vlans, setVlans] = useState<VLANEntry[]>(buildMockVlans);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterProtocol, setFilterProtocol] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('id');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [reassignTarget, setReassignTarget] = useState<number>(1);

  /* Sorting */
  const handleSort = useCallback((field: SortField) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortDir('asc');
      return field;
    });
  }, []);

  const sortIcon = useCallback(
    (field: SortField) => {
      if (sortField !== field) return <ArrowUpDown size={12} className="text-gray-600" />;
      return sortDir === 'asc' ? (
        <ArrowUp size={12} className="text-gc-accent" />
      ) : (
        <ArrowDown size={12} className="text-gc-accent" />
      );
    },
    [sortField, sortDir],
  );

  /* Filtered + sorted VLANs */
  const filteredVlans = useMemo(() => {
    let result = vlans;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (v) =>
          v.name.toLowerCase().includes(q) ||
          v.id.toString().includes(q) ||
          v.protocolType.toLowerCase().includes(q),
      );
    }
    if (filterProtocol !== 'all') {
      result = result.filter((v) => v.protocolType === filterProtocol);
    }

    const comparators: Record<SortField, (a: VLANEntry, b: VLANEntry) => number> = {
      id: (a, b) => a.id - b.id,
      name: (a, b) => a.name.localeCompare(b.name),
      protocolType: (a, b) => a.protocolType.localeCompare(b.protocolType),
      switches: (a, b) => a.switches.length - b.switches.length,
      ports: (a, b) =>
        a.switches.reduce((s, sw) => s + sw.memberPorts.length, 0) -
        b.switches.reduce((s, sw) => s + sw.memberPorts.length, 0),
      subnet: (a, b) => a.subnet.localeCompare(b.subnet),
      querier: (a, b) => (a.igmpQuerier ?? '').localeCompare(b.igmpQuerier ?? ''),
    };

    result = [...result].sort((a, b) => {
      const cmp = comparators[sortField](a, b);
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [vlans, searchTerm, filterProtocol, sortField, sortDir]);

  const uniqueProtocols = useMemo(
    () => Array.from(new Set(vlans.map((v) => v.protocolType))).sort(),
    [vlans],
  );

  /* Port toggle */
  const handleTogglePort = useCallback(
    (vlanId: number, switchIp: string, port: number, isMember: boolean) => {
      setVlans((prev) =>
        prev.map((v) => {
          if (v.id !== vlanId) return v;
          return {
            ...v,
            switches: v.switches.map((sw) => {
              if (sw.ip !== switchIp) return sw;
              const ports = isMember
                ? [...sw.memberPorts, port].sort((a, b) => a - b)
                : sw.memberPorts.filter((p) => p !== port);
              return { ...sw, memberPorts: [...new Set(ports)] };
            }),
          };
        }),
      );
    },
    [],
  );

  /* Create VLAN */
  const handleCreateVlan = useCallback((config: NewVLANConfig) => {
    const protocol = PROTOCOL_MAP[config.vlanId] ?? 'Custom';
    const newVlan: VLANEntry = {
      id: config.vlanId,
      name: config.name,
      color: config.color,
      protocolType: protocol,
      switches: config.targetSwitches.map((ip) => {
        const sw = MOCK_SWITCHES.find((s) => s.ip === ip);
        return {
          name: sw?.name ?? ip,
          ip,
          portCount: sw?.portCount ?? 24,
          memberPorts: config.portAssignments[ip] ?? [],
        };
      }),
      subnet: `10.${config.vlanId}.0.0/24`,
      igmpQuerier: config.igmpQuerier ? MOCK_SWITCHES.find((s) => config.targetSwitches.includes(s.ip))?.name ?? null : null,
    };
    setVlans((prev) => [...prev, newVlan]);
  }, []);

  /* Delete VLAN */
  const handleDeleteVlan = useCallback(
    (vlanId: number) => {
      // In production, would reassign ports to reassignTarget first
      setVlans((prev) => prev.filter((v) => v.id !== vlanId));
      setDeleteConfirm(null);
    },
    [reassignTarget],
  );

  /* Export CSV */
  const handleExportCSV = useCallback(() => {
    const header = 'VLAN ID,Name,Protocol,Switches,Total Ports,Subnet,IGMP Querier\n';
    const rows = vlans
      .map(
        (v) =>
          `${v.id},"${v.name}",${v.protocolType},${v.switches.length},${v.switches.reduce(
            (s, sw) => s + sw.memberPorts.length,
            0,
          )},"${v.subnet}","${v.igmpQuerier ?? 'None'}"`,
      )
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vlan-config.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [vlans]);

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="flex flex-col h-full bg-gc-darker text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-500/20 flex items-center justify-center">
            <Network size={20} className="text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">VLAN Configuration</h1>
            <p className="text-xs text-gray-500">
              {vlans.length} VLANs across {MOCK_SWITCHES.length} switches
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="Search VLANs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gc-accent/50 w-48"
            />
          </div>

          {/* Filter */}
          <div className="relative flex items-center">
            <Filter size={14} className="absolute left-3 text-gray-500 pointer-events-none" />
            <select
              value={filterProtocol}
              onChange={(e) => setFilterProtocol(e.target.value)}
              className="pl-9 pr-8 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-gc-accent/50 appearance-none cursor-pointer"
            >
              <option value="all">All Protocols</option>
              {uniqueProtocols.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {/* Export */}
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-300 border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <Download size={14} />
            Export CSV
          </button>

          {/* Create */}
          <button
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-white bg-gc-accent rounded-lg hover:bg-gc-accent/90 transition-colors"
          >
            <Plus size={16} />
            Create VLAN
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-800/60">
                {/* Expand arrow */}
                <th className="w-10 px-3 py-3" />
                {([
                  ['id', 'VLAN ID'],
                  ['name', 'Name'],
                  ['protocolType', 'Protocol'],
                  ['switches', 'Switches'],
                  ['ports', 'Total Ports'],
                  ['subnet', 'Subnet'],
                  ['querier', 'IGMP Querier'],
                ] as [SortField, string][]).map(([field, label]) => (
                  <th
                    key={field}
                    className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-200 select-none"
                    onClick={() => handleSort(field)}
                  >
                    <span className="flex items-center gap-1">
                      {label}
                      {sortIcon(field)}
                    </span>
                  </th>
                ))}
                {/* Actions */}
                <th className="w-24 px-3 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {filteredVlans.map((vlan) => {
                const isExpanded = expandedId === vlan.id;
                const totalPorts = vlan.switches.reduce((s, sw) => s + sw.memberPorts.length, 0);
                const protoBadge =
                  PROTOCOL_BADGE_COLORS[vlan.protocolType] ?? 'bg-gray-700 text-gray-300';

                return (
                  <React.Fragment key={vlan.id}>
                    {/* Summary row */}
                    <tr
                      className={`hover:bg-gray-800/30 transition-colors cursor-pointer ${
                        isExpanded ? 'bg-gray-800/40' : ''
                      }`}
                      onClick={() => setExpandedId(isExpanded ? null : vlan.id)}
                    >
                      <td className="px-3 py-3 text-gray-500">
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: vlan.color }}
                          />
                          <span className="font-mono font-medium text-white">{vlan.id}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-gray-300">{vlan.name}</td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${protoBadge}`}
                        >
                          {vlan.protocolType}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-gray-300">{vlan.switches.length}</span>
                          <div className="flex -space-x-1">
                            {vlan.switches.slice(0, 3).map((sw) => (
                              <span
                                key={sw.ip}
                                className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-700 text-[9px] text-gray-300 border border-gray-600"
                                title={sw.name}
                              >
                                {sw.name.split('-').pop()?.charAt(0).toUpperCase()}
                              </span>
                            ))}
                            {vlan.switches.length > 3 && (
                              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-600 text-[9px] text-gray-300 border border-gray-500">
                                +{vlan.switches.length - 3}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-gray-300 font-mono">{totalPorts}</td>
                      <td className="px-3 py-3 text-gray-400 font-mono text-xs">{vlan.subnet}</td>
                      <td className="px-3 py-3">
                        {vlan.igmpQuerier ? (
                          <div className="flex items-center gap-1.5">
                            <Radio size={12} className="text-green-400" />
                            <span className="text-xs text-green-400">{vlan.igmpQuerier}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-600">--</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            className="p-1 rounded text-gray-500 hover:text-gray-300 hover:bg-gray-700 transition-colors"
                            title="Edit VLAN"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            className="p-1 rounded text-gray-500 hover:text-red-400 hover:bg-red-900/20 transition-colors"
                            title="Delete VLAN"
                            onClick={() => setDeleteConfirm(vlan.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded membership matrix */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={9} className="px-4 py-4 bg-gray-900/30">
                          <div className="mb-2 text-xs text-gray-400 font-medium">
                            VLAN {vlan.id} Membership Matrix &mdash; Click cells to toggle port membership
                          </div>
                          <VLANMembershipMatrix
                            vlanId={vlan.id}
                            switches={vlan.switches}
                            onTogglePort={(switchIp, port, isMember) =>
                              handleTogglePort(vlan.id, switchIp, port, isMember)
                            }
                          />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}

              {filteredVlans.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center">
                    <Network size={32} className="mx-auto mb-3 text-gray-600" />
                    <p className="text-gray-400">No VLANs found</p>
                    <p className="text-xs text-gray-600 mt-1">
                      Try adjusting your search or filter criteria
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      {deleteConfirm !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)} />
          <div className="relative bg-gc-dark border border-gray-700 rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold text-white mb-2">Delete VLAN {deleteConfirm}?</h3>
            <p className="text-sm text-gray-400 mb-4">
              Move ports to another VLAN before deleting? This cannot be undone.
            </p>
            <div className="mb-4">
              <label className="block text-xs text-gray-400 mb-1">Reassign ports to:</label>
              <select
                value={reassignTarget}
                onChange={(e) => setReassignTarget(Number(e.target.value))}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-gc-accent/50"
              >
                {vlans
                  .filter((v) => v.id !== deleteConfirm)
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      VLAN {v.id} &mdash; {v.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-sm text-gray-300 border border-gray-600 rounded-lg hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteVlan(deleteConfirm)}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete &amp; Reassign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create VLAN Modal */}
      <CreateVLANModal
        existingVlans={vlans.map((v) => v.id)}
        switches={MOCK_SWITCHES}
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreate={handleCreateVlan}
      />
    </div>
  );
}
