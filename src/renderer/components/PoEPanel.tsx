import React, { useState, useMemo } from 'react';
import { AlertTriangle, Zap, ArrowDownUp } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PoePortInfo {
  port: number;
  label: string;
  enabled: boolean;
  status: 'delivering' | 'searching' | 'disabled' | 'fault' | 'denied';
  class: string;
  drawWatts: number;
  maxWatts: number;
  priority: 'low' | 'high' | 'critical';
}

export interface PoeSummary {
  totalBudgetWatts: number;
  totalDrawWatts: number;
  ports: PoePortInfo[];
}

export interface PoEPanelProps {
  poeSummary: PoeSummary;
  onTogglePoe: (port: number, enabled: boolean) => void;
  onSetPriority: (port: number, priority: 'low' | 'high' | 'critical') => void;
}

// ─── Budget Gauge ────────────────────────────────────────────────────────────

function getBudgetColor(pct: number): string {
  if (pct > 95) return '#ef4444';
  if (pct > 85) return '#f97316';
  if (pct > 70) return '#eab308';
  return '#22c55e';
}

const BudgetGauge: React.FC<{ total: number; draw: number }> = ({ total, draw }) => {
  const pct = total > 0 ? (draw / total) * 100 : 0;
  const color = getBudgetColor(pct);
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (pct / 100) * circumference;

  return (
    <div className="flex items-center gap-6">
      {/* Circular gauge */}
      <div className="relative w-36 h-36 flex-shrink-0">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 128 128">
          {/* Background circle */}
          <circle
            cx="64" cy="64" r={radius}
            fill="none"
            stroke="#374151"
            strokeWidth="10"
          />
          {/* Progress arc */}
          <circle
            cx="64" cy="64" r={radius}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-white">{Math.round(pct)}%</span>
          <span className="text-xs text-gray-400">Used</span>
        </div>
      </div>

      {/* Stats */}
      <div className="space-y-3">
        <div>
          <div className="text-xs text-gray-400 uppercase tracking-wider">Total Budget</div>
          <div className="text-xl font-semibold text-white">{total}W</div>
        </div>
        <div>
          <div className="text-xs text-gray-400 uppercase tracking-wider">Current Draw</div>
          <div className="text-xl font-semibold" style={{ color }}>{draw.toFixed(1)}W</div>
        </div>
        <div>
          <div className="text-xs text-gray-400 uppercase tracking-wider">Available</div>
          <div className="text-xl font-semibold text-gray-300">{(total - draw).toFixed(1)}W</div>
        </div>
      </div>

      {/* Horizontal bar alternative */}
      <div className="flex-1 ml-4">
        <div className="text-xs text-gray-400 mb-2">Budget Utilization</div>
        <div className="h-4 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>0W</span>
          <span>{total}W</span>
        </div>
      </div>
    </div>
  );
};

// ─── Toggle ──────────────────────────────────────────────────────────────────

const Toggle: React.FC<{ enabled: boolean; onChange: (val: boolean) => void }> = ({ enabled, onChange }) => (
  <button
    onClick={() => onChange(!enabled)}
    className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${enabled ? 'bg-gc-accent' : 'bg-gray-600'}`}
  >
    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${enabled ? 'translate-x-4' : 'translate-x-0'}`} />
  </button>
);

// ─── Status Badge ────────────────────────────────────────────────────────────

