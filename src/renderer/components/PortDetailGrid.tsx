import React, { useState, useCallback } from 'react';
import { Wifi, Cable, MonitorSpeaker } from 'lucide-react';
import type { PortInfo } from '../types';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface PortDetailGridProps {
  ports: PortInfo[];
  model: string;
  selectedPorts: number[];
  onPortSelect: (port: number, multiSelect: boolean) => void;
  colorMode: 'group' | 'status' | 'poe' | 'speed';
  onColorModeChange: (mode: string) => void;
}

// ─── Model Layout ────────────────────────────────────────────────────────────

function getPortCountForModel(model: string): number {
  if (model.includes('10')) return 12;
  if (model.includes('14')) return 14;
  if (model.includes('16')) return 16;
  if (model.includes('18')) return 18;
  if (model.includes('20')) return 20;
  if (model.includes('26')) return 26;
  if (model.includes('30')) return 30;
  return 16;
}

function getLayout(model: string, totalPorts: number) {
  // Last 2-4 ports are SFP/SFP+
  const sfpCount = totalPorts <= 14 ? 2 : totalPorts <= 20 ? 4 : totalPorts <= 26 ? 2 : 6;
  const copperCount = totalPorts - sfpCount;

  // Top row = odd ports, bottom row = even ports (mimicking GigaCore physical layout)
  const topRow: number[] = [];
  const bottomRow: number[] = [];
  for (let i = 1; i <= copperCount; i++) {
    if (i % 2 === 1) topRow.push(i);
    else bottomRow.push(i);
  }

  const sfpPorts: number[] = [];
  for (let i = copperCount + 1; i <= totalPorts; i++) {
    sfpPorts.push(i);
  }

  return { topRow, bottomRow, sfpPorts, copperCount };
}

// ─── Color Logic ─────────────────────────────────────────────────────────────

const GROUP_COLORS = [
  '#3b82f6', '#22c55e', '#a855f7', '#eab308', '#ec4899',
  '#06b6d4', '#f97316', '#14b8a6', '#ef4444', '#8b5cf6',
  '#6366f1', '#84cc16', '#f43f5e', '#0ea5e9', '#d946ef',
  '#10b981', '#f59e0b', '#64748b', '#fb923c', '#2dd4bf',
];

function getPortColor(port: PortInfo, colorMode: string): string {
  switch (colorMode) {
    case 'status':
      if (port.operStatus === 'up') return '#22c55e';
      if (port.adminStatus === 'down') return '#4b5563';
      return '#6b7280';
    case 'group':
      if (port.groupColor) return port.groupColor;
      if (port.groupId != null) return GROUP_COLORS[port.groupId % GROUP_COLORS.length];
      return '#4b5563';
    case 'poe':
      if (!port.poeEnabled) return '#4b5563';
      if ((port.poeWatts ?? 0) > 25) return '#ef4444';
      if ((port.poeWatts ?? 0) > 15) return '#f97316';
      if ((port.poeWatts ?? 0) > 0) return '#eab308';
      return '#6b7280';
    case 'speed':
      if (port.speed === '10G') return '#a855f7';
      if (port.speed === '1G') return '#3b82f6';
      if (port.speed === '100M') return '#22c55e';
      if (port.speed === '10M') return '#eab308';
      return '#4b5563';
    default:
      return port.operStatus === 'up' ? '#22c55e' : '#4b5563';
  }
}

// ─── Port Shape Components ───────────────────────────────────────────────────

const CopperPort: React.FC<{
  port: PortInfo;
  color: string;
  isSelected: boolean;
  onClick: (e: React.MouseEvent) => void;
  onHover: (port: PortInfo | null) => void;
}> = ({ port, color, isSelected, onClick, onHover }) => (
  <button
    onClick={onClick}
    onMouseEnter={() => onHover(port)}
    onMouseLeave={() => onHover(null)}
    className={`
      relative w-11 h-10 rounded-md border-2 transition-all duration-150
      hover:brightness-125 hover:scale-105 cursor-pointer
      flex flex-col items-center justify-center
      ${isSelected
        ? 'border-gc-accent ring-2 ring-gc-accent/50 scale-105'
        : 'border-gray-600/60 hover:border-gray-400'}
    `}
    style={{ backgroundColor: color }}
  >
    {/* Pin icon representation */}
    <div className="grid grid-cols-4 gap-px">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="w-1 h-1 rounded-full bg-black/30" />
      ))}
    </div>
    <span className="text-[9px] font-bold text-white/90 mt-0.5 drop-shadow-sm">
      {port.port}
    </span>
  </button>
);

