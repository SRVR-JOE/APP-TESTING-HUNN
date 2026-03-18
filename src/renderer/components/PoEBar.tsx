import React from 'react';
import { Zap } from 'lucide-react';

interface PoEBarProps {
  drawWatts: number;
  budgetWatts: number;
  compact?: boolean;
  showLabel?: boolean;
}

function getBarColor(pct: number): string {
  if (pct > 95) return 'bg-red-500';
  if (pct > 85) return 'bg-orange-500';
  if (pct > 70) return 'bg-yellow-500';
  return 'bg-green-500';
}

function getBarGradient(pct: number): string {
  if (pct > 95) return 'from-yellow-500 via-orange-500 to-red-500';
  if (pct > 85) return 'from-green-500 via-yellow-500 to-orange-500';
  if (pct > 70) return 'from-green-500 via-green-400 to-yellow-500';
  return 'from-green-600 to-green-400';
}

export const PoEBar: React.FC<PoEBarProps> = ({
  drawWatts,
  budgetWatts,
  compact = false,
  showLabel = true,
}) => {
  const pct = budgetWatts > 0 ? Math.round((drawWatts / budgetWatts) * 100) : 0;
  const clampedPct = Math.min(pct, 100);

  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        <Zap className="w-3 h-3 text-yellow-500 flex-shrink-0" />
        <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${getBarGradient(pct)} transition-all duration-500`}
            style={{ width: `${clampedPct}%` }}
          />
        </div>
        <span className="text-xs text-gray-500 tabular-nums w-8 text-right">
          {pct}%
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Zap className="w-4 h-4 text-yellow-500" />
          {showLabel && (
            <span className="text-sm text-gray-300">PoE Power</span>
          )}
        </div>
        <span className="text-sm font-mono text-gray-400">
          {drawWatts}W / {budgetWatts}W{' '}
          <span className={`font-semibold ${pct > 85 ? 'text-red-400' : 'text-gray-300'}`}>
            ({pct}%)
          </span>
        </span>
      </div>
      <div className="h-2.5 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${getBarGradient(pct)} transition-all duration-500`}
          style={{ width: `${clampedPct}%` }}
        />
      </div>
    </div>
  );
};

export default PoEBar;
