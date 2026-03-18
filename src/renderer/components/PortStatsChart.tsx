import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Brush,
  ReferenceLine,
} from 'recharts';

export interface PortStatPoint {
  timestamp: string;
  txBytes?: number;
  rxBytes?: number;
  poeWatts?: number;
  poeBudget?: number;
  crcErrors?: number;
  collisions?: number;
  drops?: number;
  eventCount?: number;
  category?: string;
  switchName?: string;
}

export interface PortStatsChartProps {
  data: PortStatPoint[];
  chartType: 'traffic' | 'poe' | 'errors' | 'frequency';
  timeRange: { start: string; end: string };
  selectedSwitch?: string;
  selectedPort?: number;
  bucketSize?: '1min' | '5min' | '1hour' | '1day';
  switchNames?: string[];
}

// ─── Byte formatting ────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(2)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(2)} MB`;
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(1)} KB`;
  return `${bytes} B`;
}

function formatTime(timestamp: string): string {
  const d = new Date(timestamp);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(timestamp: string): string {
  const d = new Date(timestamp);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

// ─── Custom Tooltip ─────────────────────────────────────────────────────────

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  chartType: string;
}

function CustomTooltip({ active, payload, label, chartType }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 shadow-xl text-xs">
      <p className="text-gray-300 mb-1.5 font-medium">{label ? formatDateTime(label) : ''}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 py-0.5">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-gray-400">{entry.name}:</span>
          <span className="text-white font-medium">
            {chartType === 'traffic'
              ? formatBytes(entry.value)
              : chartType === 'poe'
                ? `${entry.value.toFixed(1)} W`
                : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Chart components ───────────────────────────────────────────────────────

export default function PortStatsChart({
  data,
  chartType,
  timeRange,
  selectedSwitch,
  bucketSize,
  switchNames = [],
}: PortStatsChartProps) {
  // Filter data to time range
  const filteredData = useMemo(() => {
    const start = new Date(timeRange.start).getTime();
    const end = new Date(timeRange.end).getTime();
    return data.filter((p) => {
      const t = new Date(p.timestamp).getTime();
      return t >= start && t <= end;
    });
  }, [data, timeRange]);

  const commonProps = {
    margin: { top: 8, right: 16, left: 8, bottom: 4 },
  };

  const gridStroke = '#374151';
  const axisStyle = { fontSize: 11, fill: '#9CA3AF' };

  if (chartType === 'traffic') {
    const switchData = selectedSwitch
      ? filteredData.filter((p) => p.switchName === selectedSwitch || !p.switchName)
      : filteredData;

    // Deduplicate by timestamp for traffic
    const byTimestamp = new Map<string, PortStatPoint>();
    switchData.forEach((p) => {
      if (p.txBytes != null || p.rxBytes != null) {
        byTimestamp.set(p.timestamp, p);
      }
    });
    const chartPoints = Array.from(byTimestamp.values()).sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    return (
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartPoints} {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
          <XAxis
            dataKey="timestamp"
            tickFormatter={formatTime}
            tick={axisStyle}
            stroke={gridStroke}
          />
          <YAxis
            yAxisId="tx"
            orientation="left"
            tickFormatter={formatBytes}
            tick={axisStyle}
            stroke={gridStroke}
            label={{ value: 'TX', angle: -90, position: 'insideLeft', style: { fill: '#60A5FA', fontSize: 11 } }}
          />
          <YAxis
            yAxisId="rx"
            orientation="right"
            tickFormatter={formatBytes}
            tick={axisStyle}
            stroke={gridStroke}
            label={{ value: 'RX', angle: 90, position: 'insideRight', style: { fill: '#34D399', fontSize: 11 } }}
          />
          <Tooltip content={<CustomTooltip chartType="traffic" />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Brush dataKey="timestamp" height={20} stroke="#4B5563" fill="#1F2937" tickFormatter={formatTime} />
          <Line
            yAxisId="tx"
            type="monotone"
            dataKey="txBytes"
            name="TX Bytes"
            stroke="#60A5FA"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            yAxisId="rx"
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

  if (chartType === 'poe') {
    // Build stacked data by timestamp per switch
    const timestampMap = new Map<string, Record<string, number>>();
    filteredData.forEach((p) => {
      if (p.poeWatts != null && p.switchName) {
        const existing = timestampMap.get(p.timestamp) || {};
        existing[p.switchName] = p.poeWatts;
        existing._budget = p.poeBudget ?? 370;
        timestampMap.set(p.timestamp, existing);
      }
    });

    const poePoints = Array.from(timestampMap.entries())
      .map(([ts, vals]) => ({ timestamp: ts, ...vals }))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const colors = ['#60A5FA', '#34D399', '#F59E0B', '#F87171', '#A78BFA'];
    const names = switchNames.length > 0 ? switchNames : Array.from(new Set(filteredData.map((p) => p.switchName).filter(Boolean))) as string[];

    return (
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={poePoints} {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
          <XAxis dataKey="timestamp" tickFormatter={formatTime} tick={axisStyle} stroke={gridStroke} />
          <YAxis tickFormatter={(v: number) => `${v}W`} tick={axisStyle} stroke={gridStroke} />
          <Tooltip content={<CustomTooltip chartType="poe" />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Brush dataKey="timestamp" height={20} stroke="#4B5563" fill="#1F2937" tickFormatter={formatTime} />
          <ReferenceLine
            y={370}
            stroke="#EF4444"
            strokeDasharray="6 4"
            strokeWidth={1.5}
            label={{ value: 'Budget (370W)', position: 'right', style: { fill: '#EF4444', fontSize: 10 } }}
          />
          {names.map((name, i) => (
            <Area
              key={name}
              type="monotone"
              dataKey={name}
              name={name}
              stackId="poe"
              stroke={colors[i % colors.length]}
              fill={colors[i % colors.length]}
              fillOpacity={0.3}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === 'errors') {
    const switchData = selectedSwitch
      ? filteredData.filter((p) => p.switchName === selectedSwitch || !p.switchName)
      : filteredData;

    const byTimestamp = new Map<string, PortStatPoint>();
    switchData.forEach((p) => {
      if (p.crcErrors != null || p.collisions != null || p.drops != null) {
        byTimestamp.set(p.timestamp, p);
      }
    });
    const errorPoints = Array.from(byTimestamp.values()).sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    return (
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={errorPoints} {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
          <XAxis dataKey="timestamp" tickFormatter={formatTime} tick={axisStyle} stroke={gridStroke} />
          <YAxis tick={axisStyle} stroke={gridStroke} />
          <Tooltip content={<CustomTooltip chartType="errors" />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Brush dataKey="timestamp" height={20} stroke="#4B5563" fill="#1F2937" tickFormatter={formatTime} />
          <Bar dataKey="crcErrors" name="CRC Errors" stackId="err" fill="#EF4444" radius={[0, 0, 0, 0]} />
          <Bar dataKey="collisions" name="Collisions" stackId="err" fill="#F59E0B" radius={[0, 0, 0, 0]} />
          <Bar dataKey="drops" name="Drops" stackId="err" fill="#F97316" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  // frequency
  if (chartType === 'frequency') {
    // Build histogram buckets
    const categories = ['discovery', 'config', 'batch', 'excel', 'health', 'error', 'user'];
    const catColors: Record<string, string> = {
      discovery: '#60A5FA',
      config: '#34D399',
      batch: '#A78BFA',
      excel: '#2DD4BF',
      health: '#FBBF24',
      error: '#EF4444',
      user: '#9CA3AF',
    };

    // Count events per timestamp bucket per category
    const byTimestamp = new Map<string, Record<string, number>>();
    filteredData.forEach((p) => {
      if (p.eventCount != null && p.category) {
        const existing = byTimestamp.get(p.timestamp) || {};
        existing[p.category] = (existing[p.category] || 0) + (p.eventCount || 0);
        byTimestamp.set(p.timestamp, existing);
      }
    });

    const freqPoints = Array.from(byTimestamp.entries())
      .map(([ts, vals]) => ({ timestamp: ts, ...vals }))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return (
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={freqPoints} {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
          <XAxis dataKey="timestamp" tickFormatter={formatTime} tick={axisStyle} stroke={gridStroke} />
          <YAxis tick={axisStyle} stroke={gridStroke} label={{ value: 'Events', angle: -90, position: 'insideLeft', style: { fill: '#9CA3AF', fontSize: 11 } }} />
          <Tooltip content={<CustomTooltip chartType="frequency" />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Brush dataKey="timestamp" height={20} stroke="#4B5563" fill="#1F2937" tickFormatter={formatTime} />
          {categories.map((cat) => (
            <Bar key={cat} dataKey={cat} name={cat} stackId="freq" fill={catColors[cat]} radius={[0, 0, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return null;
}
