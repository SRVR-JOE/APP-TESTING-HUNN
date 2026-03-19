import React from 'react';
import { Radio, ArrowRight, Wifi } from 'lucide-react';
import type { MulticastFlow } from '@shared/types';
import { PROTOCOL_VLAN_PRESETS } from '@shared/constants';

interface MulticastFlowCardProps {
  flow: MulticastFlow;
  switchNames: Record<string, string>;
  onClick?: (flow: MulticastFlow) => void;
  selected?: boolean;
}

export const MulticastFlowCard: React.FC<MulticastFlowCardProps> = ({
  flow,
  switchNames,
  onClick,
  selected = false,
}) => {
  const preset = PROTOCOL_VLAN_PRESETS.find((p) => p.protocol === flow.protocol);
  const protocolColor = preset?.color ?? '#6b7280';
  const protocolName = preset?.name ?? flow.protocol;

  const bwPercent = Math.min((flow.bandwidthMbps / 100) * 100, 100);
  const bwColor =
    flow.bandwidthMbps > 80 ? 'bg-red-500' : flow.bandwidthMbps > 50 ? 'bg-yellow-500' : 'bg-green-500';

  return (
    <div
      onClick={() => onClick?.(flow)}
      className={`
        bg-gray-800 border rounded-lg p-4 cursor-pointer transition-all duration-200 hover:border-gray-500
        ${selected ? 'ring-2 ring-blue-500 border-blue-500' : 'border-gray-700'}
      `}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold text-white"
            style={{ backgroundColor: protocolColor }}
          >
            <Radio className="w-3 h-3" />
            {protocolName}
          </span>
          {flow.label && (
            <span className="text-sm text-gray-300 font-medium">{flow.label}</span>
          )}
        </div>
        <span className="text-xs text-gray-500 font-mono">VLAN {flow.vlanId}</span>
      </div>

      {/* Group address */}
      <div className="flex items-center gap-2 mb-2">
        <Wifi className="w-4 h-4 text-gray-500" />
        <span className="text-sm font-mono text-gray-200">{flow.groupAddress}</span>
      </div>

      {/* Source -> Receivers */}
      <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
        <span className="text-gray-300 font-medium">
          {switchNames[flow.sourceSwitchId] ?? flow.sourceSwitchId}:{flow.sourcePort}
        </span>
        <ArrowRight className="w-3 h-3 text-gray-600" />
        <span>
          {flow.receivers.length} receiver{flow.receivers.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Bandwidth bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">Bandwidth</span>
          <span className="text-gray-300 font-mono">{flow.bandwidthMbps.toFixed(1)} Mbps</span>
        </div>
        <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${bwColor}`}
            style={{ width: `${bwPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default MulticastFlowCard;
