import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';

export interface SwitchNodeData {
  name: string;
  model: string;
  ip: string;
  healthStatus: 'healthy' | 'warning' | 'critical' | 'offline';
  portCount: number;
  portsUp: number;
  rackGroup?: string;
  firmware: string;
  colorMode: string;
  showLabels?: boolean;
}

const MODEL_COLORS: Record<string, string> = {
  'GC-30i': '#6366f1',   // indigo
  'GC-16t': '#0ea5e9',   // sky
  'GC-10i': '#8b5cf6',   // violet
  'GC-14t': '#06b6d4',   // cyan
  'GC-20':  '#3b82f6',   // blue
};

const HEALTH_COLORS: Record<string, string> = {
  healthy:  '#22c55e',
  warning:  '#eab308',
  critical: '#ef4444',
  offline:  '#6b7280',
};

const RACK_COLORS: Record<string, string> = {
  'Main Rack':    '#6366f1',
  'FOH Rack':     '#0ea5e9',
  'Stage Rack':   '#f59e0b',
  'Monitor Rack': '#10b981',
  'Stage Left':   '#8b5cf6',
  'Stage Right':  '#ec4899',
};

const HEALTH_DOT: Record<string, string> = {
  healthy:  'bg-green-500',
  warning:  'bg-yellow-500',
  critical: 'bg-red-500',
  offline:  'bg-gray-500',
};

function getBackgroundColor(data: SwitchNodeData): string {
  switch (data.colorMode) {
    case 'by-model':
      return MODEL_COLORS[data.model] ?? '#374151';
    case 'by-health':
      return HEALTH_COLORS[data.healthStatus] ?? '#374151';
    case 'by-rack':
      return RACK_COLORS[data.rackGroup ?? ''] ?? '#374151';
    default:
      return '#1e293b';
  }
}

function SwitchNodeComponent({ data, selected }: NodeProps<SwitchNodeData>) {
  const bg = getBackgroundColor(data);
  const portRatio = data.portCount > 0 ? data.portsUp / data.portCount : 0;

  return (
    <div
      className="relative transition-shadow duration-200"
      style={{
        width: 200,
        minHeight: 110,
      }}
    >
      {/* Handles */}
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-blue-400 !border-blue-600" />
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-blue-400 !border-blue-600" />
      <Handle type="target" position={Position.Left} id="left" className="!w-2 !h-2 !bg-blue-400 !border-blue-600" />
      <Handle type="source" position={Position.Right} id="right" className="!w-2 !h-2 !bg-blue-400 !border-blue-600" />

      <div
        className={`
          rounded-lg border px-3 py-2.5 text-white
          hover:shadow-lg hover:shadow-black/40 hover:-translate-y-0.5
          transition-all duration-200
          ${selected ? 'ring-2 ring-blue-500 ring-offset-1 ring-offset-gray-900' : ''}
        `}
        style={{
          backgroundColor: data.colorMode === 'default' ? '#1e293b' : bg + '22',
          borderColor: data.colorMode === 'default' ? '#334155' : bg,
        }}
      >
        {/* Model badge */}
        <div
          className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded mb-1.5 uppercase tracking-wide"
          style={{
            backgroundColor: MODEL_COLORS[data.model] ?? '#374151',
            color: '#fff',
          }}
        >
          {data.model}
        </div>

        {/* Name */}
        <div className="font-bold text-sm leading-tight truncate">{data.name}</div>

        {/* IP */}
        <div className="font-mono text-xs text-gray-400 mt-0.5">{data.ip}</div>

        {/* Health + Port summary row */}
        <div className="flex items-center gap-2 mt-2">
          <span className={`w-2 h-2 rounded-full ${HEALTH_DOT[data.healthStatus]}`} />
          <span className="text-[10px] text-gray-400 capitalize">{data.healthStatus}</span>
          <span className="text-[10px] text-gray-500 ml-auto">
            {data.portsUp}/{data.portCount} ports
          </span>
        </div>

        {/* Mini port bar */}
        <div className="mt-1.5 w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${portRatio * 100}%`,
              backgroundColor: portRatio > 0.7 ? '#22c55e' : portRatio > 0.3 ? '#eab308' : '#ef4444',
            }}
          />
        </div>
      </div>
    </div>
  );
}

export const SwitchNode = memo(SwitchNodeComponent);
export default SwitchNode;