const SfpPort: React.FC<{
  port: PortInfo;
  color: string;
  isSelected: boolean;
  onClick: (e: React.MouseEvent) => void;
  onHover: (port: PortInfo | null) => void;
}> = ({ port, color, isSelected, onClick, onHover }) => (
  <button
    onClick={onClick}
    onMouseEnter={() => onHover(port)}
    onMouseLeave={() => onHover(null)}
    className={`
      relative w-14 h-9 border-2 transition-all duration-150
      hover:brightness-125 hover:scale-105 cursor-pointer
      flex items-center justify-center
      ${isSelected
        ? 'border-gc-accent ring-2 ring-gc-accent/50 scale-105'
        : 'border-gray-600/60 hover:border-gray-400'}
    `}
    style={{
      backgroundColor: color,
      clipPath: 'polygon(8% 0%, 92% 0%, 100% 20%, 100% 100%, 0% 100%, 0% 20%)',
      borderRadius: '2px',
    }}
  >
    <div className="flex flex-col items-center">
      <div className="w-6 h-0.5 bg-white/30 rounded mb-0.5" />
      <span className="text-[9px] font-bold text-white/90 drop-shadow-sm">
        {port.type === 'sfp+' ? 'S+' : 'S'}{port.port}
      </span>
    </div>
  </button>
);

// ─── Tooltip ─────────────────────────────────────────────────────────────────

const PortTooltip: React.FC<{
  port: PortInfo;
  position: { x: number; y: number };
}> = ({ port, position }) => (
  <div
    className="fixed z-[100] px-3 py-2 rounded-lg bg-gray-900 border border-gray-600 text-xs text-gray-300 shadow-xl pointer-events-none"
    style={{ left: position.x + 12, top: position.y - 10 }}
  >
    <div className="font-semibold text-white mb-1">Port {port.port} — {port.label}</div>
    <div className="space-y-0.5">
      <div>Status: <span className={port.operStatus === 'up' ? 'text-green-400' : 'text-gray-500'}>{port.operStatus === 'up' ? 'Up' : 'Down'}</span></div>
      <div>Speed: {port.speed || 'N/A'}</div>
      <div>Type: {port.type.toUpperCase()}</div>
      {port.groupName && <div>Group: {port.groupName}</div>}
      {port.poeEnabled && <div>PoE: {port.poeWatts ?? 0}W</div>}
      {(port as PortInfoExtended).connectedDevice && (
        <div>Device: {(port as PortInfoExtended).connectedDevice}</div>
      )}
    </div>
  </div>
);

// Extended type for port with connected device info
interface PortInfoExtended extends PortInfo {
  connectedDevice?: string;
  duplex?: string;
  vlanMode?: string;
  txBytes?: number;
  rxBytes?: number;
  errors?: number;
  poeClass?: string;
  poeMaxWatts?: number;
  poeStatus?: string;
  poePriority?: 'low' | 'high' | 'critical';
  isTrunk?: boolean;
  trunkGroups?: number[];
}

// ─── Color Mode Toggle ──────────────────────────────────────────────────────

