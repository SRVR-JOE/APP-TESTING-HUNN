import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import {
  Info,
  AlertTriangle,
  XCircle,
  Zap,
  ChevronRight,
  ChevronDown,
  Copy,
  Filter,
} from 'lucide-react';
import type { EventLogEntry, Severity, EventCategory } from '../types/index';

// ─── Category colors ────────────────────────────────────────────────────────
const CATEGORY_COLORS: Record<EventCategory, string> = {
  discovery: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  link: 'bg-green-500/20 text-green-400 border-green-500/30',
  poe: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  config: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  health: 'bg-red-500/20 text-red-400 border-red-500/30',
  system: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

const SEVERITY_ICON: Record<Severity, React.ReactNode> = {
  info: <Info size={14} className="text-blue-400" />,
  warning: <AlertTriangle size={14} className="text-yellow-400" />,
  error: <XCircle size={14} className="text-red-400" />,
  critical: <Zap size={14} className="text-red-500 animate-pulse" />,
};

const SEVERITY_ROW_BG: Record<Severity, string> = {
  info: '',
  warning: '',
  error: 'bg-orange-900/10',
  critical: 'bg-red-900/15',
};

// ─── Context menu ────────────────────────────────────────────────────────────
interface ContextMenuState {
  x: number;
  y: number;
  entry: EventLogEntry;
}

// ─── Props ───────────────────────────────────────────────────────────────────
export interface VirtualLogTableProps {
  entries: EventLogEntry[];
  rowHeight?: number;
  overscan?: number;
  onRowClick?: (entry: EventLogEntry) => void;
  onFilterBySwitch?: (switchName: string) => void;
  liveTail?: boolean;
}

export default function VirtualLogTable({
  entries,
  rowHeight = 36,
  overscan = 10,
  onRowClick,
  onFilterBySwitch,
  liveTail = false,
}: VirtualLogTableProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(600);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // Measure container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      setContainerHeight(e.contentRect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Live tail: auto-scroll to bottom when new entries arrive
  useEffect(() => {
    if (liveTail && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [entries.length, liveTail]);

  // Scroll handler
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // Virtual range calculation
  const totalHeight = entries.length * rowHeight;
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const visibleCount = Math.ceil(containerHeight / rowHeight) + 2 * overscan;
  const endIndex = Math.min(entries.length, startIndex + visibleCount);

  const visibleEntries = useMemo(
    () => entries.slice(startIndex, endIndex),
    [entries, startIndex, endIndex]
  );

  // Close context menu on outside click
  useEffect(() => {
    const close = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', close);
      return () => document.removeEventListener('click', close);
    }
  }, [contextMenu]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, entry: EventLogEntry) => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, entry });
    },
    []
  );

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setContextMenu(null);
  };

  const formatTimestamp = (ts: string) => {
    const d = new Date(ts);
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    const ms = String(d.getMilliseconds()).padStart(3, '0');
    return `${h}:${m}:${s}.${ms}`;
  };

  const toggleExpand = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="flex flex-col h-full">
      {/* Column Headers */}
      <div className="flex items-center h-8 px-2 text-xs font-medium text-gray-400 uppercase tracking-wider bg-gray-800/50 border-b border-gray-700 flex-shrink-0">
        <div className="w-8" />
        <div className="w-28">Time</div>
        <div className="w-24">Category</div>
        <div className="w-8">Sev</div>
        <div className="w-32">Switch</div>
        <div className="flex-1">Message</div>
      </div>

      {/* Virtual scroll container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto"
        onScroll={handleScroll}
      >
        {/* Total height spacer */}
        <div style={{ height: totalHeight, position: 'relative' }}>
          {visibleEntries.map((entry, i) => {
            const index = startIndex + i;
            const isExpanded = expandedId === entry.id;

            return (
              <div
                key={entry.id}
                style={{
                  position: 'absolute',
                  top: index * rowHeight,
                  left: 0,
                  right: 0,
                }}
              >
                {/* Main row */}
                <div
                  className={`flex items-center h-[36px] px-2 text-sm border-b border-gray-800/50 cursor-pointer hover:bg-gray-700/30 transition-colors ${SEVERITY_ROW_BG[entry.severity]}`}
                  onClick={() => {
                    toggleExpand(entry.id);
                    onRowClick?.(entry);
                  }}
                  onContextMenu={(e) => handleContextMenu(e, entry)}
                >
                  {/* Expand arrow */}
                  <div className="w-8 flex justify-center text-gray-500">
                    {entry.details ? (
                      isExpanded ? (
                        <ChevronDown size={14} />
                      ) : (
                        <ChevronRight size={14} />
                      )
                    ) : null}
                  </div>

                  {/* Timestamp */}
                  <div
                    className="w-28 font-mono text-xs text-gray-300"
                    title={entry.timestamp}
                  >
                    {formatTimestamp(entry.timestamp)}
                  </div>

                  {/* Category */}
                  <div className="w-24">
                    <span
                      className={`inline-block px-1.5 py-0.5 text-[10px] font-medium rounded border ${CATEGORY_COLORS[entry.category]}`}
                    >
                      {entry.category}
                    </span>
                  </div>

                  {/* Severity icon */}
                  <div className="w-8 flex justify-center" title={entry.severity}>
                    {SEVERITY_ICON[entry.severity]}
                  </div>

                  {/* Switch name */}
                  <div className="w-32 text-xs truncate">
                    {entry.switchName ? (
                      <span className="text-gray-300">{entry.switchName}</span>
                    ) : (
                      <span className="text-gray-600 italic">--</span>
                    )}
                  </div>

                  {/* Message */}
                  <div className="flex-1 text-xs text-gray-200 truncate" title={entry.message}>
                    {entry.message}
                  </div>
                </div>

                {/* Expanded detail panel */}
                {isExpanded && entry.details && (
                  <div className="bg-gray-800/60 border-b border-gray-700 px-10 py-3">
                    <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap max-h-60 overflow-auto">
                      {(() => {
                        try {
                          return JSON.stringify(JSON.parse(entry.details), null, 2);
                        } catch {
                          return entry.details;
                        }
                      })()}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-gray-800 border border-gray-600 rounded-lg shadow-xl py-1 min-w-[180px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            className="w-full text-left px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2"
            onClick={() => copyText(contextMenu.entry.message)}
          >
            <Copy size={13} /> Copy message
          </button>
          <button
            className="w-full text-left px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2"
            onClick={() =>
              copyText(JSON.stringify(contextMenu.entry, null, 2))
            }
          >
            <Copy size={13} /> Copy JSON
          </button>
          {contextMenu.entry.switchName && onFilterBySwitch && (
            <button
              className="w-full text-left px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-700 flex items-center gap-2"
              onClick={() => {
                onFilterBySwitch(contextMenu.entry.switchName!);
                setContextMenu(null);
              }}
            >
              <Filter size={13} /> Filter by this switch
            </button>
          )}
        </div>
      )}
    </div>
  );
}
