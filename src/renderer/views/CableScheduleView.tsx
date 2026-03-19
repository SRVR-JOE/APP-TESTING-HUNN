import React, { useState, useMemo, useCallback } from 'react';
import {
  Cable,
  Download,
  Printer,
  Plus,
  Trash2,
  Zap,
  ChevronUp,
  ChevronDown,
  Save,
  X,
  BarChart3,
  Check,
  Pencil,
} from 'lucide-react';
import type { CableRun } from '@shared/types';
import { useCableStore } from '../store/useCableStore';

// ═══════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════

const CABLE_TYPES: CableRun['type'][] = ['cat6', 'cat6a', 'fiber-sm', 'fiber-mm', 'coax', 'other'];
const STATUS_LIST: CableRun['status'][] = ['planned', 'installed', 'verified', 'faulty'];

const TYPE_COLORS: Record<CableRun['type'], string> = {
  cat6:       'bg-blue-600/20 text-blue-400 border-blue-600/30',
  cat6a:      'bg-cyan-600/20 text-cyan-400 border-cyan-600/30',
  'fiber-sm': 'bg-yellow-600/20 text-yellow-400 border-yellow-600/30',
  'fiber-mm': 'bg-orange-600/20 text-orange-400 border-orange-600/30',
  coax:       'bg-purple-600/20 text-purple-400 border-purple-600/30',
  other:      'bg-gray-600/20 text-gray-400 border-gray-600/30',
};

const STATUS_COLORS: Record<CableRun['status'], string> = {
  planned:   'bg-gray-600/20 text-gray-400 border-gray-600/30',
  installed: 'bg-blue-600/20 text-blue-400 border-blue-600/30',
  verified:  'bg-emerald-600/20 text-emerald-400 border-emerald-600/30',
  faulty:    'bg-red-600/20 text-red-400 border-red-600/30',
};

const TYPE_BAR_COLORS: Record<CableRun['type'], string> = {
  cat6: '#3b82f6', cat6a: '#06b6d4', 'fiber-sm': '#eab308', 'fiber-mm': '#f97316', coax: '#a855f7', other: '#6b7280',
};

type SortKey = 'label' | 'type' | 'lengthMeters' | 'status';

// ═══════════════════════════════════════════════════════════════════════════
// Add Cable Form
// ═══════════════════════════════════════════════════════════════════════════

