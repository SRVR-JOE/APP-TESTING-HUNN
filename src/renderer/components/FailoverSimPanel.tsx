import React from 'react';
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  ArrowRight,
  Clock,
  Zap,
  Radio,
} from 'lucide-react';
import type { FailoverSimResult } from '@shared/types';

interface FailoverSimPanelProps {
  result: FailoverSimResult;
  switchNames: Record<string, string>;
  flowLabels?: Record<string, string>;
}

const STATUS_CONFIG: Record<
  FailoverSimResult['status'],
  { label: string; color: string; bg: string; border: string; Icon: React.ComponentType<any> }
> = {
  recovered: {
    label: 'Fully Recovered',
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    Icon: CheckCircle,
  },
  partial: {
    label: 'Partial Recovery',
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    Icon: AlertTriangle,
  },
  isolated: {
    label: 'Node Isolated',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    Icon: XCircle,
  },
};

export const FailoverSimPanel: React.FC<FailoverSimPanelProps> = ({
  result,
  switchNames,
  flowLabels = {},
}) => {
  const statusCfg = STATUS_CONFIG[result.status];
  const StatusIcon = statusCfg.Icon;

  const getName = (id: string) => switchNames[id] ?? id;

  return (
    <div className={`rounded-lg border ${statusCfg.border} ${statusCfg.bg} p-4 space-y-4`}>
      {/* Status badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusIcon className={`w-5 h-5 ${statusCfg.color}`} />
          <span className={`text-sm font-semibold ${statusCfg.color}`}>
            {statusCfg.label}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <Clock className="w-3.5 h-3.5" />
          <span className="font-mono">{result.convergenceTimeMs} ms</span>
        </div>
      </div>

      {/* Broken link */}
      <div className="bg-gray-800/60 rounded-md p-3">
        <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1.5">
          <Zap className="w-3.5 h-3.5 text-red-400" />
          <span className="font-medium text-gray-400">Broken Link</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-200 font-medium">
            {getName(result.brokenLink.switchA)}
          </span>
          <span className="text-gray-500 text-xs font-mono">P{result.brokenLink.portA}</span>
          <span className="text-red-400 font-bold">---X---</span>
          <span className="text-gray-500 text-xs font-mono">P{result.brokenLink.portB}</span>
          <span className="text-gray-200 font-medium">
            {getName(result.brokenLink.switchB)}
          </span>
        </div>
      </div>

      {/* New path */}
      <div className="bg-gray-800/60 rounded-md p-3">
        <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-2">
          <ArrowRight className="w-3.5 h-3.5 text-green-400" />
          <span className="font-medium text-gray-400">New Path</span>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {result.newPath.map((step, i) => (
            <React.Fragment key={i}>
              <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-700 text-xs text-gray-200 font-medium">
                {getName(step)}
              </span>
              {i < result.newPath.length - 1 && (
                <ArrowRight className="w-3 h-3 text-gray-600 flex-shrink-0" />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Affected flows */}
      {result.affectedFlows.length > 0 && (
        <div className="bg-gray-800/60 rounded-md p-3">
          <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-2">
            <Radio className="w-3.5 h-3.5 text-yellow-400" />
            <span className="font-medium text-gray-400">
              Affected Flows ({result.affectedFlows.length})
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {result.affectedFlows.map((flowId) => (
              <span
                key={flowId}
                className="inline-flex items-center px-2 py-0.5 rounded bg-yellow-500/10 border border-yellow-500/20 text-xs text-yellow-300"
              >
                {flowLabels[flowId] ?? flowId}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Convergence time visual */}
      <div className="pt-1">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-gray-500">Convergence Time</span>
          <span
            className={`font-mono ${
              result.convergenceTimeMs < 50
                ? 'text-green-400'
                : result.convergenceTimeMs < 200
                  ? 'text-yellow-400'
                  : 'text-red-400'
            }`}
          >
            {result.convergenceTimeMs} ms
          </span>
        </div>
        <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              result.convergenceTimeMs < 50
                ? 'bg-green-500'
                : result.convergenceTimeMs < 200
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
            }`}
            style={{
              width: `${Math.min((result.convergenceTimeMs / 500) * 100, 100)}%`,
            }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-gray-600 mt-0.5">
          <span>0ms</span>
          <span>50ms</span>
          <span>200ms</span>
          <span>500ms</span>
        </div>
      </div>
    </div>
  );
};

export default FailoverSimPanel;
