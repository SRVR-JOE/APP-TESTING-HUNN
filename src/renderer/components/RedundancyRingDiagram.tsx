import React, { useMemo } from 'react';
import { Crown } from 'lucide-react';
import type { RedundancyConfig, RedundancyMember } from '@shared/types';

interface SwitchInfo {
  id: string;
  name: string;
}

interface RedundancyRingDiagramProps {
  config: RedundancyConfig;
  switches: SwitchInfo[];
  selectedLink?: { from: string; to: string } | null;
  onLinkClick?: (fromId: string, toId: string) => void;
  width?: number;
  height?: number;
}

const LINK_COLORS: Record<string, string> = {
  forwarding: '#22c55e',
  blocking: '#f59e0b',
  learning: '#3b82f6',
  disabled: '#6b7280',
};

const LINK_DASH: Record<string, string> = {
  forwarding: '',
  blocking: '8,4',
  learning: '4,4',
  disabled: '2,6',
};

export const RedundancyRingDiagram: React.FC<RedundancyRingDiagramProps> = ({
  config,
  switches,
  selectedLink,
  onLinkClick,
  width = 500,
  height = 500,
}) => {
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.35;

  // Build ordered node positions
  const nodes = useMemo(() => {
    return config.members.map((m, i) => {
      const angle = (2 * Math.PI * i) / config.members.length - Math.PI / 2;
      const sw = switches.find((s) => s.id === m.switchId);
      return {
        ...m,
        name: sw?.name ?? m.switchId,
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
        angle,
      };
    });
  }, [config.members, switches, cx, cy, radius]);

  // Build links between consecutive members (ring)
  const links = useMemo(() => {
    return nodes.map((node, i) => {
      const next = nodes[(i + 1) % nodes.length];
      return {
        from: node,
        to: next,
        linkStatus: node.linkStatus,
      };
    });
  }, [nodes]);

  const isSelected = (fromId: string, toId: string) =>
    selectedLink &&
    ((selectedLink.from === fromId && selectedLink.to === toId) ||
      (selectedLink.from === toId && selectedLink.to === fromId));

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="select-none"
    >
      {/* Background circle guide */}
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill="none"
        stroke="#1f2937"
        strokeWidth={1}
        strokeDasharray="4,8"
      />

      {/* Links */}
      {links.map((link, i) => {
        const sel = isSelected(link.from.switchId, link.to.switchId);
        const color = LINK_COLORS[link.linkStatus] ?? LINK_COLORS.disabled;
        return (
          <g key={`link-${i}`}>
            <line
              x1={link.from.x}
              y1={link.from.y}
              x2={link.to.x}
              y2={link.to.y}
              stroke={sel ? '#ef4444' : color}
              strokeWidth={sel ? 4 : 3}
              strokeDasharray={LINK_DASH[link.linkStatus] ?? ''}
              className="cursor-pointer transition-all duration-200"
              onClick={() => onLinkClick?.(link.from.switchId, link.to.switchId)}
            >
              {link.linkStatus === 'forwarding' && (
                <animate
                  attributeName="stroke-opacity"
                  values="1;0.5;1"
                  dur="2s"
                  repeatCount="indefinite"
                />
              )}
            </line>
            {/* Port labels on the link */}
            <text
              x={link.from.x + (link.to.x - link.from.x) * 0.25}
              y={link.from.y + (link.to.y - link.from.y) * 0.25 - 8}
              fill="#9ca3af"
              fontSize={10}
              textAnchor="middle"
            >
              P{link.from.portB}
            </text>
            <text
              x={link.from.x + (link.to.x - link.from.x) * 0.75}
              y={link.from.y + (link.to.y - link.from.y) * 0.75 - 8}
              fill="#9ca3af"
              fontSize={10}
              textAnchor="middle"
            >
              P{link.to.portA}
            </text>
            {/* "X" mark if selected (broken) */}
            {sel && (
              <text
                x={(link.from.x + link.to.x) / 2}
                y={(link.from.y + link.to.y) / 2}
                fill="#ef4444"
                fontSize={18}
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="central"
              >
                X
              </text>
            )}
          </g>
        );
      })}

      {/* Switch nodes */}
      {nodes.map((node) => {
        const isRoot = config.rootBridgeSwitchId === node.switchId;
        const roleColor =
          node.role === 'root'
            ? '#3b82f6'
            : node.role === 'designated'
              ? '#22c55e'
              : node.role === 'blocking'
                ? '#f59e0b'
                : '#6b7280';

        return (
          <g key={node.switchId}>
            {/* Outer ring for root */}
            {isRoot && (
              <circle
                cx={node.x}
                cy={node.y}
                r={32}
                fill="none"
                stroke="#3b82f6"
                strokeWidth={2}
                strokeDasharray="4,2"
              >
                <animate
                  attributeName="stroke-opacity"
                  values="1;0.3;1"
                  dur="2s"
                  repeatCount="indefinite"
                />
              </circle>
            )}
            {/* Node circle */}
            <circle
              cx={node.x}
              cy={node.y}
              r={26}
              fill="#1f2937"
              stroke={roleColor}
              strokeWidth={2.5}
            />
            {/* Switch name */}
            <text
              x={node.x}
              y={node.y + 1}
              fill="white"
              fontSize={10}
              fontWeight="600"
              textAnchor="middle"
              dominantBaseline="central"
            >
              {node.name.length > 8 ? node.name.slice(0, 8) : node.name}
            </text>
            {/* Role badge below */}
            <text
              x={node.x}
              y={node.y + 42}
              fill="#9ca3af"
              fontSize={9}
              textAnchor="middle"
            >
              {node.role}
            </text>
            {/* Crown for root */}
            {isRoot && (
              <g transform={`translate(${node.x - 7}, ${node.y - 44})`}>
                <rect x={-2} y={-2} width={18} height={18} rx={3} fill="#1f2937" />
                <Crown x={0} y={0} width={14} height={14} color="#f59e0b" />
              </g>
            )}
          </g>
        );
      })}

      {/* Legend */}
      <g transform="translate(12, 12)">
        <text fill="#9ca3af" fontSize={10} fontWeight="600" y={0}>
          Link States
        </text>
        {Object.entries(LINK_COLORS).map(([status, color], i) => (
          <g key={status} transform={`translate(0, ${16 + i * 16})`}>
            <line
              x1={0}
              y1={4}
              x2={20}
              y2={4}
              stroke={color}
              strokeWidth={2}
              strokeDasharray={LINK_DASH[status]}
            />
            <text x={26} y={8} fill="#d1d5db" fontSize={9}>
              {status}
            </text>
          </g>
        ))}
      </g>
    </svg>
  );
};

export default RedundancyRingDiagram;
