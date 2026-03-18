import React, { useState, useMemo } from 'react';

interface GroupRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface LinkInfo {
  sourcePort: number;
  targetPort: number;
  speed: string;
  status: 'up' | 'down';
}

interface ISLLinkProps {
  fromGroup: GroupRect;
  toGroup: GroupRect;
  linkInfo: LinkInfo;
  onClick: () => void;
}

function getEdgePoints(from: GroupRect, to: GroupRect): { x1: number; y1: number; x2: number; y2: number } {
  const fromCx = from.x + from.width / 2;
  const fromCy = from.y + from.height / 2;
  const toCx = to.x + to.width / 2;
  const toCy = to.y + to.height / 2;

  // Determine which edges to connect (shortest path between rectangles)
  let x1: number, y1: number, x2: number, y2: number;

  const dx = toCx - fromCx;
  const dy = toCy - fromCy;

  // From group edge point
  if (Math.abs(dx) / from.width > Math.abs(dy) / from.height) {
    // Connect via left/right edges
    if (dx > 0) {
      x1 = from.x + from.width;
      x2 = to.x;
    } else {
      x1 = from.x;
      x2 = to.x + to.width;
    }
    y1 = fromCy;
    y2 = toCy;
  } else {
    // Connect via top/bottom edges
    if (dy > 0) {
      y1 = from.y + from.height;
      y2 = to.y;
    } else {
      y1 = from.y;
      y2 = to.y + to.height;
    }
    x1 = fromCx;
    x2 = toCx;
  }

  return { x1, y1, x2, y2 };
}

const ISLLink: React.FC<ISLLinkProps> = ({ fromGroup, toGroup, linkInfo, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);

  const { x1, y1, x2, y2 } = useMemo(
    () => getEdgePoints(fromGroup, toGroup),
    [fromGroup, toGroup]
  );

  const isUp = linkInfo.status === 'up';
  const strokeColor = isUp ? '#22c55e' : '#ef4444';
  const strokeWidth = isHovered ? 3 : 2;
  const dashArray = isUp ? 'none' : '6,4';

  // Midpoint for label
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;

  // Bezier control points for a slight curve
  const cpOffset = 30;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const perpAngle = angle + Math.PI / 2;
  const cpx = mx + Math.cos(perpAngle) * cpOffset;
  const cpy = my + Math.sin(perpAngle) * cpOffset;

  const path = `M ${x1} ${y1} Q ${cpx} ${cpy} ${x2} ${y2}`;

  return (
    <g
      className="cursor-pointer"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Invisible wider path for easier hover */}
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={16}
      />

      {/* Glow effect on hover */}
      {isHovered && (
        <path
          d={path}
          fill="none"
          stroke={strokeColor}
          strokeWidth={6}
          strokeOpacity={0.2}
          strokeDasharray={dashArray}
        />
      )}

      {/* Main line */}
      <path
        d={path}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeDasharray={dashArray}
        strokeLinecap="round"
        className="transition-all duration-150"
      />

      {/* Direction arrow at midpoint */}
      <circle
        cx={cpx > mx ? mx + 3 : mx - 3}
        cy={cpy > my ? my + 3 : my - 3}
        r={3}
        fill={strokeColor}
        opacity={0.8}
      />

      {/* Tooltip on hover */}
      {isHovered && (
        <g>
          <rect
            x={mx - 75}
            y={my - 32}
            width={150}
            height={24}
            rx={6}
            fill="#1f2937"
            stroke="#374151"
            strokeWidth={1}
          />
          <text
            x={mx}
            y={my - 16}
            textAnchor="middle"
            fill="#d1d5db"
            fontSize={11}
            fontFamily="monospace"
          >
            {`Port ${linkInfo.sourcePort} ↔ Port ${linkInfo.targetPort} | ${linkInfo.speed} | ${linkInfo.status === 'up' ? 'Up' : 'Down'}`}
          </text>
        </g>
      )}
    </g>
  );
};

export default ISLLink;
