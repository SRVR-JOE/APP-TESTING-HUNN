import React, { useState } from 'react';
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  Zap,
  Minus,
  Loader2,
  ChevronDown,
  ChevronUp,
  Play,
} from 'lucide-react';

export type CheckStatus = 'pass' | 'warning' | 'fail' | 'critical' | 'not_run' | 'running';

export interface CheckDetail {
  switchName: string;
  status: string;
  message: string;
  value?: string;
}

export interface HealthCheckCardProps {
  name: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  status: CheckStatus;
  summary: string;
  details?: CheckDetail[];
  lastRun?: string;
  onRun: () => void;
}

const statusConfig: Record<
  CheckStatus,
  { border: string; badge: string; badgeBg: string; label: string; Icon: React.ComponentType<{ size?: number; className?: string }> }
> = {
  pass: {
    border: 'border-l-green-500',
    badge: 'text-green-400',
    badgeBg: 'bg-green-500/10',
    label: 'Pass',
    Icon: CheckCircle,
  },
  warning: {
    border: 'border-l-yellow-500',
    badge: 'text-yellow-400',
    badgeBg: 'bg-yellow-500/10',
    label: 'Warning',
    Icon: AlertTriangle,
  },
  fail: {
    border: 'border-l-red-500',
    badge: 'text-red-400',
    badgeBg: 'bg-red-500/10',
    label: 'Fail',
    Icon: XCircle,
  },
  critical: {
    border: 'border-l-red-600',
    badge: 'text-red-500',
    badgeBg: 'bg-red-600/10',
    label: 'Critical',
    Icon: Zap,
  },
  not_run: {
    border: 'border-l-gray-500',
    badge: 'text-gray-400',
    badgeBg: 'bg-gray-500/10',
    label: 'Not Run',
    Icon: Minus,
  },
  running: {
    border: 'border-l-blue-500',
    badge: 'text-blue-400',
    badgeBg: 'bg-blue-500/10',
    label: 'Running',
    Icon: Loader2,
  },
};

const detailStatusColor = (status: string) => {
  switch (status) {
    case 'pass': return 'text-green-400';
    case 'warning': return 'text-yellow-400';
    case 'fail': return 'text-red-400';
    case 'critical': return 'text-red-500';
    default: return 'text-gray-400';
  }
};

export const HealthCheckCard: React.FC<HealthCheckCardProps> = ({
  name,
  icon: CardIcon,
  status,
  summary,
  details,
  lastRun,
  onRun,
}) => {
  const [expanded, setExpanded] = useState(false);
  const config = statusConfig[status];
  const StatusIcon = config.Icon;

  return (
    <div
      className={`bg-gray-800 rounded-lg border-l-4 ${config.border} border border-gray-700 overflow-hidden`}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <CardIcon size={18} className="text-gc-accent" />
            <h4 className="text-sm font-semibold text-gray-100">{name}</h4>
          </div>
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.badgeBg} ${config.badge}`}>
            {status === 'running' ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <StatusIcon size={12} />
            )}
            {config.label}
          </div>
        </div>

        {/* Summary */}
        <p className="text-xs text-gray-400 mb-3 line-clamp-2">{summary}</p>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {details && details.length > 0 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1 text-xs text-gc-accent hover:text-gc-accent/80 transition-colors"
              >
                {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                Details ({details.length})
              </button>
            )}
            {lastRun && (
              <span className="text-xs text-gray-500">{lastRun}</span>
            )}
          </div>
          <button
            onClick={onRun}
            disabled={status === 'running'}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded text-gray-300 transition-colors"
          >
            {status === 'running' ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Play size={12} />
            )}
            Run
          </button>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && details && details.length > 0 && (
        <div className="border-t border-gray-700 bg-gray-850 px-4 py-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500">
                <th className="text-left pb-1 font-medium">Switch</th>
                <th className="text-left pb-1 font-medium">Status</th>
                <th className="text-left pb-1 font-medium">Message</th>
                <th className="text-right pb-1 font-medium">Value</th>
              </tr>
            </thead>
            <tbody>
              {details.map((d, i) => (
                <tr key={i} className="border-t border-gray-700/50">
                  <td className="py-1 text-gray-300">{d.switchName}</td>
                  <td className={`py-1 capitalize ${detailStatusColor(d.status)}`}>{d.status}</td>
                  <td className="py-1 text-gray-400">{d.message}</td>
                  <td className="py-1 text-right text-gray-300">{d.value ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default HealthCheckCard;
