import React, { useMemo } from 'react';
import {
  Search,
  X,
  Download,
  Radio,
  Filter,
} from 'lucide-react';
import type { EventCategory, Severity } from '../types/index';

// ─── Types ───────────────────────────────────────────────────────────────────
export interface LogFilters {
  categories: Set<EventCategory>;
  severity: Severity | 'all';
  switchName: string;
  timeRange: 'last-hour' | 'last-24h' | 'last-7d' | 'custom';
  searchText: string;
  liveTail: boolean;
}

export interface LogFilterBarProps {
  filters: LogFilters;
  onChange: (filters: LogFilters) => void;
  switchNames: string[];
  onExport: (format: 'csv' | 'excel' | 'json') => void;
  totalEntries: number;
  filteredEntries: number;
  errorsLastHour: number;
  warningsLastHour: number;
  eventsPerMinute: number;
}

// ─── Category badge config ───────────────────────────────────────────────────
const CATEGORIES: { key: EventCategory; label: string; color: string }[] = [
  { key: 'discovery', label: 'Discovery', color: 'bg-blue-500' },
  { key: 'link', label: 'Link', color: 'bg-green-500' },
  { key: 'poe', label: 'PoE', color: 'bg-yellow-500' },
  { key: 'config', label: 'Config', color: 'bg-purple-500' },
  { key: 'health', label: 'Health', color: 'bg-red-500' },
  { key: 'system', label: 'System', color: 'bg-gray-500' },
];

export const DEFAULT_FILTERS: LogFilters = {
  categories: new Set<EventCategory>([
    'discovery',
    'link',
    'poe',
    'config',
    'health',
    'system',
  ]),
  severity: 'all',
  switchName: '',
  timeRange: 'last-24h',
  searchText: '',
  liveTail: false,
};