const colorModes: { key: string; label: string; icon: React.ReactNode }[] = [
  { key: 'group', label: 'Group', icon: <span className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 inline-block" /> },
  { key: 'status', label: 'Status', icon: <span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> },
  { key: 'poe', label: 'PoE', icon: <span className="w-3 h-3 rounded-full bg-yellow-500 inline-block" /> },
  { key: 'speed', label: 'Speed', icon: <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" /> },
];

// ─── Main Component ──────────────────────────────────────────────────────────

export const PortDetailGrid: React.FC<PortDetailGridProps> = ({
  ports,
  model,
  selectedPorts,
  onPortSelect,
  colorMode,
  onColorModeChange,
}) => {
  const [hoveredPort, setHoveredPort] = useState<PortInfo | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const portMap = new Map(ports.map((p) => [p.port, p]));
  const totalPorts = ports.length || getPortCountForModel(model);
  const layout = getLayout(model, totalPorts);

  const handlePortClick = useCallback(
    (port: number, e: React.MouseEvent) => {
      onPortSelect(port, e.shiftKey);
    },
    [onPortSelect]
  );

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  }, []);

  return (
    <div className="space-y-3" onMouseMove={handleMouseMove}>
      {/* Color mode toggle bar */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400 mr-1">Color by:</span>
        {colorModes.map((mode) => (
          <button
            key={mode.key}
            onClick={() => onColorModeChange(mode.key)}
            className={`
              flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all
              ${colorMode === mode.key
                ? 'bg-gc-accent/20 text-gc-accent border border-gc-accent/40'
                : 'bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700 hover:text-gray-300'}
            `}
          >
            {mode.icon}
            {mode.label}
          </button>
        ))}
        <div className="flex-1" />
        <span className="text-xs text-gray-500">
          {selectedPorts.length > 0 && `${selectedPorts.length} port${selectedPorts.length > 1 ? 's' : ''} selected`}
        </span>
      </div>

      {/* Switch faceplate */}
      <div className="bg-gray-800/80 rounded-xl border border-gray-700 p-5">
        {/* Model label */}
        <div className="flex items-center gap-2 mb-4">
          <MonitorSpeaker size={16} className="text-gray-500" />
          <span className="text-xs text-gray-500 font-mono uppercase tracking-wider">
            Luminex GigaCore {model}
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* Copper ports section - 2 rows */}
          <div className="flex flex-col gap-1.5">
            {/* Top row (odd ports) */}
            <div className="flex gap-1.5">
              {layout.topRow.map((num) => {
                const p = portMap.get(num);
                if (!p) return <div key={num} className="w-11 h-10" />;
                return (
                  <CopperPort
                    key={num}
                    port={p}
                    color={getPortColor(p, colorMode)}
                    isSelected={selectedPorts.includes(num)}
                    onClick={(e) => handlePortClick(num, e)}
                    onHover={setHoveredPort}
                  />
                );
              })}
            </div>
            {/* Bottom row (even ports) */}
            <div className="flex gap-1.5">
              {layout.bottomRow.map((num) => {
                const p = portMap.get(num);
                if (!p) return <div key={num} className="w-11 h-10" />;
                return (
                  <CopperPort
                    key={num}
                    port={p}
                    color={getPortColor(p, colorMode)}
                    isSelected={selectedPorts.includes(num)}
                    onClick={(e) => handlePortClick(num, e)}
                    onHover={setHoveredPort}
                  />
                );
              })}
            </div>
          </div>

          {/* Separator */}
          {layout.sfpPorts.length > 0 && (
            <div className="w-px h-20 bg-gray-600 mx-1" />
          )}

          {/* SFP ports section */}
          {layout.sfpPorts.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {/* SFPs in pairs: top/bottom */}
              <div className="flex gap-1.5">
                {layout.sfpPorts.filter((_, i) => i % 2 === 0).map((num) => {
                  const p = portMap.get(num);
                  if (!p) return <div key={num} className="w-14 h-9" />;
                  return (
                    <SfpPort
                      key={num}
                      port={p}
                      color={getPortColor(p, colorMode)}
                      isSelected={selectedPorts.includes(num)}
                      onClick={(e) => handlePortClick(num, e)}
                      onHover={setHoveredPort}
                    />
                  );
                })}
              </div>
              <div className="flex gap-1.5">
                {layout.sfpPorts.filter((_, i) => i % 2 === 1).map((num) => {
                  const p = portMap.get(num);
                  if (!p) return <div key={num} className="w-14 h-9" />;
                  return (
                    <SfpPort
                      key={num}
                      port={p}
                      color={getPortColor(p, colorMode)}
                      isSelected={selectedPorts.includes(num)}
                      onClick={(e) => handlePortClick(num, e)}
                      onHover={setHoveredPort}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 pt-3 border-t border-gray-700/50">
          <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
            <Cable size={12} /> RJ45
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
            <Wifi size={12} /> SFP/SFP+
          </div>
          <div className="text-[10px] text-gray-600 ml-auto">
            Shift+Click for multi-select
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {hoveredPort && <PortTooltip port={hoveredPort} position={mousePos} />}
    </div>
  );
};

export default PortDetailGrid;
