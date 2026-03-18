import React, { useState } from 'react';
import type { PortInfo } from '../types';

interface PortGridProps {
  ports: PortInfo[];
  model: string;
  compact?: boolean;
  onPortClick?: (port: number) => void;
  colorMode?: 'group' | 'status' | 'poe' | 'speed';
}

// Model-specific port layout configuration
function getLayout(model: string, portCount: number): { topRow: number[]; bottomRow: number[]; sfpStart: number } {
  // Split ports roughly in half, SFP ports at the end
  const sfpStart = model.includes('10i') ? 9 : model.includes('16t') ? 13 : model.includes('30i') ? 25 : portCount - 3;
  const copperPorts = Array.from({ length: sfpStart - 1 }, (_, i) => i + 1);
  const half = Math.ceil(copperPorts.length / 2);
  const topRow = copperPorts.slice(0, half);
  const bottomRow = copperPorts.slice(half);
  return { topRow, bottomRow, sfpStart };
}

function getPortColor(port: PortInfo, colorMode: string): string {
  switch (colorMode) {
    case 'status':
      if (port.operStatus === 'up') return 'bg-green-500';
      if (port.adminStatus === 'down') return 'bg-gray-600';
      return 'bg-gray-500';
    case 'group':
      return port.groupColor ? `bg-[${port.groupColor}]` : port.groupId
        ? ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-yellow-500', 'bg-pink-500', 'bg-cyan-500', 'bg-orange-500', 'bg-teal-500'][
            (port.groupId - 1) % 8
          ]
        : 'bg-gray-600';
    case 'poe':
      if (!port.poeEnabled) return 'bg-gray-600';
      if ((port.poeWatts ?? 0) > 0) return 'bg-yellow-500';
      return 'bg-gray-500';
    case 'speed':
      if (port.speed === '10G') return 'bg-purple-500';
      if (port.speed === '1G') return 'bg-blue-500';
      if (port.speed === '100M') return 'bg-green-500';
      return 'bg-gray-600';
    default:
      return port.operStatus === 'up' ? 'bg-green-500' : 'bg-gray-600';
  }
}

const PortDot: React.FC<{
  port: PortInfo;
  colorMode: string;
  compact: boolean;
  onClick?: () => void;
}> = ({ port, colorMode, compact, onClick }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const color = getPortColor(port, colorMode);
  const isSfp = port.type === 'sfp' || port.type === 'sfp+';

  const sizeClasses = compact
    ? isSfp
      ? 'w-3 h-2'
      : 'w-2.5 h-2.5'
    : isSfp
      ? 'w-6 h-4'
      : 'w-5 h-5';

  const shape = isSfp ? 'rounded-sm' : 'rounded';

  return (
    <div
      className="relative"
      onMouseEnter={() => !compact && setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <button
        onClick={onClick}
        className={`
          ${sizeClasses} ${shape} ${color}
          border border-gray-600/50
          hover:brightness-125 hover:scale-110
          transition-all duration-100
          ${onClick ? 'cursor-pointer' : 'cursor-default'}
        `}
        title={compact ? `Port ${port.label}` : undefined}
      />
      {showTooltip && !compact && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 rounded bg-gray-900 border border-gray-700 text-xs text-gray-300 whitespace-nowrap z-50 shadow-lg">
          <div className="font-semibold text-white mb-0.5">Port {port.label}</div>
          <div>Status: {port.operStatus === 'up' ? 'Up' : 'Down'}</div>
          <div>Speed: {port.speed || 'N/A'}</div>
          <div>Type: {port.type.toUpperCase()}</div>
          {port.groupName && <div>Group: {port.groupName}</div>}
          {port.poeEnabled && <div>PoE: {port.poeWatts ?? 0}W</div>}
        </div>
      )}
    </div>
  );
};

export const PortGrid: React.FC<PortGridProps> = ({
  ports,
  model,
  compact = false,
  onPortClick,
  colorMode = 'status',
}) => {
  const portMap = new Map(ports.map((p) => [p.port, p]));
  const layout = getLayout(model, ports.length);

  const sfpPorts = ports.filter(
    (p) => p.type === 'sfp' || p.type === 'sfp+'
  );
  const gapClass = compact ? 'gap-0.5' : 'gap-1';

  return (
    <div className={`inline-flex items-center ${gapClass}`}>
      {/* Copper ports in 2 rows */}
      <div className={`flex flex-col ${gapClass}`}>
        <div className={`flex ${gapClass}`}>
          {layout.topRow.map((num) => {
            const p = portMap.get(num);
            if (!p) return null;
            return (
              <PortDot
                key={num}
                port={p}
                colorMode={colorMode}
                compact={compact}
                onClick={onPortClick ? () => onPortClick(num) : undefined}
              />
            );
          })}
        </div>
        <div className={`flex ${gapClass}`}>
          {layout.bottomRow.map((num) => {
            const p = portMap.get(num);
            if (!p) return null;
            return (
              <PortDot
                key={num}
                port={p}
                colorMode={colorMode}
                compact={compact}
                onClick={onPortClick ? () => onPortClick(num) : undefined}
              />
            );
          })}
        </div>
      </div>

      {/* SFP ports separator + slots */}
      {sfpPorts.length > 0 && (
        <>
          <div className={`${compact ? 'w-px h-4' : 'w-px h-8'} bg-gray-600 mx-0.5`} />
          <div className={`flex flex-col ${gapClass}`}>
            {sfpPorts.map((p) => (
              <PortDot
                key={p.port}
                port={p}
                colorMode={colorMode}
                compact={compact}
                onClick={onPortClick ? () => onPortClick(p.port) : undefined}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default PortGrid;
