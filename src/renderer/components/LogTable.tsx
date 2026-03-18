import React, { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import {
  Info,
  AlertTriangle,
  XCircle,
  AlertOctagon,
  ChevronDown,
  ChevronRight,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import type { EventLogEntry, LogCategory, LogSeverity } from '../store/useLogStore';

// ─── Props ──────────────────────────────────────────────────────────────────

export interface LogTableProps {
  entries: EventLogEntry[];
  totalCount: number;
  isLiveTail: boolean;
  onLoadMore: () => void;
  onRowClick: (entry: EventLogEntry) => void;
  expandedRowId: number | null;
  sortColumn: string;
  sortDirection: 'asc' | 'desc';
  onSort: (column: string) => void;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const ROW_HEIGHT = 40;
const EXPANDED_DETAIL_HEIGHT = 200;
const BUFFER_ROWS = 10;

const CATEGORY_COLORS: Record<LogCategory, { bg: string; text: string; label: string }> = {
  discovery: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Discovery' },
  config: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Config' },
  batch: { bg: 'bg-purple-500/20', text: 'text-purple-400', label: 'Batch' },
  excel: { bg: 'bg-teal-500/20', text: 'text-teal-400', label: 'Excel' },
  health: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'Health' },
  error: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Error' },
  user: { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'User' },
};

const SEVERITY_CONFIG: Record<LogSeverity, { icon: React.ComponentType<{ size?: number; className?: string }>; color: string; rowBg: string }> = {
  info: { icon: Info, color: 'text-blue-400', rowBg: '' },
  warning: { icon: AlertTriangle, color: 'text-yellow-400', rowBg: 'bg-yellow-500/5' },
  error: { icon: XCircle, color: 'text-orange-400', rowBg: 'bg-orange-500/5' },
  critical: { icon: AlertOctagon, color: 'text-red-400', rowBg: 'bg-red-500/8' },
};

const COLUMNS = [
  { key: 'timestamp', label: 'Timestamp', width: 'w-44' },
  { key: 'category', label: 'Category', width: 'w-28' },
  { key: 'severity', label: 'Severity', width: 'w-28' },
  { key: 'switchName', label: 'Switch', width: 'w-36' },
  { key: 'port', label: 'Port', width: 'w-16' },
  { key: 'message', label: 'Message', width: 'flex-1' },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleString([], {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatJson(jsonStr: string): string {
  try {
    return JSON.stringify(JSON.parse(jsonStr), null, 2);
  } catch {
    return jsonStr;
  }
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function LogTable({
  entries,
  totalCount,
  isLiveTail,
  onLoadMore,
  onRowClick,
  expandedRowId,
  sortColumn,
  sortDirection,
  onSort,
}: LogTableProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(600);

  // Measure container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Compute row positions accounting for expanded rows
  const rowPositions = useMemo(() => {
    let y = 0;
    return entries.map((entry) => {
      const pos = y;
      y += ROW_HEIGHT;
      if (entry.id === expandedRowId) {
        y += EXPANDED_DETAIL_HEIGHT;
      }
      return { top: pos, height: entry.id === expandedRowId ? ROW_HEIGHT + EXPANDED_DETAIL_HEIGHT : ROW_HEIGHT };
    });
  }, [entries, expandedRowId]);

  const totalHeight = rowPositions.length > 0
    ? rowPositions[rowPositions.length - 1].top + rowPositions[rowPositions.length - 1].height
    : 0;

  // Find visible rows
  const visibleRows = useMemo(() => {
    const start = scrollTop - BUFFER_ROWS * ROW_HEIGHT;
    const end = scrollTop + containerHeight + BUFFER_ROWS * ROW_HEIGHT;
    const result: Array<{ index: number; entry: EventLogEntry; top: number; height: number }> = [];

    for (let i = 0; i < entries.length; i++) {
      const pos = rowPositions[i];
      if (pos.top + pos.height >= start && pos.top <= end) {
        result.push({ index: i, entry: entries[i], top: pos.top, height: pos.height });
      }
    }
    return result;
  }, [entries, rowPositions, scrollTop, containerHeight]);

  // Scroll handler
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);

    // Load more when near bottom
    const { scrollTop: st, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - st - clientHeight < 200) {
      onLoadMore();
    }
  }, [onLoadMore]);

  // Auto-scroll to top for live tail
  useEffect(() => {
    if (isLiveTail && containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [isLiveTail, entries.length]);

  // Sort indicator
  const SortIcon = ({ column }: { column: string }) => {
    if (sortColumn !== column) return null;
    return sortDirection === 'asc' ? (
      <ArrowUp size={12} className="inline ml-1" />
    ) : (
      <ArrowDown size={12} className="inline ml-1" />
    );
  };

  return (
    <div className="flex flex-col border border-gray-700 rounded-lg overflow-hidden bg-gc-panel">
      {/* Header */}
      <div className="flex items-center border-b border-gray-700 bg-gray-800/80 text-xs font-semibold text-gray-400 select-none sticky top-0 z-10">
        {/* Expand chevron column */}
        <div className="w-8 shrink-0" />
        {COLUMNS.map((col) => (
          <button
            key={col.key}
            onClick={() => onSort(col.key)}
            className={`${col.width} px-2 py-2.5 text-left hover:text-gray-200 transition-colors truncate flex items-center gap-0.5`}
          >
            {col.label}
            <SortIcon column={col.key} />
          </button>
        ))}
      </div>

      {/* Virtualized body */}
      <div
        ref={containerRef}
        className="overflow-auto flex-1"
        style={{ minHeight: 200, maxHeight: 'calc(100vh - 460px)' }}
        onScroll={handleScroll}
      >
        <div style={{ height: totalHeight, position: 'relative' }}>
          {visibleRows.map(({ index, entry, top, height }) => {
            const isExpanded = entry.id === expandedRowId;
            const sevConfig = SEVERITY_CONFIG[entry.severity];
            const catConfig = CATEGORY_COLORS[entry.category];
            const SevIcon = sevConfig.icon;
            const altBg = index % 2 === 0 ? 'bg-gray-900/30' : '';

            return (
              <div
                key={entry.id}
                style={{ position: 'absolute', top, height, left: 0, right: 0 }}
              >
                {/* Row */}
                <div
                  className={`flex items-center text-xs cursor-pointer transition-colors hover:bg-gray-700/40 ${sevConfig.rowBg || altBg} border-b border-gray-800/50`}
                  style={{ height: ROW_HEIGHT }}
                  onClick={() => onRowClick(entry)}
                >
                  <div className="w-8 flex items-center justify-center shrink-0 text-gray-500">
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </div>

                  {/* Timestamp */}
                  <div className="w-44 px-2 truncate text-gray-300 font-mono">
                    {formatTimestamp(entry.timestamp)}
                  </div>

                  {/* Category */}
                  <div className="w-28 px-2">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${catConfig.bg} ${catConfig.text}`}>
                      {catConfig.label}
                    </span>
                  </div>

                  {/* Severity */}
                  <div className="w-28 px-2 flex items-center gap-1.5">
                    <SevIcon size={14} className={sevConfig.color} />
                    <span className={`capitalize ${sevConfig.color}`}>{entry.severity}</span>
                  </div>

                  {/* Switch */}
                  <div className="w-36 px-2 truncate text-gray-300 font-mono text-[11px]">
                    {entry.switchName || '-'}
                  </div>

                  {/* Port */}
                  <div className="w-16 px-2 text-gray-400">
                    {entry.port ?? '-'}
                  </div>

                  {/* Message */}
                  <div className="flex-1 px-2 truncate text-gray-200">
                    {entry.message}
                  </div>
                </div>

                {/* Expanded detail panel */}
                {isExpanded && (
                  <div
                    className="bg-gray-800/60 border-t border-gray-700 px-6 py-3 overflow-auto"
                    style={{ height: EXPANDED_DETAIL_HEIGHT }}
                  >
                    <div className="flex gap-8 text-xs mb-3">
                      <div>
                        <span className="text-gray-500">Full Timestamp: </span>
                        <span className="text-gray-200 font-mono">{entry.timestamp}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Switch MAC: </span>
                        <span className="text-gray-200 font-mono">{entry.switchMac || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Entry ID: </span>
                        <span className="text-gray-200 font-mono">{entry.id}</span>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 mb-1">Details (JSON):</div>
                    <pre className="text-[11px] leading-relaxed text-green-400 bg-gray-900 rounded p-3 overflow-auto max-h-[130px] font-mono">
                      {entry.details ? formatJson(entry.details) : 'No additional details'}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {entries.length === 0 && (
          <div className="flex items-center justify-center h-40 text-gray-500 text-sm">
            No log entries match the current filters.
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-gray-700 bg-gray-800/50 text-[11px] text-gray-500">
        <span>
          Showing {entries.length.toLocaleString()} of {totalCount.toLocaleString()} events
        </span>
        <span className="font-mono">{entries.length > 0 ? `Rows ${1}-${entries.length}` : ''}</span>
      </div>
    </div>
  );
}
