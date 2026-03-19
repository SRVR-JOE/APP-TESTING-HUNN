import React from 'react';
import {
  MapPin,
  Clock,
  CheckCircle2,
  Circle,
  AlertCircle,
  XCircle,
  ChevronRight,
} from 'lucide-react';
import type { TourStop } from '@shared/types';

interface TourStopTimelineProps {
  stops: TourStop[];
  activeStopId: string | null;
  onSelectStop: (stopId: string) => void;
  orientation?: 'vertical' | 'horizontal';
}

const statusConfig: Record<
  TourStop['status'],
  { color: string; bgColor: string; borderColor: string; icon: React.ElementType; label: string }
> = {
  upcoming: {
    color: 'text-gc-blue',
    bgColor: 'bg-gc-blue/20',
    borderColor: 'border-gc-blue/40',
    icon: Circle,
    label: 'Upcoming',
  },
  'in-progress': {
    color: 'text-amber-400',
    bgColor: 'bg-amber-400/20',
    borderColor: 'border-amber-400/40',
    icon: AlertCircle,
    label: 'In Progress',
  },
  completed: {
    color: 'text-green-400',
    bgColor: 'bg-green-400/20',
    borderColor: 'border-green-400/40',
    icon: CheckCircle2,
    label: 'Completed',
  },
  cancelled: {
    color: 'text-red-400',
    bgColor: 'bg-red-400/20',
    borderColor: 'border-red-400/40',
    icon: XCircle,
    label: 'Cancelled',
  },
};

function formatStopDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatStopDateLong(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

export const TourStopTimeline: React.FC<TourStopTimelineProps> = ({
  stops,
  activeStopId,
  onSelectStop,
  orientation = 'vertical',
}) => {
  const sortedStops = [...stops].sort((a, b) => a.date.localeCompare(b.date));

  if (orientation === 'horizontal') {
    return (
      <div className="flex items-start gap-1 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-700">
        {sortedStops.map((stop, idx) => {
          const config = statusConfig[stop.status];
          const StatusIcon = config.icon;
          const isActive = stop.id === activeStopId;

          return (
            <React.Fragment key={stop.id}>
              <button
                onClick={() => onSelectStop(stop.id)}
                className={`shrink-0 rounded-lg border p-3 min-w-[140px] text-left transition-all duration-150 ${
                  isActive
                    ? `${config.bgColor} ${config.borderColor} ring-1 ring-current ${config.color}`
                    : 'bg-gc-panel border-gray-700/50 hover:border-gray-600'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <StatusIcon className={`w-3.5 h-3.5 ${config.color}`} />
                  <span className={`text-[10px] font-medium uppercase tracking-wider ${config.color}`}>
                    {config.label}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mb-1">{formatStopDate(stop.date)}</p>
                <p className="text-sm text-white font-medium truncate">{stop.venueName}</p>
              </button>
              {idx < sortedStops.length - 1 && (
                <ChevronRight className="w-4 h-4 text-gray-600 shrink-0 mt-6" />
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  }

  // Vertical timeline (default)
  return (
    <div className="space-y-0">
      {sortedStops.map((stop, idx) => {
        const config = statusConfig[stop.status];
        const StatusIcon = config.icon;
        const isActive = stop.id === activeStopId;
        const isLast = idx === sortedStops.length - 1;

        return (
          <div key={stop.id} className="flex gap-3">
            {/* Timeline spine */}
            <div className="flex flex-col items-center shrink-0">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                  isActive
                    ? `${config.bgColor} ${config.borderColor}`
                    : 'bg-gc-dark border-gray-700'
                }`}
              >
                <StatusIcon className={`w-4 h-4 ${config.color}`} />
              </div>
              {!isLast && <div className="w-0.5 flex-1 min-h-[24px] bg-gray-700/50" />}
            </div>

            {/* Content card */}
            <button
              onClick={() => onSelectStop(stop.id)}
              className={`flex-1 text-left rounded-lg border p-3 mb-2 transition-all duration-150 ${
                isActive
                  ? `bg-gc-blue/5 border-gc-blue/40 ring-1 ring-gc-blue/30`
                  : 'bg-gc-panel border-gray-700/50 hover:border-gray-600'
              }`}
            >
              <div className="flex items-start justify-between mb-1">
                <div>
                  <p className="text-white font-medium text-sm">{stop.venueName}</p>
                  <p className="text-xs text-gray-400">{formatStopDateLong(stop.date)}</p>
                </div>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider border ${config.bgColor} ${config.borderColor} ${config.color}`}
                >
                  {config.label}
                </span>
              </div>

              {/* Times row */}
              <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                {stop.loadInTime && (
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>Load-in {stop.loadInTime}</span>
                  </div>
                )}
                {stop.showTime && (
                  <div className="flex items-center gap-1">
                    <span>Show {stop.showTime}</span>
                  </div>
                )}
                {stop.loadOutTime && (
                  <div className="flex items-center gap-1">
                    <span>Load-out {stop.loadOutTime}</span>
                  </div>
                )}
              </div>

              {/* Show file indicator */}
              {stop.showFileId && (
                <div className="mt-2">
                  <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] bg-gc-accent/10 text-gc-accent rounded border border-gc-accent/20">
                    Show file linked
                  </span>
                </div>
              )}
            </button>
          </div>
        );
      })}

      {sortedStops.length === 0 && (
        <div className="text-center py-8 text-gray-500 text-sm">
          No stops scheduled for this tour.
        </div>
      )}
    </div>
  );
};

export default TourStopTimeline;
