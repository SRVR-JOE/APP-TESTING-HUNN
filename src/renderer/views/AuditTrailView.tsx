import React, { useState, useMemo, useCallback } from 'react';
import {
  History,
  Search,
  Download,
  Filter,
  ChevronDown,
  ChevronRight,
  User,
  CalendarDays,
  Activity,
  X,
  FileText,
  BarChart3,
} from 'lucide-react';
import type { AuditAction, AuditEntry } from '@shared/types';
import { useAuditStore } from '../store/useAuditStore';

// ═══════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════

const ALL_ACTIONS: AuditAction[] = [
  'create', 'update', 'delete', 'deploy', 'rollback',
  'import', 'export', 'login', 'logout', 'assign', 'unassign',
];

const ENTITY_TYPES: AuditEntry['entityType'][] = [
  'switch', 'showfile', 'profile', 'vlan', 'venue', 'tour', 'template', 'fleet', 'system',
];

const ACTION_COLORS: Record<AuditAction, string> = {
  create:   'bg-emerald-600/20 text-emerald-400 border-emerald-600/30',
  update:   'bg-blue-600/20 text-blue-400 border-blue-600/30',
  delete:   'bg-red-600/20 text-red-400 border-red-600/30',
  deploy:   'bg-purple-600/20 text-purple-400 border-purple-600/30',
  rollback: 'bg-amber-600/20 text-amber-400 border-amber-600/30',
  import:   'bg-cyan-600/20 text-cyan-400 border-cyan-600/30',
  export:   'bg-teal-600/20 text-teal-400 border-teal-600/30',
  login:    'bg-gray-600/20 text-gray-300 border-gray-600/30',
  logout:   'bg-gray-600/20 text-gray-300 border-gray-600/30',
  assign:   'bg-indigo-600/20 text-indigo-400 border-indigo-600/30',
  unassign: 'bg-orange-600/20 text-orange-400 border-orange-600/30',
};

// ═══════════════════════════════════════════════════════════════════════════
// JSON Diff viewer
// ═══════════════════════════════════════════════════════════════════════════

