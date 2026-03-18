import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { AudioWaveform, Video, Lightbulb, Radio, HelpCircle } from 'lucide-react';

export interface DeviceNodeData {
  name: string;
  manufacturer: string;
  protocol: 'Dante' | 'NDI' | 'Art-Net' | 'AES67' | 'unknown';
  ip?: string;
  mac: string;
  showLabels?: boolean;
}

const PROTOCOL_CONFIG: Record<string, { icon: React.ComponentType<any>; color: string; label: string }> = {
  Dante:    { icon: AudioWaveform, color: '#22c55e', label: 'Dante' },
  NDI:      { icon: Video,         color: '#3b82f6', label: 'NDI' },
  'Art-Net': { icon: Lightbulb,    color: '#f59e0b', label: 'Art-Net' },
  AES67:    { icon: Radio,         color: '#a855f7', label: 'AES67' },
  unknown:  { icon: HelpCircle,    color: '#6b7280', label: 'Unknown' },
};

function DeviceNodeComponent({ data, selected }: NodeProps<DeviceNodeData>) {
  const config = PROTOCOL_CONFIG[data.protocol] ?? PROTOCOL_CONFIG.unknown;
  const Icon = config.icon;

  return (
    <div style={{ width: 130, minHeight: 64 }}>
      <Handle type="target" position={Position.Top} className="!w-1.5 !h-1.5 !bg-gray-400 !border-gray-500" />

      <div
        className={`
          rounded-xl border px-2.5 py-2 text-white text-center
          hover:shadow-md hover:shadow-black/30 hover:-translate-y-0.5
          transition-all duration-200
          ${selected ? 'ring-2 ring-blue-500 ring-offset-1 ring-offset-gray-900' : ''}
        `}
        style={{
          backgroundColor: '#111827',
          borderColor: config.color + '55',
        }}
      >
        {/* Icon + protocol badge */}
        <div className="flex items-center justify-center gap-1.5 mb-1">
          <Icon size={14} style={{ color: config.color }} />
          <span
            className="text-[9px] font-bold px-1 py-0.5 rounded uppercase tracking-wider"
            style={{ backgroundColor: config.color + '33', color: config.color }}
          >
            {config.label}
          </span>
        </div>

        {/* Device name */}
        <div className="text-xs font-medium leading-tight truncate">{data.name}</div>

        {/* Manufacturer */}
        <div className="text-[10px] text-gray-500 truncate mt-0.5">{data.manufacturer}</div>
      </div>
    </div>
  );
}

export const DeviceNode = memo(DeviceNodeComponent);
export default DeviceNode;
