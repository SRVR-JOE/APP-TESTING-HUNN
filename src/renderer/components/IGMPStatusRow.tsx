import React from 'react';
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

export interface IGMPStatusRowProps {
  switchName: string;
  switchIp: string;
  vlanId: number;
  vlanName: string;
  snoopingEnabled: boolean;
  querierEnabled: boolean;
  querierIp?: string;
  queryInterval: number;
  mRouterPorts: number[];
  onToggleSnooping: () => void;
  onToggleQuerier: () => void;
  status: 'ok' | 'warning' | 'error';
}

const statusConfig = {
  ok: {
    icon: CheckCircle,
    color: 'text-green-400',
    bg: 'bg-green-400/10',
    border: 'border-green-400/20',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-yellow-400',
    bg: 'bg-yellow-400/10',
    border: 'border-yellow-400/20',
  },
  error: {
    icon: XCircle,
    color: 'text-red-400',
    bg: 'bg-red-400/10',
    border: 'border-red-400/20',
  },
};

export default function IGMPStatusRow({
  switchName,
  switchIp,
  vlanId,
  vlanName,
  snoopingEnabled,
  querierEnabled,
  querierIp,
  queryInterval,
  mRouterPorts,
  onToggleSnooping,
  onToggleQuerier,
  status,
}: IGMPStatusRowProps) {
  const cfg = statusConfig[status];
  const StatusIcon = cfg.icon;

  return (
    <tr className={`border-b border-gray-700/50 hover:bg-gray-800/30 transition-colors ${cfg.bg}`}>
      {/* Status indicator */}
      <td className="px-3 py-2.5">
        <StatusIcon size={16} className={cfg.color} />
      </td>

      {/* Switch Name */}
      <td className="px-3 py-2.5">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-gray-200">{switchName}</span>
          <span className="text-xs text-gray-500">{switchIp}</span>
        </div>
      </td>

      {/* VLAN */}
      <td className="px-3 py-2.5">
        <span className="text-sm text-gray-300">
          {vlanId}{' '}
          <span className="text-gray-500">({vlanName})</span>
        </span>
      </td>

      {/* IGMP Snooping Toggle */}
      <td className="px-3 py-2.5">
        <button
          onClick={onToggleSnooping}
          className={`
            relative inline-flex h-5 w-9 items-center rounded-full transition-colors
            ${snoopingEnabled ? 'bg-gc-accent' : 'bg-gray-600'}
          `}
        >
          <span
            className={`
              inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform
              ${snoopingEnabled ? 'translate-x-[18px]' : 'translate-x-[3px]'}
            `}
          />
        </button>
      </td>

      {/* Querier Toggle */}
      <td className="px-3 py-2.5">
        <button
          onClick={onToggleQuerier}
          className={`
            relative inline-flex h-5 w-9 items-center rounded-full transition-colors
            ${querierEnabled ? 'bg-gc-accent' : 'bg-gray-600'}
          `}
        >
          <span
            className={`
              inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform
              ${querierEnabled ? 'translate-x-[18px]' : 'translate-x-[3px]'}
            `}
          />
        </button>
      </td>

      {/* Querier IP */}
      <td className="px-3 py-2.5">
        <span className="text-sm text-gray-400 font-mono">
          {querierIp ?? '--'}
        </span>
      </td>

      {/* Query Interval */}
      <td className="px-3 py-2.5">
        <span className="text-sm text-gray-400">{queryInterval}s</span>
      </td>

      {/* MRouter Ports */}
      <td className="px-3 py-2.5">
        <div className="flex gap-1 flex-wrap">
          {mRouterPorts.length > 0 ? (
            mRouterPorts.map((port) => (
              <span
                key={port}
                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-gray-700 text-gray-300"
              >
                P{port}
              </span>
            ))
          ) : (
            <span className="text-xs text-gray-600">None</span>
          )}
        </div>
      </td>
    </tr>
  );
}
