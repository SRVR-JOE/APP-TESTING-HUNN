import React from 'react';
import { GripVertical, Zap } from 'lucide-react';
import type { SwitchInRack, OverlayMode } from '../store/useRackMapStore';

interface RackSwitchProps {
  switchData: SwitchInRack;
  overlayMode: OverlayMode;
  isSelected: boolean;
  onClick: () => void;
  compact?: boolean;
}

const healthDotColor: Record<string, string> = {
  healthy: 'bg-green-500',
  warning: 'bg-yellow-500',
  critical: 'bg-red-500',
  offline: 'bg-gray-500',
};

const healthDotPulse: Record<string, boolean> = {
  healthy: false,
  warning: false,
  critical: true,
  offline: false,
};

const modelBadgeColor: Record<string, string> = {
  'GC-30i': 'bg-blue-600/30 text-blue-300 border-blue-500/40',
  'GC-16t': 'bg-emerald-600/30 text-emerald-300 border-emerald-500/40',
  'GC-14t': 'bg-purple-600/30 text-purple-300 border-purple-500/40',
  'GC-10': 'bg-amber-600/30 text-amber-300 border-amber-500/40',
};

function getPortDotColor(
  port: { status: string; poeWatts?: number; groupColor?: string; vlanId?: number },
  overlayMode: OverlayMode
): string {
  if (port.status === 'down') return 'bg-gray-600';
  if (port.status === 'error') return 'bg-red-500';

  switch (overlayMode) {
    case 'poe':
      if (!port.poeWatts) return 'bg-gray-500';
      if (port.poeWatts > 20) return 'bg-red-400';
      if (port.poeWatts > 10) return 'bg-yellow-400';
      return 'bg-green-400';
    case 'health':
      return port.status === 'up' ? 'bg-green-400' : 'bg-gray-600';
    case 'traffic':
      return 'bg-cyan-400';
    case 'vlan': {
      const vlanColors = ['bg-blue-400', 'bg-emerald-400', 'bg-amber-400', 'bg-rose-400', 'bg-violet-400'];
      return port.vlanId ? vlanColors[(port.vlanId - 1) % vlanColors.length] : 'bg-gray-500';
    }
    default:
      return port.groupColor ? '' : 'bg-cyan-400';
  }
}

const RackSwitch: React.FC<RackSwitchProps> = ({
  switchData,
  overlayMode,
  isSelected,
  onClick,
  compact = false,
}) => {
  const poePct =
    switchData.poeBudgetWatts && switchData.poeBudgetWatts > 0
      ? Math.round(((switchData.poeDrawWatts ?? 0) / switchData.poeBudgetWatts) * 100)
      : 0;

  const showPoe = overlayMode === 'poe' || overlayMode === 'default';
  const badge = modelBadgeColor[switchData.model] ?? 'bg-gray-600/30 text-gray-300 border-gray-500/40';

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/switch-id', switchData.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      className={`
        group relative rounded-lg border transition-all duration-150 cursor-pointer
        ${isSelected
          ? 'bg-gray-700/80 border-blue-500/60 ring-1 ring-blue-500/30'
          : 'bg-gray-750/60 border-gray-600/50 hover:border-gray-500/60 hover:bg-gray-700/50'}
        ${compact ? 'p-2' : 'p-3'}
      `}
      onClick={onClick}
      draggable
      onDragStart={handleDragStart}
    >
      {/* Drag handle */}
      <div className="absolute left-0 top-0 bottom-0 w-5 flex items-center justify-center opacity-0 group-hover:opacity-60 transition-opacity cursor-grab active:cursor-grabbing">
        <GripVertical size={12} className="text-gray-400" />
      </div>

      <div className="ml-3">
        {/* Header row: model badge, name, health dot */}
        <div className="flex items-center gap-2 mb-1.5">
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${badge}`}>
            {switchData.model}
          </span>
          <span className="text-sm font-semibold text-gray-200 truncate flex-1">
            {switchData.name}
          </span>
          <span className="relative flex items-center gap-1">
            {healthDotPulse[switchData.healthStatus] && (
              <span className={`absolute w-2.5 h-2.5 rounded-full ${healthDotColor[switchData.healthStatus]} opacity-75 animate-ping`} />
            )}
            <span className={`w-2 h-2 rounded-full ${healthDotColor[switchData.healthStatus]}`} />
            <span className="text-[10px] text-gray-400">{switchData.healthStatus}</span>
          </span>
        </div>

        {/* IP address */}
        <div className="text-[11px] text-gray-500 font-mono mb-2">{switchData.ip}</div>

        {/* Port dots row */}
        <div className="flex flex-wrap gap-[3px] mb-2">
          {switchData.ports.map((p) => {
            const colorClass = getPortDotColor(p, overlayMode);
            const isSfp = p.type === 'sfp';
            return (
              <span
                key={p.port}
                className={`
                  ${isSfp ? 'w-2.5 h-1.5 rounded-sm' : 'w-1.5 h-1.5 rounded-full'}
                  ${colorClass}
                  ${p.status === 'up' && overlayMode === 'default' && p.groupColor ? '' : ''}
                  transition-colors
                `}
                style={
                  overlayMode === 'default' && p.groupColor && p.status === 'up'
                    ? { backgroundColor: p.groupColor }
                    : undefined
                }
                title={`Port ${p.port} | ${p.status}${p.poeWatts ? ` | ${p.poeWatts}W` : ''}${p.type === 'sfp' ? ' | SFP' : ''}`}
              />
            );
          })}
        </div>

        {/* PoE bar */}
        {showPoe && switchData.poeBudgetWatts != null && switchData.poeBudgetWatts > 0 && (
          <div className="flex items-center gap-1.5">
            <Zap size={10} className="text-yellow-500 flex-shrink-0" />
            <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  poePct > 90
                    ? 'bg-gradient-to-r from-yellow-500 to-red-500'
                    : poePct > 70
                    ? 'bg-gradient-to-r from-green-500 to-yellow-500'
                    : 'bg-gradient-to-r from-green-600 to-green-400'
                }`}
                style={{ width: `${Math.min(poePct, 100)}%` }}
              />
            </div>
            <span className="text-[10px] text-gray-500 font-mono whitespace-nowrap">
              {switchData.poeDrawWatts}W/{switchData.poeBudgetWatts}W
            </span>
          </div>
        )}

        {/* Traffic overlay */}
        {overlayMode === 'traffic' && (
          <div className="flex items-center gap-1.5 mt-1">
            <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-600 to-cyan-400 transition-all duration-500"
                style={{ width: `${Math.min((switchData.trafficMbps ?? 0) / 10, 100)}%` }}
              />
            </div>
            <span className="text-[10px] text-gray-500 font-mono">
              {switchData.trafficMbps ?? 0} Mbps
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default RackSwitch;
