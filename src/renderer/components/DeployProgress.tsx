import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  Shield,
  AlertTriangle,
  RotateCcw,
  SkipForward,
  StopCircle,
  Undo2,
} from 'lucide-react';

export interface DeploySwitchProgress {
  switchName: string;
  switchIp: string;
  status: 'waiting' | 'deploying' | 'verifying' | 'success' | 'failed';
  currentStep?: string;
  progress: number;
  error?: string;
}

interface DeployProgressProps {
  switches: DeploySwitchProgress[];
  overallProgress: number;
  isDeploying: boolean;
  onRetry: (switchName: string) => void;
  onSkip: (switchName: string) => void;
  onAbort: () => void;
  onRollback: () => void;
}

const statusConfig: Record<
  DeploySwitchProgress['status'],
  { icon: React.ReactNode; color: string; label: string }
> = {
  waiting: {
    icon: <Clock size={18} />,
    color: 'text-gray-400',
    label: 'Waiting',
  },
  deploying: {
    icon: <Loader2 size={18} className="animate-spin" />,
    color: 'text-blue-400',
    label: 'Deploying',
  },
  verifying: {
    icon: <Shield size={18} className="animate-pulse" />,
    color: 'text-cyan-400',
    label: 'Verifying',
  },
  success: {
    icon: <CheckCircle2 size={18} />,
    color: 'text-green-400',
    label: 'Success',
  },
  failed: {
    icon: <XCircle size={18} />,
    color: 'text-red-400',
    label: 'Failed',
  },
};

const progressBarColor: Record<DeploySwitchProgress['status'], string> = {
  waiting: 'bg-gray-600',
  deploying: 'bg-blue-500',
  verifying: 'bg-cyan-500',
  success: 'bg-green-500',
  failed: 'bg-red-500',
};

export const DeployProgress: React.FC<DeployProgressProps> = ({
  switches,
  overallProgress,
  isDeploying,
  onRetry,
  onSkip,
  onAbort,
  onRollback,
}) => {
  const [showAbortConfirm, setShowAbortConfirm] = useState(false);
  const hasFailed = switches.some((s) => s.status === 'failed');
  const allSuccess = switches.every((s) => s.status === 'success');
  const successCount = switches.filter((s) => s.status === 'success').length;
  const failedCount = switches.filter((s) => s.status === 'failed').length;

  return (
    <div className="space-y-6">
      {/* Overall progress */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-300">
            Overall Progress
          </span>
          <span className="text-sm text-gray-400">
            {successCount}/{switches.length} switches
            {failedCount > 0 && (
              <span className="text-red-400 ml-2">({failedCount} failed)</span>
            )}
          </span>
        </div>
        <div className="w-full h-3 bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              allSuccess
                ? 'bg-green-500'
                : hasFailed
                  ? 'bg-red-500'
                  : 'bg-blue-500'
            }`}
            style={{ width: `${overallProgress}%` }}
          />
        </div>
        {allSuccess && (
          <div className="mt-3 flex items-center gap-2 text-green-400">
            <CheckCircle2 size={18} />
            <span className="text-sm font-medium">
              All changes deployed successfully
            </span>
          </div>
        )}
      </div>

      {/* Switch cards */}
      <div className="space-y-3">
        {switches.map((sw) => {
          const config = statusConfig[sw.status];
          return (
            <div
              key={sw.switchName}
              className={`bg-gray-800 border rounded-lg p-4 transition-colors ${
                sw.status === 'failed'
                  ? 'border-red-500/40'
                  : sw.status === 'deploying' || sw.status === 'verifying'
                    ? 'border-blue-500/30'
                    : sw.status === 'success'
                      ? 'border-green-500/20'
                      : 'border-gray-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={config.color}>{config.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium text-sm">
                      {sw.switchName}
                    </span>
                    <span className="text-gray-500 text-xs font-mono">
                      {sw.switchIp}
                    </span>
                  </div>
                  {sw.currentStep && sw.status !== 'success' && sw.status !== 'failed' && (
                    <p className="text-xs text-gray-400 mt-0.5">{sw.currentStep}</p>
                  )}
                </div>
                <span className={`text-xs font-medium ${config.color}`}>
                  {config.label}
                </span>
              </div>

              {/* Progress bar for active states */}
              {(sw.status === 'deploying' || sw.status === 'verifying') && (
                <div className="mt-3 w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${progressBarColor[sw.status]}`}
                    style={{ width: `${sw.progress}%` }}
                  />
                </div>
              )}

              {/* Success bar (full) */}
              {sw.status === 'success' && (
                <div className="mt-3 w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full w-full rounded-full bg-green-500" />
                </div>
              )}

              {/* Error + actions */}
              {sw.status === 'failed' && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded px-3 py-2">
                    <AlertTriangle size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-red-300">{sw.error || 'Unknown error'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-500/15 text-blue-400 border border-blue-500/30 rounded hover:bg-blue-500/25 transition-colors"
                      onClick={() => onRetry(sw.switchName)}
                    >
                      <RotateCcw size={12} />
                      Retry
                    </button>
                    <button
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gray-700 text-gray-300 border border-gray-600 rounded hover:bg-gray-600 transition-colors"
                      onClick={() => onSkip(sw.switchName)}
                    >
                      <SkipForward size={12} />
                      Skip
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Action buttons */}
      {isDeploying && (
        <div className="flex items-center gap-3">
          {!showAbortConfirm ? (
            <button
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-red-500/15 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/25 transition-colors"
              onClick={() => setShowAbortConfirm(true)}
            >
              <StopCircle size={16} />
              Abort Deployment
            </button>
          ) : (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2">
              <span className="text-sm text-red-300">Abort all remaining deployments?</span>
              <button
                className="px-3 py-1 text-xs font-medium bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                onClick={() => {
                  onAbort();
                  setShowAbortConfirm(false);
                }}
              >
                Yes, Abort
              </button>
              <button
                className="px-3 py-1 text-xs font-medium bg-gray-700 text-gray-300 rounded hover:bg-gray-600 transition-colors"
                onClick={() => setShowAbortConfirm(false)}
              >
                Cancel
              </button>
            </div>
          )}

          {hasFailed && (
            <button
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 rounded-lg hover:bg-yellow-500/25 transition-colors"
              onClick={onRollback}
            >
              <Undo2 size={16} />
              Rollback Changes
            </button>
          )}
        </div>
      )}

      {/* Post-failure rollback */}
      {!isDeploying && hasFailed && (
        <div className="flex items-center gap-3">
          <button
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 rounded-lg hover:bg-yellow-500/25 transition-colors"
            onClick={onRollback}
          >
            <Undo2 size={16} />
            Rollback All Changes
          </button>
        </div>
      )}
    </div>
  );
};

export default DeployProgress;
