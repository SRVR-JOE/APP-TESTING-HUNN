import React, { useEffect, useMemo, useCallback, useState } from 'react';
import {
  ScrollText,
  Search,
  Download,
  X,
  Play,
  Pause,
  ChevronDown,
  ChevronUp,
  ArrowDown,
  BarChart3,
  Activity,
  Zap,
  Wifi,
} from 'lucide-react';
import LogTable from '../components/LogTable';
import PortStatsChart from '../components/PortStatsChart';
import TimeRangePicker from '../components/TimeRangePicker';
import {
  useLogStore,
  ALL_CATEGORIES,
  ALL_SEVERITIES,
  SWITCH_NAMES,
  type LogCategory,
  type LogSeverity,
} from '../store/useLogStore';

// ─── Category / Severity display config ─────────────────────────────────────

const CATEGORY_LABELS: Record<LogCategory, string> = {
  discovery: 'Discovery',
  config: 'Config',
  batch: 'Batch',
  excel: 'Excel',
  health: 'Health',
  error: 'Error',
  user: 'User',
};

const CATEGORY_COLORS: Record<LogCategory, string> = {
  discovery: 'bg-blue-500',
  config: 'bg-green-500',
  batch: 'bg-purple-500',
  excel: 'bg-teal-500',
  health: 'bg-yellow-500',
  error: 'bg-red-500',
  user: 'bg-gray-500',
};

const SEVERITY_COLORS: Record<LogSeverity, { active: string; inactive: string; label: string }> = {
  info: { active: 'bg-blue-600 text-white', inactive: 'bg-gray-800 text-gray-400', label: 'Info' },
  warning: { active: 'bg-yellow-600 text-white', inactive: 'bg-gray-800 text-gray-400', label: 'Warning' },
  error: { active: 'bg-orange-600 text-white', inactive: 'bg-gray-800 text-gray-400', label: 'Error' },
  critical: { active: 'bg-red-600 text-white', inactive: 'bg-gray-800 text-gray-400', label: 'Critical' },
};

const CHART_TABS = [
  { key: 'traffic' as const, label: 'Traffic', icon: Activity },
  { key: 'poe' as const, label: 'PoE', icon: Zap },
  { key: 'errors' as const, label: 'Errors', icon: BarChart3 },
  { key: 'frequency' as const, label: 'Event Frequency', icon: Wifi },
];

// ─── Export helpers ─────────────────────────────────────────────────────────

