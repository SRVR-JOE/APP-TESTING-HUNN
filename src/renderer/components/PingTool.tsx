import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Play, Square, Wifi } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

interface PingEntry {
  seq: number;
  latency: number;
  status: 'ok' | 'timeout';
  timestamp: string;
}

function generateMockLatency(): { latency: number; status: 'ok' | 'timeout' } {
  const rand = Math.random();
  if (rand < 0.03) {
    return { latency: 0, status: 'timeout' };
  }
  if (rand < 0.08) {
    // Spike
    return { latency: Math.round(30 + Math.random() * 45), status: 'ok' };
  }
  return { latency: Math.round(8 + Math.random() * 7), status: 'ok' };
}

export const PingTool: React.FC = () => {
  const [targetIp, setTargetIp] = useState('192.168.1.1');
  const [running, setRunning] = useState(false);
  const [pings, setPings] = useState<PingEntry[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const seqRef = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);

  const startPing = useCallback(() => {
    if (!targetIp.trim()) return;
    setPings([]);
    seqRef.current = 0;
    setRunning(true);
  }, [targetIp]);

  const stopPing = useCallback(() => {
    setRunning(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        seqRef.current += 1;
        const { latency, status } = generateMockLatency();
        const entry: PingEntry = {
          seq: seqRef.current,
          latency,
          status,
          timestamp: new Date().toLocaleTimeString(),
        };
        setPings((prev) => {
          const next = [...prev, entry];
          return next.length > 100 ? next.slice(-100) : next;
        });
      }, 1000);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [running]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [pings]);

  // Stats
  const okPings = pings.filter((p) => p.status === 'ok');
  const timeouts = pings.filter((p) => p.status === 'timeout');
  const latencies = okPings.map((p) => p.latency);
  const min = latencies.length ? Math.min(...latencies) : 0;
  const max = latencies.length ? Math.max(...latencies) : 0;
  const avg = latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;
  const jitter =
    latencies.length > 1
      ? Math.round(
          latencies.slice(1).reduce((acc, val, i) => acc + Math.abs(val - latencies[i]), 0) /
            (latencies.length - 1)
        )
      : 0;
  const lossPercent = pings.length ? ((timeouts.length / pings.length) * 100).toFixed(1) : '0.0';

  const chartData = pings.slice(-40).map((p) => ({
    seq: p.seq,
    latency: p.status === 'ok' ? p.latency : null,
  }));

  const last20 = pings.slice(-20).reverse();

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
      <div className="flex items-center gap-2 mb-4">
        <Wifi size={18} className="text-gc-accent" />
        <h3 className="text-sm font-semibold text-gray-100">Ping Tool</h3>
      </div>

      {/* Input */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={targetIp}
          onChange={(e) => setTargetIp(e.target.value)}
          disabled={running}
          placeholder="Target IP address"
          className="flex-1 bg-gray-900 border border-gray-600 rounded px-3 py-1.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gc-accent disabled:opacity-50"
        />
        {!running ? (
          <button
            onClick={startPing}
            className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors"
          >
            <Play size={14} /> Start
          </button>
        ) : (
          <button
            onClick={stopPing}
            className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
          >
            <Square size={14} /> Stop
          </button>
        )}
      </div>

      {/* Chart */}
      {pings.length > 0 && (
        <div className="mb-4 h-40">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="seq"
                tick={{ fill: '#9ca3af', fontSize: 10 }}
                stroke="#4b5563"
              />
              <YAxis
                tick={{ fill: '#9ca3af', fontSize: 10 }}
                stroke="#4b5563"
                unit="ms"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #4b5563',
                  borderRadius: '6px',
                  fontSize: '12px',
                }}
                labelStyle={{ color: '#9ca3af' }}
              />
              <ReferenceLine y={avg} stroke="#00b4d8" strokeDasharray="3 3" label="" />
              <Line
                type="monotone"
                dataKey="latency"
                stroke="#00b4d8"
                strokeWidth={2}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Stats */}
      {pings.length > 0 && (
        <div className="grid grid-cols-5 gap-2 mb-4">
          {[
            { label: 'Min', value: `${min}ms`, color: 'text-green-400' },
            { label: 'Max', value: `${max}ms`, color: 'text-red-400' },
            { label: 'Avg', value: `${avg}ms`, color: 'text-gc-accent' },
            { label: 'Jitter', value: `${jitter}ms`, color: 'text-yellow-400' },
            { label: 'Loss', value: `${lossPercent}%`, color: parseFloat(lossPercent) > 0 ? 'text-red-400' : 'text-green-400' },
          ].map((s) => (
            <div key={s.label} className="bg-gray-900 rounded p-2 text-center">
              <div className="text-xs text-gray-500">{s.label}</div>
              <div className={`text-sm font-mono font-semibold ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Ping list */}
      {pings.length > 0 && (
        <div ref={listRef} className="max-h-48 overflow-y-auto space-y-0.5">
          <div className="grid grid-cols-3 gap-2 text-xs text-gray-500 px-2 pb-1 sticky top-0 bg-gray-800">
            <span>Seq #</span>
            <span>Latency</span>
            <span>Status</span>
          </div>
          {last20.map((p) => (
            <div
              key={p.seq}
              className="grid grid-cols-3 gap-2 text-xs px-2 py-0.5 rounded hover:bg-gray-700/50"
            >
              <span className="text-gray-400 font-mono">{p.seq}</span>
              <span className={`font-mono ${p.status === 'ok' ? 'text-green-400' : 'text-red-400'}`}>
                {p.status === 'ok' ? `${p.latency}ms` : 'timeout'}
              </span>
              <span className={p.status === 'ok' ? 'text-green-400' : 'text-red-400'}>
                {p.status === 'ok' ? 'Reply' : 'Timeout'}
              </span>
            </div>
          ))}
        </div>
      )}

      {pings.length === 0 && !running && (
        <div className="text-center text-gray-500 text-sm py-8">
          Enter a target IP and click Start to begin pinging
        </div>
      )}
    </div>
  );
};

export default PingTool;
