// =============================================================================
// GigaCore Command — Health Check Card Component
// =============================================================================

import React from 'react';
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  AlertOctagon,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from 'lucide-react';
import type { HealthCheckResult, HealthStatus } from '../../main/troubleshoot/health-checks';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface HealthCheckCardProps {
  result: HealthCheckResult;
  isExpanded: boolean;
  onToggle: () => void;
  onRerun: () => void;
}

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  HealthStatus,
  {
    icon: React.FC<{ className?: string }>;
    borderColor: string;
    bgColor: string;
    textColor: string;
    label: string;
  }
> = {
  pass: {
    icon: CheckCircle,
    borderColor: 'border-l-emerald-500',
    bgColor: 'bg-emerald-500/10',
    textColor: 'text-emerald-400',
    label: 'Pass',
  },
  warning: {
    icon: AlertTriangle,
    borderColor: 'border-l-yellow-500',
    bgColor: 'bg-yellow-500/10',
    textColor: 'text-yellow-400',
    label: 'Warning',
  },
  fail: {
    icon: XCircle,
    borderColor: 'border-l-orange-500',
    bgColor: 'bg-orange-500/10',
    textColor: 'text-orange-400',
    label: 'Fail',
  },
  critical: {
    icon: AlertOctagon,
    borderColor: 'border-l-red-500',
    bgColor: 'bg-red-500/10',
    textColor: 'text-red-400',
    label: 'Critical',
  },
};

function statusBadge(status: HealthStatus): React.ReactNode {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cfg.bgColor} ${cfg.textColor}`}
    >
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const HealthCheckCard: React.FC<HealthCheckCardProps> = ({
  result,
  isExpanded,
  onToggle,
  onRerun,
}) => {
  const cfg = STATUS_CONFIG[result.status];
  const Icon = cfg.icon;
  const isCritical = result.status === 'critical';

  return (
    <div
      className={`
        relative overflow-hidden rounded-lg border-l-4 bg-gray-800/80 backdrop-blur
        ${cfg.borderColor}
        ${isCritical ? 'animate-critical-pulse shadow-lg shadow-red-500/20' : 'shadow-md'}
        transition-all duration-200 hover:bg-gray-800
      `}
    >
      {/* Card header */}
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-3">
          <Icon
            className={`h-5 w-5 flex-shrink-0 ${cfg.textColor} ${
              isCritical ? 'animate-pulse' : ''
            }`}
          />
          <div>
            <h3 className="text-sm font-bold text-gray-100">{result.displayName}</h3>
            <p className="mt-0.5 text-xs text-gray-400">{result.message}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500">{formatTime(result.runAt)}</span>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-500" />
          )}
        </div>
      </button>

      {/* Re-run button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRerun();
        }}
        className="absolute right-10 top-4 rounded p-1 text-gray-500 hover:bg-gray-700 hover:text-gray-300"
        title="Re-run this check"
      >
        <RefreshCw className="h-3.5 w-3.5" />
      </button>

      {/* Expanded detail table */}
      {isExpanded && result.details.length > 0 && (
        <div className="border-t border-gray-700/50 px-4 pb-4 pt-2">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500">
                <th className="pb-1 text-left font-medium">Switch / Item</th>
                <th className="pb-1 text-left font-medium">Value</th>
                <th className="pb-1 text-left font-medium">Threshold</th>
                <th className="pb-1 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/30">
              {result.details.map((detail, idx) => {
                const detailCfg = STATUS_CONFIG[detail.status];
                return (
                  <tr key={idx} className="text-gray-300">
                    <td className="py-1.5 pr-2">
                      {detail.switchName && (
                        <span className="font-medium text-gray-200">{detail.switchName}</span>
                      )}
                      {detail.switchIp && (
                        <span className="ml-1 text-gray-500">({detail.switchIp})</span>
                      )}
                      {detail.port != null && (
                        <span className="ml-1 text-gray-500">port {detail.port}</span>
                      )}
                      {!detail.switchName && !detail.switchIp && (
                        <span className="text-gray-400">{detail.message}</span>
                      )}
                    </td>
                    <td className="py-1.5 pr-2 font-mono text-gray-200">
                      {detail.value ?? '-'}
                    </td>
                    <td className="py-1.5 pr-2 text-gray-500">{detail.threshold ?? '-'}</td>
                    <td className="py-1.5">{statusBadge(detail.status)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default HealthCheckCard;
