// =============================================================================
// GigaCore Command — Troubleshooting: Ping Tool
// =============================================================================

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
 * Perform a single ICMP-like ping.
 * In a real Electron app this would use raw sockets or `child_process` to
 * invoke the system `ping` command. Here we simulate realistic behaviour.
 */
async function icmpPing(
  host: string,
  timeoutMs: number,
): Promise<PingResult> {
  const start = performance.now();

  return new Promise<PingResult>((resolve) => {
    // Simulate network round-trip with realistic jitter
    const baseLatency = 2 + Math.random() * 8; // 2-10ms base
    const jitter = (Math.random() - 0.5) * 4;  // +/-2ms jitter
    const latency = Math.max(0.5, baseLatency + jitter);

    // ~3% chance of timeout
    const willTimeout = Math.random() < 0.03;
    // ~1% chance of host unreachable
    const willFail = Math.random() < 0.01;

    if (willTimeout) {
      setTimeout(() => {
        resolve({
          host,
          alive: false,
          latencyMs: -1,
          timestamp: now(),
          error: `Request timed out after ${timeoutMs}ms`,
        });
      }, Math.min(timeoutMs, 100)); // cap simulated wait
    } else if (willFail) {
      setTimeout(() => {
        resolve({
          host,
          alive: false,
          latencyMs: -1,
          timestamp: now(),
          error: 'Destination host unreachable',
        });
      }, 10);
    } else {
      setTimeout(() => {
        resolve({
          host,
          alive: true,
          latencyMs: Math.round(latency * 100) / 100,
          timestamp: now(),
          ttl: 64 - Math.floor(Math.random() * 3),
        });
      }, Math.min(latency, 50));
    }
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