function exportCSV(entries: Array<Record<string, unknown>>) {
  if (entries.length === 0) return;
  const keys = Object.keys(entries[0]);
  const csv = [keys.join(','), ...entries.map((e) => keys.map((k) => `"${String(e[k] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
  downloadBlob(csv, 'logs-export.csv', 'text/csv');
}

function exportJSON(entries: unknown[]) {
  downloadBlob(JSON.stringify(entries, null, 2), 'logs-export.json', 'application/json');
}

function exportExcel(entries: Array<Record<string, unknown>>) {
  // Simple TSV as Excel-compatible export (real app would use exceljs)
  if (entries.length === 0) return;
  const keys = Object.keys(entries[0]);
  const tsv = [keys.join('\t'), ...entries.map((e) => keys.map((k) => String(e[k] ?? '')).join('\t'))].join('\n');
  downloadBlob(tsv, 'logs-export.xls', 'application/vnd.ms-excel');
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function LogsView() {
  const {
    entries,
    filteredEntries,
    totalCount,
    filters,
    isLiveTail,
    isLoading,
    expandedRowId,
    sortColumn,
    sortDirection,
    chartType,
    chartData,
    chartsCollapsed,
    selectedChartSwitch,
    selectedChartPort,
    bucketSize,
    newEventsCount,
    setFilters,
    clearFilters,
    toggleLiveTail,
    setSort,
    expandRow,
    loadEntries,
    loadMore,
    setChartType,
    toggleChartsCollapsed,
    setSelectedChartSwitch,
    setSelectedChartPort,
    setBucketSize,
    acknowledgeNewEvents,
  } = useLogStore();

  const [exportOpen, setExportOpen] = useState(false);

  // Load on mount
  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  // Close export dropdown on outside click
  useEffect(() => {
    if (!exportOpen) return;
    const handler = () => setExportOpen(false);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [exportOpen]);

  // ─── Category toggle ──────────────────────────────────────────────────────

  const toggleCategory = useCallback(
    (cat: LogCategory) => {
      const current = filters.categories;
      const updated = current.includes(cat)
        ? current.filter((c) => c !== cat)
        : [...current, cat];
      setFilters({ categories: updated.length > 0 ? updated : [cat] }); // Prevent empty
    },
    [filters.categories, setFilters]
  );

  // ─── Severity toggle ─────────────────────────────────────────────────────

  const toggleSeverity = useCallback(
    (sev: LogSeverity) => {
      const current = filters.severities;
      const updated = current.includes(sev)
        ? current.filter((s) => s !== sev)
        : [...current, sev];
      setFilters({ severities: updated.length > 0 ? updated : [sev] });
    },
    [filters.severities, setFilters]
  );

  // ─── Chart time range ────────────────────────────────────────────────────

  const chartTimeRange = useMemo(() => {
    const now = new Date();
    if (typeof filters.timeRange === 'object') {
      return filters.timeRange;
    }
    switch (filters.timeRange) {
      case 'last-hour':
        return { start: new Date(now.getTime() - 3600 * 1000).toISOString(), end: now.toISOString() };
      case 'last-24h':
        return { start: new Date(now.getTime() - 24 * 3600 * 1000).toISOString(), end: now.toISOString() };
      case 'last-7d':
        return { start: new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString(), end: now.toISOString() };
      default:
        return { start: new Date(now.getTime() - 24 * 3600 * 1000).toISOString(), end: now.toISOString() };
    }
  }, [filters.timeRange]);

  // ─── Row click handler ────────────────────────────────────────────────────

  const handleRowClick = useCallback(
    (entry: { id: number }) => {
      expandRow(expandedRowId === entry.id ? null : entry.id);
    },
    [expandedRowId, expandRow]
  );

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Header */}
      <div className="flex items-center gap-3 shrink-0">
        <ScrollText size={24} className="text-gc-accent" />
        <h2 className="text-xl font-semibold">Event Logs</h2>
        {isLoading && (
          <div className="ml-2 w-4 h-4 border-2 border-gc-accent border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      {/* ─── Filter Bar ────────────────────────────────────────────────────── */}
      <div className="bg-gc-panel rounded-lg border border-gray-700 p-3 space-y-3 shrink-0">
        {/* Row 1: Categories + Severities + Live tail */}
        <div className="flex items-center gap-4 flex-wrap">
          {/* Category checkboxes */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500 font-medium mr-1">Category:</span>
            {ALL_CATEGORIES.map((cat) => (
              <label
                key={cat}
                className="flex items-center gap-1.5 cursor-pointer text-xs text-gray-300 hover:text-white transition-colors"
              >
                <input
                  type="checkbox"
                  checked={filters.categories.includes(cat)}
                  onChange={() => toggleCategory(cat)}
                  className="sr-only"
                />
                <span
                  className={`w-3 h-3 rounded-sm border transition-colors flex items-center justify-center ${
                    filters.categories.includes(cat)
                      ? `${CATEGORY_COLORS[cat]} border-transparent`
                      : 'border-gray-500 bg-gray-800'
                  }`}
                >
                  {filters.categories.includes(cat) && (
                    <svg width="8" height="8" viewBox="0 0 8 8" className="text-white">
                      <path d="M1 4l2 2 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" />
                    </svg>
                  )}
                </span>
                {CATEGORY_LABELS[cat]}
              </label>
            ))}
          </div>

          <div className="w-px h-5 bg-gray-700" />

          {/* Severity toggles */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500 font-medium mr-1">Severity:</span>
            {ALL_SEVERITIES.map((sev) => {
              const cfg = SEVERITY_COLORS[sev];
              const active = filters.severities.includes(sev);
              return (
                <button
                  key={sev}
                  onClick={() => toggleSeverity(sev)}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                    active ? cfg.active : cfg.inactive
                  }`}
                >
                  {cfg.label}
                </button>
              );
            })}
          </div>

          <div className="w-px h-5 bg-gray-700" />

          {/* Live tail toggle */}
          <button
            onClick={toggleLiveTail}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${
              isLiveTail
                ? 'bg-green-600 text-white animate-pulse'
                : 'bg-gray-800 text-gray-400 hover:text-gray-200'
            }`}
          >
            {isLiveTail ? <Pause size={12} /> : <Play size={12} />}
            Live Tail
          </button>

          {newEventsCount > 0 && !isLiveTail && (
            <button
              onClick={acknowledgeNewEvents}
              className="flex items-center gap-1 px-2 py-1 rounded bg-gc-accent/20 text-gc-accent text-xs font-medium hover:bg-gc-accent/30 transition-colors"
            >
              <ArrowDown size={12} />
              {newEventsCount} new events
            </button>
          )}
        </div>

        {/* Row 2: Switch filter + Time range + Search + Export + Clear */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Switch filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500 font-medium">Switch:</span>
            <select
              value={filters.switchName}
              onChange={(e) => setFilters({ switchName: e.target.value })}
              className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-gc-accent"
            >
              <option value="all">All switches</option>
              {SWITCH_NAMES.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          <div className="w-px h-5 bg-gray-700" />

          {/* Time range */}
          <TimeRangePicker
            value={filters.timeRange}
            onChange={(range) => setFilters({ timeRange: range })}
          />

          <div className="w-px h-5 bg-gray-700" />

          {/* Search */}
          <div className="relative flex items-center">
            <Search size={14} className="absolute left-2 text-gray-500" />
            <input
              type="text"
              placeholder="Search messages..."
              value={filters.searchText}
              onChange={(e) => setFilters({ searchText: e.target.value })}
              className="bg-gray-800 border border-gray-600 rounded pl-7 pr-2 py-1 text-xs text-gray-200 w-52 focus:outline-none focus:border-gc-accent placeholder-gray-600"
            />
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Export dropdown */}
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setExportOpen(!exportOpen); }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-gray-800 text-gray-300 hover:text-white border border-gray-600 hover:border-gray-500 transition-colors"
            >
              <Download size={12} />
              Export
              <ChevronDown size={10} />
            </button>
            {exportOpen && (
              <div className="absolute right-0 top-full mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-20 py-1 min-w-[120px]">
                <button
                  onClick={() => exportCSV(filteredEntries as unknown as Array<Record<string, unknown>>)}
                  className="block w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700 hover:text-white"
                >
                  Export CSV
                </button>
                <button
                  onClick={() => exportExcel(filteredEntries as unknown as Array<Record<string, unknown>>)}
                  className="block w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700 hover:text-white"
                >
                  Export Excel
                </button>
                <button
                  onClick={() => exportJSON(filteredEntries)}
                  className="block w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-gray-700 hover:text-white"
                >
                  Export JSON
                </button>
              </div>
            )}
          </div>

          {/* Clear filters */}
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
          >
            <X size={12} />
            Clear Filters
          </button>

          {/* Result count */}
          <span className="text-xs text-gray-500">
            Showing{' '}
            <span className="text-gray-300 font-medium">{filteredEntries.length.toLocaleString()}</span>
            {' '}of{' '}
            <span className="text-gray-300 font-medium">{totalCount.toLocaleString()}</span>
            {' '}events
          </span>
        </div>
      </div>

      {/* ─── Log Table ─────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0">
        <LogTable
          entries={filteredEntries}
          totalCount={totalCount}
          isLiveTail={isLiveTail}
          onLoadMore={loadMore}
          onRowClick={handleRowClick}
          expandedRowId={expandedRowId}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSort={setSort}
        />
      </div>

      {/* ─── Charts Panel ──────────────────────────────────────────────────── */}
      <div className="bg-gc-panel rounded-lg border border-gray-700 shrink-0">
        {/* Charts header + collapse toggle */}
        <button
          onClick={toggleChartsCollapsed}
          className="w-full flex items-center justify-between px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
        >
          <div className="flex items-center gap-2">
            <BarChart3 size={16} className="text-gc-accent" />
            Charts
          </div>
          {chartsCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>

        {!chartsCollapsed && (
          <div className="border-t border-gray-700">
            {/* Tab bar */}
            <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-700">
              {CHART_TABS.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setChartType(key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    chartType === key
                      ? 'bg-gc-accent/20 text-gc-accent'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                  }`}
                >
                  <Icon size={13} />
                  {label}
                </button>
              ))}

              <div className="flex-1" />

              {/* Chart-specific controls */}
              {(chartType === 'traffic' || chartType === 'errors') && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Switch:</span>
                  <select
                    value={selectedChartSwitch}
                    onChange={(e) => setSelectedChartSwitch(e.target.value)}
                    className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-gc-accent"
                  >
                    {SWITCH_NAMES.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                  {chartType === 'traffic' && (
                    <>
                      <span className="text-xs text-gray-500">Port:</span>
                      <select
                        value={selectedChartPort}
                        onChange={(e) => setSelectedChartPort(Number(e.target.value))}
                        className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-gc-accent"
                      >
                        {Array.from({ length: 16 }, (_, i) => i + 1).map((p) => (
                          <option key={p} value={p}>Port {p}</option>
                        ))}
                      </select>
                    </>
                  )}
                </div>
              )}

              {chartType === 'frequency' && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Bucket:</span>
                  <select
                    value={bucketSize}
                    onChange={(e) => setBucketSize(e.target.value as '1min' | '5min' | '1hour' | '1day')}
                    className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-gc-accent"
                  >
                    <option value="1min">1 min</option>
                    <option value="5min">5 min</option>
                    <option value="1hour">1 hour</option>
                    <option value="1day">1 day</option>
                  </select>
                </div>
              )}
            </div>

            {/* Chart area */}
            <div className="px-4 py-3">
              <PortStatsChart
                data={chartData}
                chartType={chartType}
                timeRange={chartTimeRange}
                selectedSwitch={selectedChartSwitch}
                selectedPort={selectedChartPort}
                bucketSize={bucketSize}
                switchNames={SWITCH_NAMES}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
