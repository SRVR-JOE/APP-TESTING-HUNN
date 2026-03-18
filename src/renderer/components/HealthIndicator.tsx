import React from 'react';
import type { HealthStatus } from '../types';

interface HealthIndicatorProps {
  status: HealthStatus;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  pulse?: boolean;
}

const statusConfig: Record<
  HealthStatus,
  { color: string; bg: string; ring: string; label: string }
> = {
  healthy: {
    color: 'bg-green-500',
    bg: 'bg-green-500/20',
    ring: 'ring-green-500/40',
    label: 'Healthy',
  },
  warning: {
    color: 'bg-yellow-500',
    bg: 'bg-yellow-500/20',
    ring: 'ring-yellow-500/40',
    label: 'Warning',
  },
  critical: {
    color: 'bg-red-500',
    bg: 'bg-red-500/20',
    ring: 'ring-red-500/40',
    label: 'Critical',
  },
  offline: {
    color: 'bg-gray-500',
    bg: 'bg-gray-500/20',
    ring: 'ring-gray-500/40',
    label: 'Offline',
  },
};

const sizeClasses: Record<string, { dot: string; text: string }> = {
  sm: { dot: 'w-2 h-2', text: 'text-xs' },
  md: { dot: 'w-3 h-3', text: 'text-sm' },
  lg: { dot: 'w-4 h-4', text: 'text-base' },
};

export const HealthIndicator: React.FC<HealthIndicatorProps> = ({
  status,
  size = 'md',
  showLabel = false,
  pulse = false,
}) => {
  const config = statusConfig[status];
  const sizeClass = sizeClasses[size];
  const shouldPulse = pulse && status === 'critical';

  return (
    <div className="inline-flex items-center gap-1.5 group relative">
      <span className="relative flex">
        {shouldPulse && (
          <span
            className={`absolute inline-flex h-full w-full rounded-full ${config.color} opacity-75 animate-ping`}
          />
        )}
        <span
          className={`relative inline-flex rounded-full ${sizeClass.dot} ${config.color}`}
        />
      </span>

      {showLabel && (
        <span className={`${sizeClass.text} text-gray-300`}>
          {config.label}
        </span>
      )}

      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded bg-gray-900 border border-gray-700 text-xs text-gray-300 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
        Status: {config.label}
      </div>
    </div>
  );
};

export default HealthIndicator;
