// =============================================================================
// Luminex Configurator — Troubleshooting: Ping Tool
// =============================================================================

import { exec } from 'child_process';

export interface PingResult {
  host: string;
  alive: boolean;
  latencyMs: number;
  timestamp: string;
  ttl?: number;
  error?: string;
}

export interface PingSweepResult {
  hosts: PingResult[];
  totalAlive: number;
  totalDead: number;
  avgLatencyMs: number;
  maxLatencyMs: number;
  minLatencyMs: number;
}

export interface PingOptions {
  count?: number;       // 0 = infinite
  intervalMs?: number;  // default 1000
  timeoutMs?: number;   // default 3000
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function now(): string {
  return new Date().toISOString();
}

/**
 * Perform a single ICMP ping using the system `ping` command via child_process.
 */
async function icmpPing(
  host: string,
  timeoutMs: number = 5000,
): Promise<PingResult> {
  return new Promise<PingResult>((resolve) => {
    // Validate host — prevent command injection
    if (!/^[\w.\-:]+$/.test(host)) {
      resolve({
        host,
        alive: false,
        latencyMs: -1,
        timestamp: now(),
        error: 'Invalid host format',
      });
      return;
    }

    const isWindows = process.platform === 'win32';
    const timeoutSec = Math.max(1, Math.ceil(timeoutMs / 1000));

    // Build platform-specific ping command
    const cmd = isWindows
      ? `ping -n 1 -w ${timeoutMs} ${host}`
      : `ping -c 1 -W ${timeoutSec} ${host}`;

    const startTime = performance.now();

    exec(cmd, { timeout: timeoutMs + 2000 }, (error, stdout) => {
      const elapsed = performance.now() - startTime;

      if (error) {
        resolve({
          host,
          alive: false,
          latencyMs: -1,
          timestamp: now(),
          error: `Ping failed: ${error.message}`,
        });
        return;
      }

      // Parse latency from output
      let latencyMs = -1;
      let ttl: number | undefined;

      if (isWindows) {
        // Windows: "Reply from x.x.x.x: bytes=32 time=2ms TTL=64"
        // or "time<1ms" for very fast responses
        const timeMatch = stdout.match(/time[=<](\d+(?:\.\d+)?)\s*ms/i);
        if (timeMatch) {
          latencyMs = parseFloat(timeMatch[1]);
        }
        const ttlMatch = stdout.match(/TTL[=](\d+)/i);
        if (ttlMatch) {
          ttl = parseInt(ttlMatch[1], 10);
        }
      } else {
        // macOS/Linux: "64 bytes from x.x.x.x: icmp_seq=1 ttl=64 time=1.23 ms"
        const timeMatch = stdout.match(/time[=](\d+(?:\.\d+)?)\s*ms/i);
        if (timeMatch) {
          latencyMs = parseFloat(timeMatch[1]);
        }
        const ttlMatch = stdout.match(/ttl[=](\d+)/i);
        if (ttlMatch) {
          ttl = parseInt(ttlMatch[1], 10);
        }
      }

      // If we got output but couldn't parse latency, use elapsed time
      if (latencyMs === -1 && !error) {
        latencyMs = Math.round(elapsed * 100) / 100;
      }

      resolve({
        host,
        alive: latencyMs >= 0,
        latencyMs,
        timestamp: now(),
        ttl,
      });
    });
  });
}

// ---------------------------------------------------------------------------
// PingTool
// ---------------------------------------------------------------------------

export class PingTool {
  /**
   * Continuous ping with results stream.
   * Use `for await (const result of tool.ping(host))` to consume results.
   * Pass `count: 0` for infinite pings (default is 4).
   */
  async *ping(
    host: string,
    options?: PingOptions,
  ): AsyncGenerator<PingResult> {
    const count = options?.count ?? 4;
    const intervalMs = options?.intervalMs ?? 1000;
    const timeoutMs = options?.timeoutMs ?? 3000;
    const infinite = count === 0;

    let i = 0;
    while (infinite || i < count) {
      const result = await icmpPing(host, timeoutMs);
      yield result;
      i++;

      if (!infinite && i >= count) break;

      // Wait for interval before next ping
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }

  /**
   * Single ping to a host.
   */
  async pingOnce(host: string, timeoutMs = 3000): Promise<PingResult> {
    return icmpPing(host, timeoutMs);
  }

  /**
   * Ping sweep of multiple hosts in parallel with concurrency control.
   */
  async pingSweep(
    hosts: string[],
    concurrency = 10,
  ): Promise<PingSweepResult> {
    const results: PingResult[] = [];
    const queue = [...hosts];

    const worker = async () => {
      while (queue.length > 0) {
        const host = queue.shift();
        if (!host) break;
        const result = await icmpPing(host, 3000);
        results.push(result);
      }
    };

    // Spawn concurrent workers
    const workers: Promise<void>[] = [];
    for (let i = 0; i < Math.min(concurrency, hosts.length); i++) {
      workers.push(worker());
    }
    await Promise.all(workers);

    // Compute stats
    const alive = results.filter((r) => r.alive);
    const dead = results.filter((r) => !r.alive);
    const latencies = alive.map((r) => r.latencyMs).filter((l) => l > 0);

    return {
      hosts: results,
      totalAlive: alive.length,
      totalDead: dead.length,
      avgLatencyMs:
        latencies.length > 0
          ? Math.round(
              (latencies.reduce((a, b) => a + b, 0) / latencies.length) * 100,
            ) / 100
          : 0,
      maxLatencyMs: latencies.length > 0 ? Math.max(...latencies) : 0,
      minLatencyMs: latencies.length > 0 ? Math.min(...latencies) : 0,
    };
  }
}
