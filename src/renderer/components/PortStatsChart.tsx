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
  const i = Math.min(
    Math.floor(Math.log(Math.abs(bytes)) / Math.log(k)),
    units.length - 1
  );
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`;
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

function formatDateTime(ts: string): string {
  const d = new Date(ts);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
}

// ─── Custom Tooltip ─────────────────────────────────────────────────────────

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  chartMetric: string;
}

function CustomTooltip({ active, payload, label, chartMetric }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 shadow-xl text-xs">
      <p className="text-gray-300 mb-1.5 font-medium">
        {label ? formatDateTime(label) : ''}
      </p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 py-0.5">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-gray-400">{entry.name}:</span>
          <span className="text-white font-medium">
            {chartMetric === 'throughput'
              ? formatBytes(entry.value)
              : chartMetric === 'poe'
                ? `${entry.value.toFixed(1)} W`
                : chartMetric === 'packets'
                  ? formatPackets(entry.value)
                  : String(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Dark theme constants ───────────────────────────────────────────────────

const GRID_STROKE = '#374151';
const AXIS_STYLE = { fontSize: 11, fill: '#9CA3AF' };

// ─── Component ──────────────────────────────────────────────────────────────

export default function PortStatsChart({
  data,
  metric,
  height = 280,
  poeBudget = 60,
}: PortStatsChartProps) {
  const chartData = useMemo(() => {
    return data.map((s) => ({
      timestamp: s.timestamp,
      txBytes: s.txBytes,
      rxBytes: s.rxBytes,
      txPackets: s.txPackets,
      rxPackets: s.rxPackets,
      rxErrors: s.rxErrors,
      txErrors: s.txErrors,
      poeWatts: s.poeWatts ?? 0,
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

  const commonMargin = { top: 8, right: 16, left: 8, bottom: 4 };

  // ── Throughput ────────────────────────────────────────────────────────
  if (metric === 'throughput') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={chartData} margin={commonMargin}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
          <XAxis
            dataKey="timestamp"
            tickFormatter={formatTime}
            tick={AXIS_STYLE}
            stroke={GRID_STROKE}
          />
          <YAxis
            yAxisId="left"
            orientation="left"
            tickFormatter={formatBytes}
            tick={AXIS_STYLE}
            stroke={GRID_STROKE}
            width={70}
            label={{
              value: 'TX',
              angle: -90,
              position: 'insideLeft',
              style: { fill: '#60A5FA', fontSize: 11 },
            }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tickFormatter={formatBytes}
            tick={AXIS_STYLE}
            stroke={GRID_STROKE}
            width={70}
            label={{
              value: 'RX',
              angle: 90,
              position: 'insideRight',
              style: { fill: '#34D399', fontSize: 11 },
            }}
          />
          <Tooltip content={<CustomTooltip chartMetric="throughput" />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="txBytes"
            name="TX Bytes"
            stroke="#60A5FA"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="rxBytes"
            name="RX Bytes"
            stroke="#34D399"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  // ── Errors ────────────────────────────────────────────────────────────
  if (metric === 'errors') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={chartData} margin={commonMargin}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
          <XAxis
            dataKey="timestamp"
            tickFormatter={formatTime}
            tick={AXIS_STYLE}
            stroke={GRID_STROKE}
          />
          <YAxis tick={AXIS_STYLE} stroke={GRID_STROKE} width={50} />
          <Tooltip content={<CustomTooltip chartMetric="errors" />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar
            dataKey="rxErrors"
            name="RX Errors"
            fill="#EF4444"
            radius={[0, 0, 0, 0]}
          />
          <Bar
            dataKey="txErrors"
            name="TX Errors"
            fill="#F59E0B"
            radius={[2, 2, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  // ── PoE Draw ──────────────────────────────────────────────────────────
  if (metric === 'poe') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={chartData} margin={commonMargin}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
          <XAxis
            dataKey="timestamp"
            tickFormatter={formatTime}
            tick={AXIS_STYLE}
            stroke={GRID_STROKE}
          />
          <YAxis
            tick={AXIS_STYLE}
            stroke={GRID_STROKE}
            width={50}
            tickFormatter={(v: number) => `${v}W`}
            domain={[0, Math.ceil(poeBudget * 1.15)]}
          />
          <Tooltip content={<CustomTooltip chartMetric="poe" />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <ReferenceLine
            y={poeBudget}
            stroke="#EF4444"
            strokeDasharray="6 4"
            strokeWidth={1.5}
            label={{
              value: `Budget: ${poeBudget}W`,
              position: 'right',
              style: { fill: '#EF4444', fontSize: 10 },
            }}
          />
          <Area
            type="monotone"
            dataKey="poeWatts"
            name="PoE Draw (W)"
            stroke="#F59E0B"
            fill="#F59E0B"
            fillOpacity={0.25}
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  // ── Packets ───────────────────────────────────────────────────────────
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData} margin={commonMargin}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
        <XAxis
          dataKey="timestamp"
          tickFormatter={formatTime}
          tick={AXIS_STYLE}
          stroke={GRID_STROKE}
        />
        <YAxis
          tick={AXIS_STYLE}
          stroke={GRID_STROKE}
          width={60}
          tickFormatter={formatPackets}
        />
        <Tooltip content={<CustomTooltip chartMetric="packets" />} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line
          type="monotone"
          dataKey="txPackets"
          name="TX Packets"
          stroke="#8B5CF6"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Line
          type="monotone"
          dataKey="rxPackets"
          name="RX Packets"
          stroke="#06B6D4"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