function AddCableForm({ onAdd, onCancel }: { onAdd: (c: CableRun) => void; onCancel: () => void }) {
  const [form, setForm] = useState<Partial<CableRun>>({
    type: 'cat6',
    lengthMeters: 10,
    status: 'planned',
    label: '',
    sourceLocation: '',
    destLocation: '',
    sourceSwitchId: '',
    sourcePort: 1,
    destSwitchId: '',
    destPort: 1,
    pathway: '',
    notes: '',
  });

  const handleSubmit = () => {
    if (!form.label) return;
    const cable: CableRun = {
      id: `cb-${Date.now()}`,
      label: form.label || '',
      type: form.type as CableRun['type'],
      lengthMeters: form.lengthMeters || 0,
      sourceSwitchId: form.sourceSwitchId || '',
      sourcePort: form.sourcePort || 1,
      sourceLocation: form.sourceLocation || '',
      destSwitchId: form.destSwitchId || '',
      destPort: form.destPort || 1,
      destLocation: form.destLocation || '',
      pathway: form.pathway,
      status: form.status as CableRun['status'],
      notes: form.notes,
    };
    onAdd(cable);
  };

  const field = (label: string, key: keyof CableRun, type = 'text') => (
    <div>
      <label className="text-xs text-gray-400 block mb-1">{label}</label>
      <input
        type={type}
        value={(form[key] ?? '') as string | number}
        onChange={(e) => setForm({ ...form, [key]: type === 'number' ? Number(e.target.value) : e.target.value })}
        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-gc-accent"
      />
    </div>
  );

  return (
    <div className="bg-gray-800/80 border border-gray-700 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Add Cable Run</h3>
        <button onClick={onCancel} className="text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {field('Label', 'label')}
        <div>
          <label className="text-xs text-gray-400 block mb-1">Type</label>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as CableRun['type'] })}
            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-gc-accent"
          >
            {CABLE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        {field('Length (m)', 'lengthMeters', 'number')}
        <div>
          <label className="text-xs text-gray-400 block mb-1">Status</label>
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as CableRun['status'] })}
            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-gc-accent"
          >
            {STATUS_LIST.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {field('Source Switch ID', 'sourceSwitchId')}
        {field('Source Port', 'sourcePort', 'number')}
        {field('Source Location', 'sourceLocation')}
        {field('Pathway', 'pathway')}
        {field('Dest Switch ID', 'destSwitchId')}
        {field('Dest Port', 'destPort', 'number')}
        {field('Dest Location', 'destLocation')}
        {field('Notes', 'notes')}
      </div>
      <div className="flex justify-end gap-2 mt-3">
        <button onClick={onCancel} className="px-3 py-1.5 rounded text-sm bg-gray-700 hover:bg-gray-600 transition">Cancel</button>
        <button onClick={handleSubmit} className="px-3 py-1.5 rounded text-sm bg-gc-accent hover:brightness-110 text-white font-medium transition flex items-center gap-1">
          <Plus className="w-3.5 h-3.5" /> Add Cable
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════

const CableScheduleView: React.FC = () => {
  const { getActiveSchedule, addCable, updateCable, deleteCable, generateFromTopology, getCablesByType, getTotalLength } = useCableStore();

  const schedule = getActiveSchedule();
  const cables = schedule?.cables ?? [];

  const [showAddForm, setShowAddForm] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('label');
  const [sortAsc, setSortAsc] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<CableRun>>({});

  // ── Sorting ───────────────────────────────────────────────────────────
  const sorted = useMemo(() => {
    const arr = [...cables];
    arr.sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      if (typeof av === 'number' && typeof bv === 'number') return sortAsc ? av - bv : bv - av;
      return sortAsc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
    return arr;
  }, [cables, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k ? (sortAsc ? <ChevronUp className="w-3 h-3 inline ml-1" /> : <ChevronDown className="w-3 h-3 inline ml-1" />) : null;

  // ── Summary ───────────────────────────────────────────────────────────
  const byType = getCablesByType();
  const totalLength = getTotalLength();
  const totalCables = cables.length;
  const maxCount = Math.max(...Object.values(byType).map((a) => a.length), 1);

  // ── CSV export ────────────────────────────────────────────────────────
  const exportCSV = useCallback(() => {
    const header = 'Label,Type,Length(m),Source Switch,Source Port,Source Location,Dest Switch,Dest Port,Dest Location,Pathway,Status,Notes';
    const rows = cables.map((c) =>
      `"${c.label}","${c.type}",${c.lengthMeters},"${c.sourceSwitchId}",${c.sourcePort},"${c.sourceLocation}","${c.destSwitchId}",${c.destPort},"${c.destLocation}","${c.pathway ?? ''}","${c.status}","${(c.notes ?? '').replace(/"/g, '""')}"`,
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cable-schedule-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [cables]);

  // ── Print ─────────────────────────────────────────────────────────────
  const handlePrint = useCallback(() => {
    const printContent = `
      <html><head><title>Cable Schedule</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 11px; color: #111; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        th, td { border: 1px solid #ccc; padding: 4px 8px; text-align: left; }
        th { background: #f3f4f6; font-weight: 600; }
        h1 { font-size: 18px; margin-bottom: 4px; }
        .meta { color: #666; font-size: 10px; margin-bottom: 8px; }
      </style></head><body>
      <h1>Cable Schedule</h1>
      <div class="meta">Generated ${new Date().toLocaleString()} | ${totalCables} cables | ${totalLength}m total</div>
      <table>
        <tr><th>Label</th><th>Type</th><th>Length</th><th>Source</th><th>Dest</th><th>Pathway</th><th>Status</th><th>Notes</th></tr>
        ${cables.map((c) => `<tr><td>${c.label}</td><td>${c.type}</td><td>${c.lengthMeters}m</td><td>${c.sourceLocation} P${c.sourcePort}</td><td>${c.destLocation} P${c.destPort}</td><td>${c.pathway ?? ''}</td><td>${c.status}</td><td>${c.notes ?? ''}</td></tr>`).join('')}
      </table></body></html>`;
    const win = window.open('', '_blank');
    if (win) { win.document.write(printContent); win.document.close(); win.print(); }
  }, [cables, totalCables, totalLength]);

  // ── Inline editing ────────────────────────────────────────────────────
  const startEdit = (c: CableRun) => { setEditingId(c.id); setEditValues({ ...c }); };
  const saveEdit = () => {
    if (editingId && editValues) { updateCable(editingId, editValues); setEditingId(null); }
  };
  const cancelEdit = () => { setEditingId(null); setEditValues({}); };

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white overflow-hidden">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <Cable className="w-6 h-6 text-gc-accent" />
          <h1 className="text-xl font-bold tracking-tight">Cable Schedule</h1>
          <span className="text-sm text-gray-500 ml-2">{totalCables} cables</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={generateFromTopology} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-purple-600/20 text-purple-400 border border-purple-600/30 hover:bg-purple-600/30 text-sm transition">
            <Zap className="w-4 h-4" /> Auto-Generate
          </button>
          <button onClick={() => setShowAddForm(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-gc-accent hover:brightness-110 text-white text-sm font-medium transition">
            <Plus className="w-4 h-4" /> Add Cable
          </button>
          <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-sm transition">
            <Download className="w-4 h-4" /> CSV
          </button>
          <button onClick={handlePrint} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-sm transition">
            <Printer className="w-4 h-4" /> Print
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Table ────────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {showAddForm && (
            <div className="px-6 pt-4">
              <AddCableForm onAdd={(c) => { addCable(c); setShowAddForm(false); }} onCancel={() => setShowAddForm(false)} />
            </div>
          )}

          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-900 z-10">
                <tr className="text-left text-xs text-gray-500 uppercase tracking-wider border-b border-gray-800">
                  <th className="px-4 py-2.5 cursor-pointer hover:text-gray-300" onClick={() => toggleSort('label')}>Label<SortIcon k="label" /></th>
                  <th className="px-3 py-2.5 cursor-pointer hover:text-gray-300" onClick={() => toggleSort('type')}>Type<SortIcon k="type" /></th>
                  <th className="px-3 py-2.5 cursor-pointer hover:text-gray-300" onClick={() => toggleSort('lengthMeters')}>Length<SortIcon k="lengthMeters" /></th>
                  <th className="px-3 py-2.5">Source</th>
                  <th className="px-3 py-2.5">Dest</th>
                  <th className="px-3 py-2.5">Pathway</th>
                  <th className="px-3 py-2.5 cursor-pointer hover:text-gray-300" onClick={() => toggleSort('status')}>Status<SortIcon k="status" /></th>
                  <th className="px-3 py-2.5 w-20"></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((cable) => {
                  const isEditing = editingId === cable.id;
                  return (
                    <tr key={cable.id} className={`border-b border-gray-800/60 ${isEditing ? 'bg-gray-800/30' : 'hover:bg-gray-800/20'} transition`}>
                      <td className="px-4 py-2 font-medium text-white">
                        {isEditing ? (
                          <input value={editValues.label ?? ''} onChange={(e) => setEditValues({ ...editValues, label: e.target.value })}
                            className="bg-gray-700 border border-gray-600 rounded px-1.5 py-0.5 text-sm w-full focus:outline-none focus:border-gc-accent" />
                        ) : cable.label}
                      </td>
                      <td className="px-3 py-2">
                        {isEditing ? (
                          <select value={editValues.type} onChange={(e) => setEditValues({ ...editValues, type: e.target.value as CableRun['type'] })}
                            className="bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-xs focus:outline-none">
                            {CABLE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                          </select>
                        ) : (
                          <span className={`px-2 py-0.5 rounded text-xs font-medium border ${TYPE_COLORS[cable.type]}`}>{cable.type}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-gray-300">
                        {isEditing ? (
                          <input type="number" value={editValues.lengthMeters ?? 0} onChange={(e) => setEditValues({ ...editValues, lengthMeters: Number(e.target.value) })}
                            className="bg-gray-700 border border-gray-600 rounded px-1.5 py-0.5 text-sm w-20 focus:outline-none focus:border-gc-accent" />
                        ) : `${cable.lengthMeters}m`}
                      </td>
                      <td className="px-3 py-2 text-gray-400 text-xs">
                        <div>{cable.sourceLocation}</div>
                        <div className="text-gray-600">P{cable.sourcePort}</div>
                      </td>
                      <td className="px-3 py-2 text-gray-400 text-xs">
                        <div>{cable.destLocation}</div>
                        <div className="text-gray-600">P{cable.destPort}</div>
                      </td>
                      <td className="px-3 py-2 text-gray-500 text-xs truncate max-w-[140px]">{cable.pathway ?? '-'}</td>
                      <td className="px-3 py-2">
                        {isEditing ? (
                          <select value={editValues.status} onChange={(e) => setEditValues({ ...editValues, status: e.target.value as CableRun['status'] })}
                            className="bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-xs focus:outline-none">
                            {STATUS_LIST.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        ) : (
                          <span className={`px-2 py-0.5 rounded text-xs font-medium border ${STATUS_COLORS[cable.status]}`}>{cable.status}</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          {isEditing ? (
                            <>
                              <button onClick={saveEdit} className="p-1 rounded hover:bg-emerald-600/20 text-emerald-400"><Check className="w-3.5 h-3.5" /></button>
                              <button onClick={cancelEdit} className="p-1 rounded hover:bg-gray-600/20 text-gray-400"><X className="w-3.5 h-3.5" /></button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => startEdit(cable)} className="p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-white"><Pencil className="w-3.5 h-3.5" /></button>
                              <button onClick={() => deleteCable(cable.id)} className="p-1 rounded hover:bg-red-600/20 text-gray-500 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {sorted.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-16 text-gray-600">No cables in schedule. Add one or auto-generate from topology.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Summary Panel ────────────────────────────────────────────── */}
        <div className="w-72 border-l border-gray-800 bg-gray-900 p-4 overflow-auto flex-shrink-0">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-gc-accent" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">Summary</h2>
          </div>

          {/* Totals */}
          <div className="space-y-3 mb-6">
            <div className="bg-gray-800/60 rounded-lg p-3 border border-gray-700/50">
              <div className="text-xs text-gray-500 uppercase tracking-wide">Total Cables</div>
              <div className="text-2xl font-bold mt-1">{totalCables}</div>
            </div>
            <div className="bg-gray-800/60 rounded-lg p-3 border border-gray-700/50">
              <div className="text-xs text-gray-500 uppercase tracking-wide">Total Length</div>
              <div className="text-2xl font-bold mt-1">{totalLength}<span className="text-sm text-gray-500 ml-1">m</span></div>
            </div>
            <div className="bg-gray-800/60 rounded-lg p-3 border border-gray-700/50">
              <div className="text-xs text-gray-500 uppercase tracking-wide">Est. Cost</div>
              <div className="text-lg font-bold mt-1 text-gray-500">--</div>
              <div className="text-xs text-gray-600">Cost estimation coming soon</div>
            </div>
          </div>

          {/* By type breakdown */}
          <h3 className="text-xs text-gray-500 uppercase tracking-wide mb-3">By Type</h3>
          <div className="space-y-2">
            {CABLE_TYPES.map((type) => {
              const count = byType[type]?.length ?? 0;
              const len = byType[type]?.reduce((s, c) => s + c.lengthMeters, 0) ?? 0;
              if (count === 0) return null;
              return (
                <div key={type}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-300 font-medium">{type}</span>
                    <span className="text-gray-500">{count} / {len}m</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-gray-800 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${(count / maxCount) * 100}%`, backgroundColor: TYPE_BAR_COLORS[type] }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Status breakdown */}
          <h3 className="text-xs text-gray-500 uppercase tracking-wide mb-3 mt-6">By Status</h3>
          <div className="space-y-1.5">
            {STATUS_LIST.map((status) => {
              const count = cables.filter((c) => c.status === status).length;
              if (count === 0) return null;
              return (
                <div key={status} className="flex items-center justify-between text-xs">
                  <span className={`px-2 py-0.5 rounded border ${STATUS_COLORS[status]}`}>{status}</span>
                  <span className="text-gray-500">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CableScheduleView;
