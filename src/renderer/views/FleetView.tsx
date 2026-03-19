import React, { useState, useMemo, useCallback } from 'react';
import {
  Package, Server, Shield, Cpu, ChevronDown, ChevronUp, Search, Filter,
  Plus, Trash2, Edit2, Play, CheckCircle, AlertTriangle, Clock, XCircle,
  RefreshCw, ArrowUpDown, Calendar, Wrench, BarChart3, Download, Upload,
} from 'lucide-react';
import { useFleetStore } from '../store/useFleetStore';
import { SWITCH_ROLE_TEMPLATES, PROTOCOL_VLAN_PRESETS } from '@shared/constants';
import type { FleetAsset, SwitchAssignmentRule, SwitchRole, SpareSwitchConfig } from '@shared/types';
import { FleetAssetCard } from '../components/FleetAssetCard';
import { RoleTemplateCard } from '../components/RoleTemplateCard';
import { SpareSwapModal } from '../components/SpareSwapModal';

// ---------------------------------------------------------------------------
// Tab type
// ---------------------------------------------------------------------------
type FleetTab = 'inventory' | 'spares' | 'roles' | 'firmware';

const TAB_CONFIG: { id: FleetTab; label: string; icon: React.ReactNode }[] = [
  { id: 'inventory', label: 'Inventory',      icon: <Package className="w-4 h-4" /> },
  { id: 'spares',    label: 'Spares',         icon: <RefreshCw className="w-4 h-4" /> },
  { id: 'roles',     label: 'Roles & Rules',  icon: <Shield className="w-4 h-4" /> },
  { id: 'firmware',  label: 'Firmware',        icon: <Cpu className="w-4 h-4" /> },
];

// ---------------------------------------------------------------------------
// Status helper
// ---------------------------------------------------------------------------
const STATUS_OPTIONS: FleetAsset['status'][] = ['available', 'deployed', 'maintenance', 'retired', 'rma'];
const statusColor: Record<FleetAsset['status'], string> = {
  available:   'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  deployed:    'bg-blue-500/20 text-blue-400 border-blue-500/30',
  maintenance: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  retired:     'bg-gray-500/20 text-gray-400 border-gray-500/30',
  rma:         'bg-red-500/20 text-red-400 border-red-500/30',
};

// ---------------------------------------------------------------------------
// Sort helpers
// ---------------------------------------------------------------------------
type SortField = 'serial' | 'model' | 'firmware' | 'status' | 'location' | 'warrantyExpiry';

function compareAssets(a: FleetAsset, b: FleetAsset, field: SortField, asc: boolean): number {
  let va: string = '', vb: string = '';
  switch (field) {
    case 'serial': va = a.serial; vb = b.serial; break;
    case 'model': va = a.model; vb = b.model; break;
    case 'firmware': va = a.firmware; vb = b.firmware; break;
    case 'status': va = a.status; vb = b.status; break;
    case 'location': va = a.location ?? ''; vb = b.location ?? ''; break;
    case 'warrantyExpiry': va = a.warrantyExpiry ?? ''; vb = b.warrantyExpiry ?? ''; break;
  }
  const cmp = va.localeCompare(vb);
  return asc ? cmp : -cmp;
}

// ---------------------------------------------------------------------------
// Main View
// ---------------------------------------------------------------------------
export const FleetView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<FleetTab>('inventory');

  return (
    <div className="flex flex-col h-full bg-gc-dark text-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Server className="w-5 h-5 text-gc-accent" />
            Fleet Management
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Asset tracking, spares, roles &amp; firmware</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-6 pt-3 border-b border-gray-700">
        {TAB_CONFIG.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors
              ${activeTab === tab.id
                ? 'border-gc-accent text-gc-accent bg-gc-panel'
                : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
              }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'inventory' && <InventoryTab />}
        {activeTab === 'spares' && <SparesTab />}
        {activeTab === 'roles' && <RolesTab />}
        {activeTab === 'firmware' && <FirmwareTab />}
      </div>
    </div>
  );
};