function JsonDiff({ before, after }: { before?: string; after?: string }) {
  const parse = (s?: string) => {
    try { return s ? JSON.parse(s) : null; } catch { return s; }
  };
  const b = parse(before);
  const a = parse(after);

  return (
    <div className="grid grid-cols-2 gap-3 mt-2">
      <div>
        <div className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide">Before</div>
        <pre className="text-xs bg-gray-950 rounded p-2 text-red-300 overflow-auto max-h-40 border border-gray-800">
          {b ? JSON.stringify(b, null, 2) : '(none)'}
        </pre>
      </div>
      <div>
        <div className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide">After</div>
        <pre className="text-xs bg-gray-950 rounded p-2 text-emerald-300 overflow-auto max-h-40 border border-gray-800">
          {a ? JSON.stringify(a, null, 2) : '(none)'}
        </pre>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════

const AuditTrailView: React.FC = () => {
  const { filters, setFilter, clearFilters, getFilteredEntries, entries } = useAuditStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => getFilteredEntries(), [entries, filters]);

  // ── Summary stats ─────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const today = new Date().toDateString();
    const todayCount = entries.filter((e) => new Date(e.timestamp).toDateString() === today).length;

    const userCounts: Record<string, number> = {};
    const entityCounts: Record<string, number> = {};
    entries.forEach((e) => {
      const u = e.userName ?? 'unknown';
      userCounts[u] = (userCounts[u] || 0) + 1;
      const en = e.entityName ?? e.entityId;
      entityCounts[en] = (entityCounts[en] || 0) + 1;
    });

    const mostActiveUser = Object.entries(userCounts).sort((a, b) => b[1] - a[1])[0];
    const mostChangedEntity = Object.entries(entityCounts).sort((a, b) => b[1] - a[1])[0];

    return { total: entries.length, todayCount, mostActiveUser, mostChangedEntity };
  }, [entries]);

  // ── CSV export ────────────────────────────────────────────────────────
  const exportCSV = useCallback(() => {
    const header = 'Timestamp,User,Action,Entity Type,Entity Name,Description';
    const rows = filtered.map((e) =>
      `"${e.timestamp}","${e.userName ?? ''}","${e.action}","${e.entityType}","${e.entityName ?? ''}","${e.description.replace(/"/g, '""')}"`,
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-trail-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filtered]);

  // ── Formatting helpers ────────────────────────────────────────────────
  const fmtTime = (iso: string) => {
    const d = new Date(iso);
    const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    return { date, time };
  };

  const hasActiveFilters = filters.action || filters.entityType || filters.user || filters.dateRange || filters.search;

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white overflow-hidden">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <History className="w-6 h-6 text-gc-accent" />
          <h1 className="text-xl font-bold tracking-tight">Audit Trail</h1>
          <span className="text-sm text-gray-500 ml-2">{filtered.length} entries</span>
        </div>
        <button
          onClick={exportCSV}
          className="flex items-center gap-2 px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-sm transition"
        >
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {/* ── Stats ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4 px-6 py-4 border-b border-gray-800">
        {[
          { label: 'Total Changes', value: stats.total, icon: BarChart3, color: 'text-blue-400' },
          { label: 'Changes Today', value: stats.todayCount, icon: CalendarDays, color: 'text-emerald-400' },
          { label: 'Most Active User', value: stats.mostActiveUser?.[0] ?? '-', sub: stats.mostActiveUser ? `${stats.mostActiveUser[1]} changes` : '', icon: User, color: 'text-purple-400' },
          { label: 'Most Changed Entity', value: stats.mostChangedEntity?.[0] ?? '-', sub: stats.mostChangedEntity ? `${stats.mostChangedEntity[1]} changes` : '', icon: Activity, color: 'text-amber-400' },
        ].map((s, i) => (
          <div key={i} className="bg-gray-800/60 rounded-lg p-3 border border-gray-700/50">
            <div className="flex items-center gap-2 mb-1">
              <s.icon className={`w-4 h-4 ${s.color}`} />
              <span className="text-xs text-gray-400 uppercase tracking-wide">{s.label}</span>
            </div>
            <div className="text-lg font-semibold truncate">{s.value}</div>
            {'sub' in s && s.sub && <div className="text-xs text-gray-500">{s.sub}</div>}
          </div>
        ))}
      </div>

      {/* ── Filters ────────────────────────────────────────────────────── */}
      <div className="px-6 py-3 border-b border-gray-800 space-y-3">
        {/* Search + controls */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search descriptions, entities, users..."
              value={filters.search}
              onChange={(e) => setFilter('search', e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded bg-gray-800 border border-gray-700 text-sm focus:outline-none focus:border-gc-accent"
            />
          </div>

          {/* Entity type dropdown */}
          <select
            value={filters.entityType ?? ''}
            onChange={(e) => setFilter('entityType', (e.target.value || null) as AuditEntry['entityType'] | null)}
            className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-gc-accent"
          >
            <option value="">All Entity Types</option>
            {ENTITY_TYPES.map((t) => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>

          {/* User filter */}
          <div className="relative">
            <User className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
            <input
              type="text"
              placeholder="User..."
              value={filters.user}
              onChange={(e) => setFilter('user', e.target.value)}
              className="w-32 pl-8 pr-3 py-1.5 rounded bg-gray-800 border border-gray-700 text-sm focus:outline-none focus:border-gc-accent"
            />
          </div>

          {/* Date range */}
          <input
            type="date"
            value={filters.dateRange?.start ?? ''}
            onChange={(e) =>
              setFilter('dateRange', e.target.value ? { start: e.target.value, end: filters.dateRange?.end ?? '' } : null)
            }
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-gc-accent"
          />
          <span className="text-gray-500 text-sm">to</span>
          <input
            type="date"
            value={filters.dateRange?.end ?? ''}
            onChange={(e) =>
              setFilter('dateRange', e.target.value ? { start: filters.dateRange?.start ?? '', end: e.target.value } : null)
            }
            className="bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-gc-accent"
          />

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 px-2 py-1.5 rounded text-xs text-gray-400 hover:text-white hover:bg-gray-700 transition"
            >
              <X className="w-3.5 h-3.5" /> Clear
            </button>
          )}
        </div>

        {/* Action chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-gray-500 mr-1" />
          {ALL_ACTIONS.map((action) => (
            <button
              key={action}
              onClick={() => setFilter('action', filters.action === action ? null : action)}
              className={`px-2.5 py-0.5 rounded-full text-xs font-medium border transition ${
                filters.action === action
                  ? ACTION_COLORS[action]
                  : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-600'
              }`}
            >
              {action}
            </button>
          ))}
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-900 z-10">
            <tr className="text-left text-xs text-gray-500 uppercase tracking-wider border-b border-gray-800">
              <th className="pl-6 pr-2 py-2.5 w-8"></th>
              <th className="px-3 py-2.5">Time</th>
              <th className="px-3 py-2.5">User</th>
              <th className="px-3 py-2.5">Action</th>
              <th className="px-3 py-2.5">Entity Type</th>
              <th className="px-3 py-2.5">Entity Name</th>
              <th className="px-3 py-2.5">Description</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((entry) => {
              const expanded = expandedId === entry.id;
              const { date, time } = fmtTime(entry.timestamp);
              const hasDiff = entry.before || entry.after;

              return (
                <React.Fragment key={entry.id}>
                  <tr
                    onClick={() => hasDiff && setExpandedId(expanded ? null : entry.id)}
                    className={`border-b border-gray-800/60 transition ${
                      hasDiff ? 'cursor-pointer hover:bg-gray-800/40' : ''
                    } ${expanded ? 'bg-gray-800/30' : ''}`}
                  >
                    <td className="pl-6 pr-2 py-2.5 text-gray-600">
                      {hasDiff ? (
                        expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
                      ) : (
                        <FileText className="w-3.5 h-3.5 text-gray-700" />
                      )}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <div className="text-gray-300">{time}</div>
                      <div className="text-xs text-gray-600">{date}</div>
                    </td>
                    <td className="px-3 py-2.5 text-gray-300 font-medium">{entry.userName ?? '-'}</td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${ACTION_COLORS[entry.action]}`}>
                        {entry.action}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-gray-400 bg-gray-800 px-2 py-0.5 rounded text-xs">{entry.entityType}</span>
                    </td>
                    <td className="px-3 py-2.5 text-white font-medium truncate max-w-[200px]">{entry.entityName ?? entry.entityId}</td>
                    <td className="px-3 py-2.5 text-gray-400 truncate max-w-[350px]">{entry.description}</td>
                  </tr>
                  {expanded && hasDiff && (
                    <tr className="bg-gray-800/20">
                      <td colSpan={7} className="px-8 py-3">
                        <JsonDiff before={entry.before} after={entry.after} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-16 text-gray-600">
                  No audit entries match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AuditTrailView;
