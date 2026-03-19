import React, { useState } from 'react';
import { Eye, Activity, Globe, RefreshCw, Loader2 } from 'lucide-react';
import type { SwitchInfo } from '../types';
import { HealthIndicator } from './HealthIndicator';
import { PoEBar } from './PoEBar';
import { PortGrid } from './PortGrid';

interface SwitchCardProps {
  switchInfo: SwitchInfo;
  selected?: boolean;
  onSelect?: (id: string) => void;
  onPing?: (ip: string) => void;
  onOpenWebUI?: (ip: string) => void;
  onRefreshDetails?: (switchId: string) => void;
  isRefreshing?: boolean;
}

const modelColors: Record<string, { bg: string; text: string; border: string }> = {
  'GC-30i': { bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30' },
  'GC-16t': { bg: 'bg-green-500/15', text: 'text-green-400', border: 'border-green-500/30' },
  'GC-10i': { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30' },
  'GC-14R': { bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/30' },
  'GC-12t': { bg: 'bg-cyan-500/15', text: 'text-cyan-400', border: 'border-cyan-500/30' },
};

function getModelStyle(model: string) {
  for (const [key, style] of Object.entries(modelColors)) {
    if (model.includes(key)) return style;
  }
  return { bg: 'bg-gray-500/15', text: 'text-gray-400', border: 'border-gray-500/30' };
}

export const SwitchCard: React.FC<SwitchCardProps> = ({
  switchInfo,
  selected = false,
  onSelect,
  onPing,
  onOpenWebUI,
  onRefreshDetails,
  isRefreshing = false,
}) => {
  const [hovered, setHovered] = useState(false);
  const modelStyle = getModelStyle(switchInfo.model);

  const portsUp = switchInfo.ports.filter((p) => p.operStatus === 'up').length;
  const totalPorts = switchInfo.ports.length;

  return (
    <div
      className={`
        relative bg-gray-800 border rounded-lg p-4 cursor-pointer
        transition-all duration-200 group
        ${selected
          ? 'ring-2 ring-blue-500 border-blue-500'
          : hovered
            ? 'border-blue-500/50 shadow-lg shadow-blue-500/5'
            : 'border-gray-700 hover:border-gray-600'
        }
      `}
      onClick={() => onSelect?.(switchInfo.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Top row: model badge + health */}
      <div className="flex items-center justify-between mb-3">
        <span
          className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border ${modelStyle.bg} ${modelStyle.text} ${modelStyle.border}`}
        >
          {switchInfo.model}
        </span>
        <HealthIndicator status={switchInfo.status} size="sm" pulse />
      </div>

      {/* Name */}
      <h3 className="text-white font-semibold text-base mb-1 truncate">
        {switchInfo.name}
      </h3>

      {/* IP */}
      <p className="font-mono text-sm text-gray-400 mb-1">{switchInfo.ip}</p>

      {/* Firmware */}
      <p className="text-xs text-gray-500 mb-3">FW {switchInfo.firmware}</p>

      {/* Port summary */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-400">
            {portsUp}/{totalPorts} ports up
          </span>
        </div>
        <PortGrid
          ports={switchInfo.ports}
          model={switchInfo.model}
          compact
          colorMode="status"
        />
      </div>

      {/* PoE bar */}
      {switchInfo.poeBudgetWatts > 0 && (
        <div className="mt-2">
          <PoEBar
            drawWatts={switchInfo.poeDrawWatts}
            budgetWatts={switchInfo.poeBudgetWatts}
            compact
          />
        </div>
      )}

      {/* Location tag */}
      {switchInfo.rackGroup && (
        <div className="mt-2">
          <span className="inline-flex items-center px-1.5 py-0.5 text-xs bg-gray-700 text-gray-400 rounded">
            {switchInfo.rackGroup}
          </span>
        </div>
      )}

      {/* Uptime */}
      {switchInfo.uptime && (
        <p className="text-xs text-gray-500 mt-1">
          Uptime: {switchInfo.uptime}
        </p>
      )}

      {/* Quick action buttons on hover */}
      <div
        className={`
          absolute bottom-3 right-3 flex items-center gap-1
          transition-opacity duration-150
          ${hovered ? 'opacity-100' : 'opacity-0'}
        `}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRefreshDetails?.(switchInfo.id);
          }}
          disabled={isRefreshing}
          className="p-1.5 bg-gray-700 hover:bg-green-600 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors"
          title="Refresh Details"
        >
          {isRefreshing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSelect?.(switchInfo.id);
          }}
          className="p-1.5 bg-gray-700 hover:bg-blue-600 text-gray-400 hover:text-white rounded-md transition-colors"
          title="View Details"
        >
          <Eye className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPing?.(switchInfo.ip);
          }}
          className="p-1.5 bg-gray-700 hover:bg-blue-600 text-gray-400 hover:text-white rounded-md transition-colors"
          title="Ping"
        >
          <Activity className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenWebUI?.(switchInfo.ip);
          }}
          className="p-1.5 bg-gray-700 hover:bg-blue-600 text-gray-400 hover:text-white rounded-md transition-colors"
          title="Open Web UI"
        >
          <Globe className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default SwitchCard;
