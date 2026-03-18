import React, { useState } from 'react';
import {
  getBezierPath,
  EdgeLabelRenderer,
  type EdgeProps,
} from 'reactflow';

export interface LinkEdgeData {
  sourcePort: number;
  targetPort: number;
  speed: string;
  status: 'up' | 'down';
  isISL: boolean;
  trunkVlans?: number[];
  showLabels?: boolean;
}

export function LinkEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps<LinkEdgeData>) {
  const [hovered, setHovered] = useState(false);

  const isISL = data?.isISL ?? false;
  const status = data?.status ?? 'up';
  const speed = data?.speed ?? '';
  const sourcePort = data?.sourcePort ?? 0;
  const targetPort = data?.targetPort ?? 0;

  const strokeColor = status === 'up'
    ? isISL ? '#22c55e' : '#4b5563'
    : '#ef4444';

  const strokeWidth = isISL ? 3 : 1;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    curvature: 0.25,
  });

  const showLabel = hovered || selected || data?.showLabels;

  return (
    <>
      {/* Invisible wider path for easier hover/click */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ cursor: 'pointer' }}
      />

      {/* Visible edge */}
      <path
        d={edgePath}
        fill="none"
        stroke={strokeColor}
        strokeWidth={selected ? strokeWidth + 1 : strokeWidth}
        strokeDasharray={isISL && status === 'up' ? '8 4' : undefined}
        strokeLinecap="round"
        className={isISL && status === 'up' ? 'animate-dash' : ''}
        style={{
          filter: selected ? `drop-shadow(0 0 4px ${strokeColor})` : undefined,
          transition: 'stroke-width 0.2s, filter 0.2s',
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />

      {/* Edge label */}
      {showLabel && (
        <EdgeLabelRenderer>
          <div
            className="absolute pointer-events-none px-1.5 py-0.5 rounded text-[10px] font-mono whitespace-nowrap"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              backgroundColor: 'rgba(17, 24, 39, 0.9)',
              border: `1px solid ${strokeColor}`,
              color: '#d1d5db',
            }}
          >
            {isISL
              ? `Port ${sourcePort} \u2194 Port ${targetPort} | ${speed}`
              : `Port ${sourcePort} | ${speed}`}
          </div>
        </EdgeLabelRenderer>
      )}

      {/* CSS for dash animation */}
      <style>{`
        @keyframes dashMove {
          to { stroke-dashoffset: -24; }
        }
        .animate-dash {
          animation: dashMove 1s linear infinite;
        }
      `}</style>
    </>
  );
}

export default LinkEdge;
