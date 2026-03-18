// =============================================================================
// GigaCore Command — Real-time Ping Latency Chart
// =============================================================================

import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Area,
  AreaChart,
  ResponsiveContainer,
} from 'recharts';
import type { PingResult } from '../../main/troubleshoot/ping-tool';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PingChartProps {
  results: PingResult[];
  maxPoints?: number; // default 60
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ChartDataPoint {
  index: number;
  time: string;
  latency: number | null;
  color: string;
  alive: boolean;
}

function getLatencyColor(ms: number): string {
  if (ms < 0) return '#ef4444';   // red — timeout
  if (ms > 200) return '#ef4444'; // red
  if (ms > 50) return '#eab308';  // yellow
  return '#10b981';               // green
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Custom Tooltip
// ---------------------------------------------------------------------------

const CustomTooltip: React.FC<{
  active?: boolean;
  payload?: Array<{ payload: ChartDataPoint }>;
}> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0].payload;

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-xs shadow-xl">
      <p className="text-gray-400">{data.time}</p>
      {data.alive ? (
        <p className="mt-1 font-mono font-bold" style={{ color: data.color }}>
          {data.latency?.toFixed(2)} ms
        </p>
      ) : (
        <p className="mt-1 font-bold text-red-400">Timeout</p>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Custom Dot (red marker for timeouts)
// ---------------------------------------------------------------------------

const CustomDot: React.FC<{
  cx?: number;
  cy?: number;
  payload?: ChartDataPoint;
}> = ({ cx, cy, payload }) => {
  if (!payload || !cx) return null;

  if (!payload.alive) {
    // Red X marker for timeout
    return (
      <g>
        <circle cx={cx} cy={10} r={4} fill="#ef4444" opacity={0.8} />
        <line x1={cx - 2} y1={8} x2={cx + 2} y2={12} stroke="white" strokeWidth={1.5} />
        <line x1={cx + 2} y1={8} x2={cx - 2} y2={12} stroke="white" strokeWidth={1.5} />
      </g>
    );
  }

  return null; // No dot for normal points (line is enough)
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const PingChart: React.FC<PingChartProps> = ({ results, maxPoints = 60 }) => {
  const chartData = useMemo<ChartDataPoint[]>(() => {
    const sliced = results.slice(-maxPoints);
    return sliced.map((r, i) => ({
      index: i,
      time: formatTimestamp(r.timestamp),
      latency: r.alive ? r.latencyMs : null,
      color: getLatencyColor(r.alive ? r.latencyMs : -1),
      alive: r.alive,
    }));
  }, [results, maxPoints]);

  if (chartData.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-gray-700 bg-gray-800/50 text-sm text-gray-500">
        No ping data yet. Start a ping to see the chart.
      </div>
    );
  }

  const maxLatency = Math.max(
    ...chartData.filter((d) => d.latency != null).map((d) => d.latency!),
    100,
  );
  const yMax = Math.ceil(maxLatency / 50) * 50 + 50;

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.5} />

          <XAxis
            dataKey="time"
            tick={{ fill: '#6b7280', fontSize: 10 }}
            tickLine={{ stroke: '#4b5563' }}
            axisLine={{ stroke: '#4b5563' }}
            interval="preserveStartEnd"
          />

          <YAxis
            domain={[0, yMax]}
            tick={{ fill: '#6b7280', fontSize: 10 }}
            tickLine={{ stroke: '#4b5563' }}
            axisLine={{ stroke: '#4b5563' }}
            label={{
              value: 'ms',
              position: 'insideTopLeft',
              fill: '#6b7280',
              fontSize: 10,
              offset: 10,
            }}
          />

          <Tooltip content={<CustomTooltip />} />

          {/* Threshold lines */}
          <ReferenceLine
            y={50}
            stroke="#eab308"
            strokeDasharray="6 4"
            opacity={0.5}
            label={{ value: '50ms', fill: '#eab308', fontSize: 10, position: 'right' }}
          />
          <ReferenceLine
            y={200}
            stroke="#ef4444"
            strokeDasharray="6 4"
            opacity={0.5}
            label={{ value: '200ms', fill: '#ef4444', fontSize: 10, position: 'right' }}
          />

          {/* Main area + line */}
          <Area
            type="monotone"
            dataKey="latency"
            stroke="#10b981"
            strokeWidth={2}
            fill="url(#latencyGradient)"
            connectNulls={false}
            dot={<CustomDot />}
            activeDot={{ r: 3, fill: '#10b981', stroke: '#064e3b', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PingChart;