// ===========================================================================
// INVENTORY TAB
// ===========================================================================
const InventoryTab: React.FC = () => {
  const { assets } = useFleetStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<Set<FleetAsset['status']>>(new Set());
  const [sortField, setSortField] = useState<SortField>('serial');
  const [sortAsc, setSortAsc] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  const toggleStatus = (s: FleetAsset['status']) => {
    setStatusFilter((prev) => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });
  };

  const filtered = useMemo(() => {
    let list = assets;
    if (statusFilter.size > 0) {
      list = list.filter((a) => statusFilter.has(a.status));
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((a) =>
        a.serial.toLowerCase().includes(q) ||
        a.model.toLowerCase().includes(q) ||
        a.mac.toLowerCase().includes(q) ||
        (a.location ?? '').toLowerCase().includes(q) ||
        a.firmware.toLowerCase().includes(q),
      );
    }
    return [...list].sort((a, b) => compareAssets(a, b, sortField, sortAsc));
  }, [assets, search, statusFilter, sortField, sortAsc]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(true); }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map((a) => a.id)));
  };

  const SortIcon: React.FC<{ field: SortField }> = ({ field }) => (
    sortField === field
      ? (sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)
      : <ArrowUpDown className="w-3 h-3 opacity-30" />
  );

  function warrantyLabel(exp?: string) {
    if (!exp) return <span className="text-gray-600">--</span>;
    const diff = Math.ceil((new Date(exp).getTime() - Date.now()) / 86_400_000);
    if (diff < 0) return <span className="text-red-400 flex items-center gap-1"><XCircle className="w-3 h-3" />Expired</span>;
    if (diff < 90) return <span className="text-yellow-400 flex items-center gap-1"><Clock className="w-3 h-3" />{diff}d left</span>;
    return <span className="text-emerald-400 flex items-center gap-1"><CheckCircle className="w-3 h-3" />{exp}</span>;
  }

  return (
    <div className="p-6 space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search serial, model, MAC, location..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-gc-accent"
          />
        </div>

        {/* Status chips */}
        <div className="flex items-center gap-1.5">
          <Filter className="w-4 h-4 text-gray-500" />
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => toggleStatus(s)}
              className={`px-2.5 py-1 text-xs rounded-full border transition-colors capitalize
                ${statusFilter.has(s) ? statusColor[s] : 'border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-500'}`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* View toggle */}
        <div className="flex items-center border border-gray-700 rounded-lg overflow-hidden ml-auto">
          <button
            onClick={() => setViewMode('table')}
            className={`px-3 py-1.5 text-xs ${viewMode === 'table' ? 'bg-gc-accent text-white' : 'text-gray-400 hover:text-white'}`}
          >
            Table
          </button>
          <button
            onClick={() => setViewMode('cards')}
            className={`px-3 py-1.5 text-xs ${viewMode === 'cards' ? 'bg-gc-accent text-white' : 'text-gray-400 hover:text-white'}`}
          >
            Cards
          </button>
        </div>
      </div>

      {/* Bulk bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-gc-accent/10 border border-gc-accent/30">
          <span className="text-sm text-gc-accent font-medium">{selectedIds.size} selected</span>
          <button className="flex items-center gap-1 px-3 py-1 text-xs bg-gc-accent/20 hover:bg-gc-accent/30 text-gc-accent rounded-lg transition-colors">
            <Upload className="w-3 h-3" /> Schedule Firmware Update
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="ml-auto text-xs text-gray-400 hover:text-white">
            Clear selection
          </button>
        </div>
      )}

      {/* Card View */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((a) => (
            <FleetAssetCard key={a.id} asset={a} selected={selectedIds.has(a.id)} onSelect={toggleSelect} />
          ))}
        </div>
      )}

      {/* Table View */}
      {viewMode === 'table' && (
        <div className="overflow-x-auto rounded-lg border border-gray-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-800/60">
                <th className="px-3 py-2.5 text-left w-8">
                  <input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0} onChange={toggleAll} className="rounded border-gray-600 bg-gray-700 text-gc-accent focus:ring-gc-accent" />
                </th>
                {([
                  ['serial', 'Serial / Name'],
                  ['model', 'Model'],
                  ['firmware', 'Firmware'],
                  ['status', 'Status'],
                  ['location', 'Location'],
                  ['warrantyExpiry', 'Warranty'],
                ] as [SortField, string][]).map(([field, label]) => (
                  <th
                    key={field}
                    onClick={() => toggleSort(field)}
                    className="px-3 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white select-none"
                  >
                    <span className="flex items-center gap-1">
                      {label}
                      <SortIcon field={field} />
                    </span>
                  </th>
                ))}
                <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Tour
                </th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  MAC
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
              {filtered.map((a) => (
                <tr
                  key={a.id}
                  className={`transition-colors ${selectedIds.has(a.id) ? 'bg-gc-accent/5' : 'hover:bg-gray-800/40'}`}
                >
                  <td className="px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(a.id)}
                      onChange={() => toggleSelect(a.id)}
                      className="rounded border-gray-600 bg-gray-700 text-gc-accent focus:ring-gc-accent"
                    />
                  </td>
                  <td className="px-3 py-2.5 font-medium text-white whitespace-nowrap">{a.serial}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className="px-2 py-0.5 text-xs rounded bg-gray-700 text-gray-300 border border-gray-600">{a.model}</span>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap">{a.firmware}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-0.5 text-xs rounded-full border capitalize ${statusColor[a.status]}`}>
                      {a.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-gray-400 whitespace-nowrap">{a.location ?? '--'}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-xs">{warrantyLabel(a.warrantyExpiry)}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">{a.currentTourId ?? '--'}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-gray-500 whitespace-nowrap">{a.mac}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-gray-600">No assets match your filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-600">{filtered.length} of {assets.length} assets</p>
    </div>
  );
};

// ===========================================================================
// SPARES TAB
// ===========================================================================
const SparesTab: React.FC = () => {
  const { spares, registerSpare, returnSpare } = useFleetStore();
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [showRegisterForm, setShowRegisterForm] = useState(false);

  // Register form state
  const [formName, setFormName] = useState('');
  const [formMAC, setFormMAC] = useState('');
  const [formModel, setFormModel] = useState('GC-10');
  const [formRole, setFormRole] = useState<SwitchRole>('spare');

  const handleRegister = () => {
    if (!formName || !formMAC) return;
    registerSpare({
      id: `spare-${Date.now()}`,
      spareName: formName,
      spareMAC: formMAC,
      model: formModel,
      replacesRole: formRole,
      status: 'ready',
      lastVerified: new Date().toISOString().split('T')[0],
    });
    setFormName(''); setFormMAC(''); setShowRegisterForm(false);
  };

  const spareStatusColor: Record<SpareSwitchConfig['status'], string> = {
    ready:       'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    deployed:    'bg-blue-500/20 text-blue-400 border-blue-500/30',
    maintenance: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  };

  return (
    <div className="p-6 space-y-6">
      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setShowSwapModal(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-gc-accent hover:bg-gc-accent/80 text-white rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Hot-Swap
        </button>
        <button
          onClick={() => setShowRegisterForm(!showRegisterForm)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-gray-600 text-gray-300 hover:text-white hover:border-gray-400 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Register Spare
        </button>
      </div>

      {/* Register form */}
      {showRegisterForm && (
        <div className="rounded-lg border border-gray-700 bg-gc-panel p-4 space-y-3 max-w-lg">
          <h4 className="text-white font-medium text-sm">Register New Spare</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Spare Name</label>
              <input value={formName} onChange={(e) => setFormName(e.target.value)} className="w-full px-3 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-gc-accent" placeholder="SPARE-XX-01" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">MAC Address</label>
              <input value={formMAC} onChange={(e) => setFormMAC(e.target.value)} className="w-full px-3 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-gc-accent font-mono" placeholder="00:50:C2:00:XX:XX" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Model</label>
              <select value={formModel} onChange={(e) => setFormModel(e.target.value)} className="w-full px-3 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-gc-accent">
                {['GC-10', 'GC-14t', 'GC-16t', 'GC-26i', 'GC-30i'].map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Replaces Role</label>
              <select value={formRole} onChange={(e) => setFormRole(e.target.value as SwitchRole)} className="w-full px-3 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-gc-accent">
                {SWITCH_ROLE_TEMPLATES.map((t) => (
                  <option key={t.id} value={t.role}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button onClick={handleRegister} className="px-4 py-1.5 text-sm bg-gc-accent hover:bg-gc-accent/80 text-white rounded-lg transition-colors">Register</button>
            <button onClick={() => setShowRegisterForm(false)} className="px-4 py-1.5 text-sm text-gray-400 hover:text-white transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {/* Spares list */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {spares.map((sp) => {
          const roleT = SWITCH_ROLE_TEMPLATES.find((t) => t.role === sp.replacesRole);
          return (
            <div key={sp.id} className="rounded-lg border border-gray-700 bg-gc-panel p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-white font-semibold text-sm">{sp.spareName}</h4>
                <span className={`px-2 py-0.5 text-xs rounded-full border capitalize ${spareStatusColor[sp.status]}`}>
                  {sp.status}
                </span>
              </div>
              <div className="space-y-1.5 text-xs text-gray-400 mb-3">
                <div className="flex justify-between"><span>Model</span><span className="text-gray-300">{sp.model}</span></div>
                <div className="flex justify-between"><span>MAC</span><span className="text-gray-300 font-mono">{sp.spareMAC}</span></div>
                <div className="flex justify-between"><span>Role Template</span><span className="text-gray-300">{roleT?.name ?? sp.replacesRole}</span></div>
                <div className="flex justify-between"><span>Profile Loaded</span><span className="text-gray-300">{sp.preloadedProfileId ?? 'None'}</span></div>
                {sp.lastVerified && <div className="flex justify-between"><span>Last Verified</span><span className="text-gray-300">{sp.lastVerified}</span></div>}
              </div>
              <div className="flex items-center gap-2">
                {sp.status === 'ready' && (
                  <button
                    onClick={() => setShowSwapModal(true)}
                    className="flex items-center gap-1 px-3 py-1 text-xs bg-gc-accent/20 hover:bg-gc-accent/30 text-gc-accent rounded transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" /> Hot-Swap
                  </button>
                )}
                {sp.status === 'deployed' && (
                  <button
                    onClick={() => returnSpare(sp.id)}
                    className="flex items-center gap-1 px-3 py-1 text-xs bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 rounded transition-colors"
                  >
                    <Download className="w-3 h-3" /> Return
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {spares.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-600">No spare switches registered.</div>
        )}
      </div>

      <SpareSwapModal isOpen={showSwapModal} onClose={() => setShowSwapModal(false)} />
    </div>
  );
};

// ===========================================================================
// ROLES & RULES TAB
// ===========================================================================
const RolesTab: React.FC = () => {
  const { assignmentRules, addRule, updateRule, deleteRule, autoAssignRoles } = useFleetStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, SwitchRole> | null>(null);

  // Add form state
  const [newField, setNewField] = useState<SwitchAssignmentRule['matchField']>('name');
  const [newPattern, setNewPattern] = useState('');
  const [newRole, setNewRole] = useState<SwitchRole>('spare');
  const [newPriority, setNewPriority] = useState(assignmentRules.length + 1);

  const sortedRules = useMemo(() => [...assignmentRules].sort((a, b) => a.priority - b.priority), [assignmentRules]);

  const handleAdd = () => {
    if (!newPattern) return;
    addRule({
      id: `rule-${Date.now()}`,
      priority: newPriority,
      matchField: newField,
      matchPattern: newPattern,
      assignRole: newRole,
    });
    setNewPattern(''); setShowAddForm(false); setNewPriority(assignmentRules.length + 2);
  };

  const handleTestRules = () => {
    // Create mock discovered switches to test against
    const mockSwitches = [
      { id: 't1', name: 'FOH-CORE-01', mac: '00:50:C2:AA:01:01', ip: '10.0.0.1', model: 'GC-30i', serial: 'GC30I-TEST-001', firmware: '2.5.1', generation: 2 as const, lastSeen: '', firstSeen: '', isOnline: true, portCount: 30, portsUp: 28, healthStatus: 'healthy' as const },
      { id: 't2', name: 'FOH-DISTRO-01', mac: '00:50:C2:AA:01:02', ip: '10.0.0.2', model: 'GC-14t', serial: 'GC14T-TEST-001', firmware: '2.5.1', generation: 2 as const, lastSeen: '', firstSeen: '', isOnline: true, portCount: 14, portsUp: 10, healthStatus: 'healthy' as const },
      { id: 't3', name: 'SL-RACK-01', mac: '00:50:C2:AA:01:03', ip: '10.0.0.3', model: 'GC-16t', serial: 'GC16T-TEST-001', firmware: '2.4.0', generation: 2 as const, lastSeen: '', firstSeen: '', isOnline: true, portCount: 16, portsUp: 12, healthStatus: 'healthy' as const },
      { id: 't4', name: 'SR-RACK-01', mac: '00:50:C2:AA:01:04', ip: '10.0.0.4', model: 'GC-16t', serial: 'GC16T-TEST-002', firmware: '2.5.0', generation: 2 as const, lastSeen: '', firstSeen: '', isOnline: true, portCount: 16, portsUp: 8, healthStatus: 'healthy' as const },
      { id: 't5', name: 'TRUSS-A', mac: '00:50:C2:AA:01:05', ip: '10.0.0.5', model: 'GC-10', serial: 'GC10-TEST-001', firmware: '2.5.1', generation: 2 as const, lastSeen: '', firstSeen: '', isOnline: true, portCount: 10, portsUp: 8, healthStatus: 'healthy' as const },
    ];
    const results = autoAssignRoles(mockSwitches);
    setTestResults(results);
  };

  return (
    <div className="p-6 space-y-8">
      {/* Role Template Cards */}
      <div>
        <h3 className="text-white font-semibold text-base mb-4">Role Templates</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {SWITCH_ROLE_TEMPLATES.map((t) => (
            <RoleTemplateCard key={t.id} template={t} />
          ))}
        </div>
      </div>

      {/* Assignment Rules */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold text-base">Auto-Assignment Rules</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handleTestRules}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-600 text-gray-300 hover:text-white hover:border-gray-400 rounded-lg transition-colors"
            >
              <Play className="w-3 h-3" /> Test Rules
            </button>
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gc-accent hover:bg-gc-accent/80 text-white rounded-lg transition-colors"
            >
              <Plus className="w-3 h-3" /> Add Rule
            </button>
          </div>
        </div>

        {/* Add Rule Form */}
        {showAddForm && (
          <div className="rounded-lg border border-gray-700 bg-gc-panel p-4 mb-4 space-y-3 max-w-2xl">
            <h4 className="text-white font-medium text-sm">New Assignment Rule</h4>
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Priority</label>
                <input type="number" min={1} value={newPriority} onChange={(e) => setNewPriority(Number(e.target.value))} className="w-full px-3 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-gc-accent" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Match Field</label>
                <select value={newField} onChange={(e) => setNewField(e.target.value as SwitchAssignmentRule['matchField'])} className="w-full px-3 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-gc-accent">
                  {(['mac', 'serial', 'name', 'ip', 'model'] as const).map((f) => (
                    <option key={f} value={f}>{f.toUpperCase()}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Regex Pattern</label>
                <input value={newPattern} onChange={(e) => setNewPattern(e.target.value)} className="w-full px-3 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded text-white font-mono focus:outline-none focus:border-gc-accent" placeholder="^FOH.*" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Assign Role</label>
                <select value={newRole} onChange={(e) => setNewRole(e.target.value as SwitchRole)} className="w-full px-3 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-gc-accent">
                  {SWITCH_ROLE_TEMPLATES.map((t) => (
                    <option key={t.id} value={t.role}>{t.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button onClick={handleAdd} className="px-4 py-1.5 text-sm bg-gc-accent hover:bg-gc-accent/80 text-white rounded-lg transition-colors">Add</button>
              <button onClick={() => setShowAddForm(false)} className="px-4 py-1.5 text-sm text-gray-400 hover:text-white transition-colors">Cancel</button>
            </div>
          </div>
        )}

        {/* Rules table */}
        <div className="overflow-x-auto rounded-lg border border-gray-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-800/60">
                <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-16">#</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Match Field</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Pattern</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Assign Role</th>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider w-20">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
              {sortedRules.map((r) => (
                <tr key={r.id} className="hover:bg-gray-800/40 transition-colors">
                  <td className="px-3 py-2.5 text-gray-500 font-mono">{r.priority}</td>
                  <td className="px-3 py-2.5">
                    <span className="px-2 py-0.5 text-xs rounded bg-gray-700 text-gray-300 uppercase">{r.matchField}</span>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-gc-accent">{r.matchPattern}</td>
                  <td className="px-3 py-2.5">
                    <span className="text-white text-xs">{SWITCH_ROLE_TEMPLATES.find((t) => t.role === r.assignRole)?.name ?? r.assignRole}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1">
                      <button onClick={() => deleteRule(r.id)} className="p-1 text-gray-500 hover:text-red-400 transition-colors" title="Delete">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {sortedRules.length === 0 && (
                <tr><td colSpan={5} className="text-center py-8 text-gray-600">No assignment rules configured.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Test results */}
        {testResults && (
          <div className="mt-4 rounded-lg border border-gray-700 bg-gc-panel p-4">
            <h4 className="text-white font-medium text-sm mb-3 flex items-center gap-2">
              <Play className="w-4 h-4 text-gc-accent" /> Test Results (mock switches)
            </h4>
            <div className="space-y-1">
              {[
                { id: 't1', name: 'FOH-CORE-01', model: 'GC-30i' },
                { id: 't2', name: 'FOH-DISTRO-01', model: 'GC-14t' },
                { id: 't3', name: 'SL-RACK-01', model: 'GC-16t' },
                { id: 't4', name: 'SR-RACK-01', model: 'GC-16t' },
                { id: 't5', name: 'TRUSS-A', model: 'GC-10' },
              ].map((sw) => {
                const assigned = testResults[sw.id];
                const roleT = assigned ? SWITCH_ROLE_TEMPLATES.find((t) => t.role === assigned) : null;
                return (
                  <div key={sw.id} className="flex items-center gap-3 text-xs py-1.5">
                    <span className="text-gray-400 w-36">{sw.name}</span>
                    <span className="text-gray-500 w-16">{sw.model}</span>
                    <span className="text-gray-600 mx-1">&rarr;</span>
                    {roleT ? (
                      <span className="px-2 py-0.5 rounded text-xs" style={{ backgroundColor: roleT.color + '22', color: roleT.color }}>
                        {roleT.name}
                      </span>
                    ) : (
                      <span className="text-gray-600 italic">No match</span>
                    )}
                  </div>
                );
              })}
            </div>
            <button onClick={() => setTestResults(null)} className="mt-3 text-xs text-gray-500 hover:text-white transition-colors">Dismiss</button>
          </div>
        )}
      </div>
    </div>
  );
};

// ===========================================================================
// FIRMWARE TAB
// ===========================================================================
const FirmwareTab: React.FC = () => {
  const { assets, getFirmwareSummary, getWarrantyAlerts } = useFleetStore();
  const summary = useMemo(() => getFirmwareSummary(), [assets]);
  const alerts = useMemo(() => getWarrantyAlerts(), [assets]);

  const versions = Object.entries(summary).sort((a, b) => b[1].length - a[1].length);
  const maxCount = Math.max(...versions.map(([, ids]) => ids.length), 1);

  const latestFirmware = versions[0]?.[0] ?? 'N/A';
  const activeAssets = assets.filter((a) => a.status !== 'retired');
  const needsUpdate = activeAssets.filter((a) => a.firmware !== latestFirmware);

  // Scheduled updates mock
  const [scheduled, setScheduled] = useState<string[]>([]);

  return (
    <div className="p-6 space-y-8">
      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard label="Active Assets" value={String(activeAssets.length)} icon={<Server className="w-5 h-5 text-blue-400" />} />
        <StatCard label="Latest Firmware" value={latestFirmware} icon={<Cpu className="w-5 h-5 text-emerald-400" />} />
        <StatCard label="Needs Update" value={String(needsUpdate.length)} icon={<Upload className="w-5 h-5 text-yellow-400" />} accent={needsUpdate.length > 0} />
        <StatCard label="Warranty Alerts" value={String(alerts.length)} icon={<AlertTriangle className="w-5 h-5 text-red-400" />} accent={alerts.length > 0} />
      </div>

      {/* Firmware Distribution */}
      <div>
        <h3 className="text-white font-semibold text-base mb-4">Firmware Version Distribution</h3>
        <div className="space-y-3">
          {versions.map(([version, ids]) => {
            const pct = (ids.length / maxCount) * 100;
            const isLatest = version === latestFirmware;
            return (
              <div key={version} className="flex items-center gap-4">
                <span className="text-sm font-mono text-gray-300 w-20">{version}</span>
                <div className="flex-1 h-7 bg-gray-800 rounded-lg overflow-hidden relative">
                  <div
                    className={`h-full rounded-lg transition-all duration-500 ${isLatest ? 'bg-emerald-500/40' : 'bg-yellow-500/40'}`}
                    style={{ width: `${pct}%` }}
                  />
                  <span className="absolute inset-0 flex items-center px-3 text-xs text-white font-medium">
                    {ids.length} switch{ids.length !== 1 ? 'es' : ''}
                  </span>
                </div>
                {isLatest && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 whitespace-nowrap">
                    Latest
                  </span>
                )}
              </div>
            );
          })}
          {versions.length === 0 && (
            <p className="text-gray-600 text-sm">No active assets.</p>
          )}
        </div>
      </div>

      {/* Switches needing updates */}
      {needsUpdate.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold text-base">Switches Needing Update</h3>
            <button
              onClick={() => setScheduled(needsUpdate.map((a) => a.id))}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gc-accent hover:bg-gc-accent/80 text-white rounded-lg transition-colors"
            >
              <Calendar className="w-3 h-3" /> Schedule All Updates
            </button>
          </div>
          <div className="overflow-x-auto rounded-lg border border-gray-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-800/60">
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Serial</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Model</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Current FW</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Target FW</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {needsUpdate.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-800/40 transition-colors">
                    <td className="px-3 py-2.5 text-white font-medium">{a.serial}</td>
                    <td className="px-3 py-2.5"><span className="px-2 py-0.5 text-xs rounded bg-gray-700 text-gray-300">{a.model}</span></td>
                    <td className="px-3 py-2.5 font-mono text-xs text-yellow-400">{a.firmware}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-emerald-400">{latestFirmware}</td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex px-2 py-0.5 text-xs rounded-full border capitalize ${statusColor[a.status]}`}>
                        {a.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      {scheduled.includes(a.id) ? (
                        <span className="flex items-center gap-1 text-xs text-gc-accent">
                          <Clock className="w-3 h-3" /> Scheduled
                        </span>
                      ) : (
                        <button
                          onClick={() => setScheduled((prev) => [...prev, a.id])}
                          className="text-xs text-gray-400 hover:text-gc-accent transition-colors"
                        >
                          Schedule
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Warranty alerts */}
      {alerts.length > 0 && (
        <div>
          <h3 className="text-white font-semibold text-base mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-400" /> Warranty Alerts
          </h3>
          <div className="space-y-2">
            {alerts.map((a) => {
              const daysLeft = Math.ceil((new Date(a.warrantyExpiry!).getTime() - Date.now()) / 86_400_000);
              return (
                <div key={a.id} className={`flex items-center justify-between px-4 py-3 rounded-lg border ${daysLeft < 0 ? 'border-red-500/30 bg-red-500/5' : 'border-yellow-500/30 bg-yellow-500/5'}`}>
                  <div className="flex items-center gap-3">
                    {daysLeft < 0
                      ? <XCircle className="w-4 h-4 text-red-400" />
                      : <Clock className="w-4 h-4 text-yellow-400" />
                    }
                    <span className="text-white text-sm font-medium">{a.serial}</span>
                    <span className="text-gray-500 text-xs">{a.model}</span>
                  </div>
                  <span className={`text-xs font-medium ${daysLeft < 0 ? 'text-red-400' : 'text-yellow-400'}`}>
                    {daysLeft < 0 ? `Expired ${Math.abs(daysLeft)}d ago` : `${daysLeft} days remaining`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Batch scheduler summary */}
      {scheduled.length > 0 && (
        <div className="rounded-lg border border-gc-accent/30 bg-gc-accent/5 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gc-accent" />
              <span className="text-sm text-white font-medium">{scheduled.length} update{scheduled.length !== 1 ? 's' : ''} scheduled</span>
            </div>
            <div className="flex items-center gap-2">
              <button className="px-3 py-1.5 text-xs font-medium bg-gc-accent hover:bg-gc-accent/80 text-white rounded-lg transition-colors">
                Run Now
              </button>
              <button
                onClick={() => setScheduled([])}
                className="px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Stat card helper
// ---------------------------------------------------------------------------
const StatCard: React.FC<{ label: string; value: string; icon: React.ReactNode; accent?: boolean }> = ({ label, value, icon, accent }) => (
  <div className={`rounded-lg border p-4 ${accent ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-gray-700 bg-gc-panel'}`}>
    <div className="flex items-center justify-between mb-2">
      {icon}
      <span className="text-2xl font-bold text-white">{value}</span>
    </div>
    <p className="text-xs text-gray-400">{label}</p>
  </div>
);

export default FleetView;
