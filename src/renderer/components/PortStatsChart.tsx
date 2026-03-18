import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import type { PortStats } from '../types/index';

// ─── Props ──────────────────────────────────────────────────────────────────
export interface PortStatsChartProps {
  data: PortStats[];
  metric: 'throughput' | 'errors' | 'poe' | 'packets';
  height?: number;
  poeBudget?: number;
}

// ─── Byte formatting ────────────────────────────────────────────────────────
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
  const idx = Math.min(i, units.length - 1);
  return `${(bytes / Math.pow(k, idx)).toFixed(1)} ${units[idx]}`;
}

function formatPackets(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatTime(ts: string): string {
  const d = new Date(ts);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

// ─── Dark-theme chart styles ────────────────────────────────────────────────
const GRID_STROKE = '#374151'; // gray-700
const AXIS_TICK = { fill: '#9CA3AF', fontSize: 11 };
const TOOLTIP_STYLE = {
  backgroundColor: '#1F2937',
  border: '1px solid #4B5563',
  borderRadius: 8,
  color: '#E5E7EB',
  fontSize: 12,
};

// ─── Component ──────────────────────────────────────────────────────────────
export default function PortStatsChart({
  data,
  metric,
  height = 280,
  poeBudget,
}: PortStatsChartProps) {
  // Prepare chart data from raw PortStats
  const chartData = useMemo(() => {
    return data.map((s) => ({
      time: formatTime(s.timestamp),
      fullTime: s.timestamp,
      txBytes: s.txBytes,
      rxBytes: s.rxBytes,
      txPackets: s.txPackets,
      rxPackets: s.rxPackets,
      rxErrors: s.rxErrors,
      txErrors: s.txErrors,
      poeWatts: s.poeWatts ?? 0,
      port: s.port,
    }));
  }, [data]);

  if (chartData.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-gray-500 text-sm"
        style={{ height }}
      >
        No data available for the selected range.
      </div>
    );
  }

  // ── Throughput chart ────────────────────────────────────────────────────
  if (metric === 'throughput') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
          <XAxis dataKey="time" tick={AXIS_TICK} />
          <YAxis
            yAxisId="left"
            tick={AXIS_TICK}
            tickFormatter={formatBytes}
            width={70}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={AXIS_TICK}
            tickFormatter={formatBytes}
            width={70}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value: number, name: string) => [
              formatBytes(value),
              name === 'txBytes' ? 'TX' : 'RX',
            ]}
            labelFormatter={(label: string) => `Time: ${label}`}
          />
          <Legend
            formatter={(value: string) =>
              value === 'txBytes' ? 'TX Bytes' : 'RX Bytes'
            }
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="txBytes"
            stroke="#3B82F6"
            strokeWidth={2}
            dot={false}
            name="txBytes"
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="rxBytes"
            stroke="#10B981"
            strokeWidth={2}
            dot={false}
            name="rxBytes"
          />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  // ── Error rate chart ──────────────────────────────────────────────────
  if (metric === 'errors') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
          <XAxis dataKey="time" tick={AXIS_TICK} />
          <YAxis tick={AXIS_TICK} width={50} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value: number, name: string) => [
              value,
              name === 'rxErrors' ? 'RX Errors' : 'TX Errors',
            ]}
          />
          <Legend
            formatter={(value: string) =>
              value === 'rxErrors' ? 'RX Errors' : 'TX Errors'
            }
          />
          <Bar dataKey="rxErrors" fill="#EF4444" name="rxErrors" />
          <Bar dataKey="txErrors" fill="#F59E0B" name="txErrors" />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  // ── PoE draw chart ────────────────────────────────────────────────────
  if (metric === 'poe') {
    const budget = poeBudget ?? 60;
    return (
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
          <XAxis dataKey="time" tick={AXIS_TICK} />
          <YAxis
            tick={AXIS_TICK}
            width={50}
            tickFormatter={(v: number) => `${v}W`}
            domain={[0, Math.ceil(budget * 1.15)]}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value: number) => [`${value.toFixed(1)} W`, 'PoE Draw']}
          />
          <Legend formatter={() => 'PoE Draw (W)'} />
          <ReferenceLine
            y={budget}
            stroke="#EF4444"
            strokeDasharray="6 4"
            label={{
              value: `Budget: ${budget}W`,
              fill: '#EF4444',
              fontSize: 11,
              position: 'right',
            }}
          />
          <Area
            type="monotone"
            dataKey="poeWatts"
            stroke="#F59E0B"
            fill="#F59E0B"
            fillOpacity={0.25}
            strokeWidth={2}
            name="poeWatts"
          />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  // ── Packets chart ─────────────────────────────────────────────────────
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
        <XAxis dataKey="time" tick={AXIS_TICK} />
        <YAxis tick={AXIS_TICK} width={60} tickFormatter={formatPackets} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(value: number, name: string) => [
            formatPackets(value),
            name === 'txPackets' ? 'TX Packets' : 'RX Packets',
          ]}
        />
        <Legend
          formatter={(value: string) =>
            value === 'txPackets' ? 'TX Packets' : 'RX Packets'
          }
        />
        <Line
          type="monotone"
          dataKey="txPackets"
          stroke="#8B5CF6"
          strokeWidth={2}
          dot={false}
          name="txPackets"
        />
        <Line
          type="monotone"
          dataKey="rxPackets"
          stroke="#06B6D4"
          strokeWidth={2}
          dot={false}
          name="rxPackets"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