export default function LogFilterBar({
  filters,
  onChange,
  switchNames,
  onExport,
  totalEntries,
  filteredEntries,
  errorsLastHour,
  warningsLastHour,
  eventsPerMinute,
}: LogFilterBarProps) {
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.categories.size < 6) count++;
    if (filters.severity !== 'all') count++;
    if (filters.switchName) count++;
    if (filters.timeRange !== 'last-24h') count++;
    if (filters.searchText) count++;
    return count;
  }, [filters]);

  const toggleCategory = (cat: EventCategory) => {
    const next = new Set(filters.categories);
    if (next.has(cat)) {
      if (next.size > 1) next.delete(cat);
    } else {
      next.add(cat);
    }
    onChange({ ...filters, categories: next });
  };

  const clearFilters = () => onChange({ ...DEFAULT_FILTERS });

  const [exportOpen, setExportOpen] = React.useState(false);

  return (
    <div className="flex-shrink-0">
      {/* Filter controls row */}
      <div className="flex flex-wrap items-center gap-2 p-3 bg-gray-800/50 border border-gray-700 rounded-t-lg">
        {/* Category toggles */}
        <div className="flex items-center gap-1">
          {CATEGORIES.map((c) => {
            const active = filters.categories.has(c.key);
            return (
              <button
                key={c.key}
                onClick={() => toggleCategory(c.key)}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all border ${
                  active
                    ? `${c.color}/20 text-white border-current opacity-100`
                    : 'bg-gray-700/30 text-gray-500 border-gray-700 opacity-50'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${c.color}`} />
                {c.label}
              </button>
            );
          })}
        </div>

        <div className="w-px h-6 bg-gray-700" />

        {/* Severity dropdown */}
        <select
          value={filters.severity}
          onChange={(e) =>
            onChange({
              ...filters,
              severity: e.target.value as Severity | 'all',
            })
          }
          className="bg-gray-700 text-sm text-gray-200 px-2 py-1 rounded border border-gray-600 focus:outline-none focus:border-gc-accent"
        >
          <option value="all">All severities</option>
          <option value="info">Info</option>
          <option value="warning">Warning</option>
          <option value="error">Error</option>
          <option value="critical">Critical</option>
        </select>

        {/* Switch filter */}
        <select
          value={filters.switchName}
          onChange={(e) =>
            onChange({ ...filters, switchName: e.target.value })
          }
          className="bg-gray-700 text-sm text-gray-200 px-2 py-1 rounded border border-gray-600 focus:outline-none focus:border-gc-accent"
        >
          <option value="">All switches</option>
          {switchNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        {/* Time range */}
        <select
          value={filters.timeRange}
          onChange={(e) =>
            onChange({
              ...filters,
              timeRange: e.target.value as LogFilters['timeRange'],
            })
          }
          className="bg-gray-700 text-sm text-gray-200 px-2 py-1 rounded border border-gray-600 focus:outline-none focus:border-gc-accent"
        >
          <option value="last-hour">Last hour</option>
          <option value="last-24h">Last 24h</option>
          <option value="last-7d">Last 7 days</option>
          <option value="custom">Custom range</option>
        </select>

        <div className="w-px h-6 bg-gray-700" />

        {/* Search */}
        <div className="relative">
          <Search
            size={14}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500"
          />
          <input
            type="text"
            placeholder="Search logs..."
            value={filters.searchText}
            onChange={(e) =>
              onChange({ ...filters, searchText: e.target.value })
            }
            className="bg-gray-700 text-sm text-gray-200 pl-7 pr-2 py-1 rounded border border-gray-600 focus:outline-none focus:border-gc-accent w-48"
          />
        </div>

        <div className="w-px h-6 bg-gray-700" />

        {/* Live tail toggle */}
        <button
          onClick={() => onChange({ ...filters, liveTail: !filters.liveTail })}
          className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-all border ${
            filters.liveTail
              ? 'bg-green-500/20 text-green-400 border-green-500/40'
              : 'bg-gray-700/30 text-gray-400 border-gray-700'
          }`}
        >
          <Radio size={12} className={filters.liveTail ? 'animate-pulse' : ''} />
          Live tail
        </button>

        {/* Export dropdown */}
        <div className="relative">
          <button
            onClick={() => setExportOpen(!exportOpen)}
            className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium bg-gray-700/30 text-gray-400 border border-gray-700 hover:text-gray-200 transition-colors"
          >
            <Download size={12} />
            Export
          </button>
          {exportOpen && (
            <div className="absolute right-0 top-full mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-xl py-1 min-w-[100px] z-30">
              {(['csv', 'excel', 'json'] as const).map((fmt) => (
                <button
                  key={fmt}
                  className="w-full text-left px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-700"
                  onClick={() => {
                    onExport(fmt);
                    setExportOpen(false);
                  }}
                >
                  {fmt.toUpperCase()}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Active filter count + clear */}
        {activeFilterCount > 0 && (
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-gc-accent/20 text-gc-accent border border-gc-accent/30">
              <Filter size={10} />
              {activeFilterCount} active
            </span>
            <button
              onClick={clearFilters}
              className="text-xs text-gray-400 hover:text-white flex items-center gap-1"
            >
              <X size={12} />
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Stats footer bar */}
      <div className="flex items-center gap-4 px-3 py-1.5 bg-gray-800/30 border-x border-b border-gray-700 rounded-b-lg text-xs text-gray-500">
        <span>
          Total:{' '}
          <span className="text-gray-300 font-medium">
            {totalEntries.toLocaleString()}
          </span>
        </span>
        <span>
          Filtered:{' '}
          <span className="text-gray-300 font-medium">
            {filteredEntries.toLocaleString()}
          </span>
        </span>
        <span>
          Errors (1h):{' '}
          <span className="text-red-400 font-medium">{errorsLastHour}</span>
        </span>
        <span>
          Warnings (1h):{' '}
          <span className="text-yellow-400 font-medium">
            {warningsLastHour}
          </span>
        </span>
        <span className="ml-auto">
          <span className="text-gc-accent font-medium">
            {eventsPerMinute.toFixed(1)}
          </span>{' '}
          events/min
        </span>
      </div>
    </div>
  );
}