const statusColors: Record<string, string> = {
  delivering: 'bg-green-500/20 text-green-400 border-green-500/30',
  searching: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  disabled: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  fault: 'bg-red-500/20 text-red-400 border-red-500/30',
  denied: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => (
  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium border ${statusColors[status] || statusColors.disabled}`}>
    {status.charAt(0).toUpperCase() + status.slice(1)}
  </span>
);

// ─── Priority Dropdown ───────────────────────────────────────────────────────

const PriorityDropdown: React.FC<{
  value: 'low' | 'high' | 'critical';
  onChange: (val: 'low' | 'high' | 'critical') => void;
}> = ({ value, onChange }) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value as 'low' | 'high' | 'critical')}
    className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white outline-none cursor-pointer hover:border-gray-500"
  >
    <option value="low">Low</option>
    <option value="high">High</option>
    <option value="critical">Critical</option>
  </select>
);

// ─── Main Component ──────────────────────────────────────────────────────────

export const PoEPanel: React.FC<PoEPanelProps> = ({
  poeSummary,
  onTogglePoe,
  onSetPriority,
}) => {
  const [sortByDraw, setSortByDraw] = useState(false);
  const { totalBudgetWatts, totalDrawWatts, ports } = poeSummary;
  const pct = totalBudgetWatts > 0 ? (totalDrawWatts / totalBudgetWatts) * 100 : 0;

  const sortedPorts = useMemo(() => {
    if (sortByDraw) {
      return [...ports].sort((a, b) => b.drawWatts - a.drawWatts);
    }
    return [...ports].sort((a, b) => a.port - b.port);
  }, [ports, sortByDraw]);

  return (
    <div className="space-y-6">
      {/* Warning banner */}
      {pct > 85 && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${
          pct > 95
            ? 'bg-red-500/10 border-red-500/30 text-red-400'
            : 'bg-orange-500/10 border-orange-500/30 text-orange-400'
        }`}>
          <AlertTriangle size={18} />
          <span className="text-sm font-medium">
            {pct > 95
              ? `Critical: PoE budget at ${Math.round(pct)}%! Power supply may be overloaded.`
              : `Warning: PoE budget utilization at ${Math.round(pct)}%. Consider load balancing.`
            }
          </span>
        </div>
      )}

      {/* Budget gauge */}
      <div className="bg-gc-panel rounded-lg border border-gray-700 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Zap size={16} className="text-yellow-400" />
          <h3 className="text-sm font-medium text-white">PoE Power Budget</h3>
        </div>
        <BudgetGauge total={totalBudgetWatts} draw={totalDrawWatts} />
      </div>

      {/* Per-port table */}
      <div className="bg-gc-panel rounded-lg border border-gray-700 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <h3 className="text-sm font-medium text-white">Per-Port PoE Status</h3>
          <button
            onClick={() => setSortByDraw(!sortByDraw)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-colors ${
              sortByDraw
                ? 'bg-gc-accent/20 text-gc-accent'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            <ArrowDownUp size={12} />
            Sort by draw
          </button>
        </div>
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-800/60 border-b border-gray-700">
              <th className="px-4 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wider">Port</th>
              <th className="px-4 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wider">Enabled</th>
              <th className="px-4 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
              <th className="px-4 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wider">Class</th>
              <th className="px-4 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wider">Draw</th>
              <th className="px-4 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wider">Max</th>
              <th className="px-4 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wider">Priority</th>
            </tr>
          </thead>
          <tbody>
            {sortedPorts.map((port) => (
              <tr key={port.port} className="border-t border-gray-700/50 hover:bg-gray-800/30 transition-colors">
                <td className="px-4 py-2.5 text-sm font-mono text-white">{port.port}</td>
                <td className="px-4 py-2.5">
                  <Toggle
                    enabled={port.enabled}
                    onChange={(val) => onTogglePoe(port.port, val)}
                  />
                </td>
                <td className="px-4 py-2.5"><StatusBadge status={port.status} /></td>
                <td className="px-4 py-2.5 text-sm text-gray-300">{port.class}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-yellow-500"
                        style={{ width: `${port.maxWatts > 0 ? (port.drawWatts / port.maxWatts) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="text-sm text-white">{port.drawWatts.toFixed(1)}W</span>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-sm text-gray-400">{port.maxWatts}W</td>
                <td className="px-4 py-2.5">
                  <PriorityDropdown
                    value={port.priority}
                    onChange={(val) => onSetPriority(port.port, val)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PoEPanel;
