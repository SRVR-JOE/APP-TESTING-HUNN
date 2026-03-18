import React, { useRef, useEffect } from 'react';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  SkipForward,
  StopCircle,
  RotateCcw,
  ChevronDown,
} from 'lucide-react';

export interface BatchSwitchStatus {
  switchName: string;
  switchIp: string;
  status: 'waiting' | 'in-progress' | 'success' | 'failed' | 'skipped';
  progress: number;
  error?: string;
  currentOperation?: string;
}

export interface BatchProgressProps {
  switches: BatchSwitchStatus[];
  overallProgress: number;
  isRunning: boolean;
  onAbort: () => void;
  onRollback: () => void;
  log: string[];
}

const statusConfig: Record<
  string,
  { icon: React.ReactNode; color: string; bg: string; label: string }
> = {
  waiting: {
    icon: <Clock className="w-4 h-4" />,
    color: 'text-gray-400',
    bg: 'bg-gray-700/50',
    label: 'Waiting',
  },
  'in-progress': {
    icon: <Loader2 className="w-4 h-4 animate-spin" />,
    color: 'text-gc-accent',
    bg: 'bg-gc-accent/10',
    label: 'In Progress',
  },
  success: {
    icon: <CheckCircle2 className="w-4 h-4" />,
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    label: 'Success',
  },
  failed: {
    icon: <XCircle className="w-4 h-4" />,
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    label: 'Failed',
  },
  skipped: {
    icon: <SkipForward className="w-4 h-4" />,
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    label: 'Skipped',
  },
};

export const BatchProgress: React.FC<BatchProgressProps> = ({
  switches,
  overallProgress,
  isRunning,
  onAbort,
  onRollback,
  log,
}) => {
  const logEndRef = useRef<HTMLDivElement>(null);
  const [showLog, setShowLog] = React.useState(true);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log]);

  const successCount = switches.filter((s) => s.status === 'success').length;
  const failedCount = switches.filter((s) => s.status === 'failed').length;
  const completedCount = switches.filter(
    (s) => s.status === 'success' || s.status === 'failed' || s.status === 'skipped'
  ).length;
  const isComplete = !isRunning && completedCount === switches.length;
  const hasFailures = failedCount > 0;

  return (
    <div className="space-y-6">
      {/* Overall progress */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white">
              {isComplete ? 'Batch Operation Complete' : 'Batch Operation In Progress'}
            </h3>
            <p className="text-sm text-gray-400 mt-1">
              {completedCount} of {switches.length} switches processed
            </p>
          </div>

          <div className="flex items-center gap-3">
            {isRunning && (
              <button
                onClick={onAbort}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-red-600/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-600/30 transition-colors"
              >
                <StopCircle className="w-4 h-4" />
                Abort
              </button>
            )}
            {isComplete && hasFailures && (
              <button
                onClick={onRollback}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-yellow-600/20 text-yellow-400 border border-yellow-500/30 rounded-lg hover:bg-yellow-600/30 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Rollback Failed
              </button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="relative h-3 bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isComplete && !hasFailures
                ? 'bg-green-500'
                : isComplete && hasFailures
                  ? 'bg-yellow-500'
                  : 'bg-gc-accent'
            }`}
            style={{ width: `${overallProgress}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
          <span>{Math.round(overallProgress)}%</span>
          <div className="flex items-center gap-4">
            <span className="text-green-400">{successCount} succeeded</span>
            {failedCount > 0 && <span className="text-red-400">{failedCount} failed</span>}
          </div>
        </div>

        {/* Completion summary */}
        {isComplete && (
          <div
            className={`mt-4 p-4 rounded-lg border ${
              hasFailures
                ? 'bg-yellow-500/10 border-yellow-500/20'
                : 'bg-green-500/10 border-green-500/20'
            }`}
          >
            <p
              className={`text-sm font-medium ${hasFailures ? 'text-yellow-400' : 'text-green-400'}`}
            >
              {hasFailures
                ? `Completed with ${failedCount} failure${failedCount > 1 ? 's' : ''}`
                : 'All switches configured successfully!'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {successCount} successful, {failedCount} failed,{' '}
              {switches.filter((s) => s.status === 'skipped').length} skipped
            </p>
          </div>
        )}
      </div>

      {/* Per-switch status cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {switches.map((sw) => {
          const cfg = statusConfig[sw.status];
          return (
            <div
              key={sw.switchIp}
              className={`rounded-lg border border-gray-700 p-4 ${cfg.bg} transition-colors`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={cfg.color}>{cfg.icon}</span>
                  <span className="text-sm font-medium text-white">{sw.switchName}</span>
                </div>
                <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
              </div>
              <p className="font-mono text-xs text-gray-500 mb-2">{sw.switchIp}</p>

              {sw.status === 'in-progress' && (
                <>
                  <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden mb-1">
                    <div
                      className="h-full bg-gc-accent rounded-full transition-all duration-300"
                      style={{ width: `${sw.progress}%` }}
                    />
                  </div>
                  {sw.currentOperation && (
                    <p className="text-xs text-gc-accent mt-1">{sw.currentOperation}</p>
                  )}
                </>
              )}

              {sw.status === 'failed' && sw.error && (
                <p className="text-xs text-red-400 mt-1 bg-red-500/10 px-2 py-1 rounded">
                  {sw.error}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Live log */}
      <div className="bg-gray-800 rounded-xl border border-gray-700">
        <button
          onClick={() => setShowLog(!showLog)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-300 hover:bg-gray-700/50 transition-colors rounded-t-xl"
        >
          <span>Operation Log ({log.length} entries)</span>
          <ChevronDown
            className={`w-4 h-4 transition-transform ${showLog ? 'rotate-180' : ''}`}
          />
        </button>
        {showLog && (
          <div className="max-h-48 overflow-y-auto px-4 pb-3 font-mono text-xs text-gray-400 space-y-0.5">
            {log.map((entry, i) => (
              <div
                key={i}
                className={`${
                  entry.includes('[ERROR]')
                    ? 'text-red-400'
                    : entry.includes('[OK]')
                      ? 'text-green-400'
                      : entry.includes('[WARN]')
                        ? 'text-yellow-400'
                        : 'text-gray-400'
                }`}
              >
                {entry}
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        )}
      </div>
    </div>
  );
};

export default BatchProgress;
