/**
 * Subnet scanner for discovering GigaCore switches via HTTP probes.
 *
 * Scans IP ranges by sending HTTP requests to each host and checking
 * for GigaCore REST API (Gen2) or web UI (Gen1) responses.
 *
 * Uses `p-queue` for concurrency limiting and supports cancellation
 * via AbortSignal.
 */

import axios, { type AxiosInstance } from 'axios';
import { networkInterfaces } from 'os';
import PQueue from 'p-queue';
import * as ipModule from 'ip';
import type { SubnetScanResult, SubnetScanOptions, LocalSubnet } from './types';

export class SubnetScanner {
  private httpClient: AxiosInstance;

  constructor() {
    this.httpClient = axios.create({
      // No base URL — each request specifies the full URL
      validateStatus: () => true, // accept any HTTP status
    });
  }

  /**
   * Enumerate all local network interfaces and return their IPv4 subnets.
   */
  getLocalSubnets(): LocalSubnet[] {
    const ifaces = networkInterfaces();
    const subnets: LocalSubnet[] = [];

    for (const entries of Object.values(ifaces)) {
      if (!entries) continue;
      for (const entry of entries) {
        if (entry.family === 'IPv4' && !entry.internal) {
          const cidr = entry.cidr ?? `${entry.address}/${this.netmaskToPrefixLength(entry.netmask)}`;
          subnets.push({
            address: entry.address,
            cidr,
            netmask: entry.netmask,
          });
        }
      }
    }

    return subnets;
  }

  /**
   * Scan every host in a CIDR range (e.g. "10.0.1.0/24").
   */
  async scanSubnet(
    cidr: string,
    options: SubnetScanOptions = {},
  ): Promise<SubnetScanResult[]> {
    const ips = this.expandCidr(cidr);
    return this.scanIps(ips, options);
  }

  /**
   * Scan an explicit IP range (inclusive).
   */
  async scanRange(
    startIp: string,
    endIp: string,
    options: SubnetScanOptions = {},
  ): Promise<SubnetScanResult[]> {
    const ips = this.expandRange(startIp, endIp);
    return this.scanIps(ips, options);
  }

  /**
   * Probe a single host and return a result, or null if unreachable
   * or not a GigaCore switch.
   */
  async probeHost(ip: string, timeoutMs: number = 2000): Promise<SubnetScanResult | null> {
    const start = Date.now();

    // ── Try Gen2 REST API first ───────────────────────────────────────────
    try {
      const gen2 = await this.httpClient.get(`http://${ip}/api/system`, {
        timeout: timeoutMs,
      });

      if (gen2.status === 200 && gen2.data && typeof gen2.data === 'object') {
        const data = gen2.data;
        const elapsed = Date.now() - start;

        // Gen2 API returns a JSON object with system information
        const name: string = data.name ?? data.hostname ?? data.sysName ?? '';
        const model: string = data.model ?? data.product ?? '';
        const firmware: string = data.firmware ?? data.version ?? data.fwVersion ?? '';
        const mac: string = data.mac ?? data.macAddress ?? data.baseMac ?? '';

        const isGigaCore =
          model.toLowerCase().includes('gigacore') ||
          name.toLowerCase().includes('gigacore') ||
          (typeof data.manufacturer === 'string' &&
            data.manufacturer.toLowerCase().includes('luminex'));

        return {
          ip,
          isGigaCore,
          model: model || undefined,
          name: name || undefined,
          firmware: firmware || undefined,
          generation: 2,
          mac: mac || undefined,
          responseTimeMs: elapsed,
        };
      }
    } catch {
      // Gen2 API not available — fall through to Gen1 probe
    }

    // ── Try Gen1 HTTP probe ───────────────────────────────────────────────
    try {
      const gen1 = await this.httpClient.get(`http://${ip}/`, {
        timeout: timeoutMs,
        responseType: 'text',
      });

      const elapsed = Date.now() - start;

      if (gen1.status === 200 && typeof gen1.data === 'string') {
        const html: string = gen1.data;
        const lowerHtml = html.toLowerCase();

        const isGigaCore =
          lowerHtml.includes('gigacore') || lowerHtml.includes('luminex');

        if (isGigaCore) {
          // Attempt to extract model from HTML (e.g. "GigaCore 30i")
          const modelMatch = html.match(/GigaCore\s+\w+/i);
          // Attempt to extract firmware version
          const fwMatch = html.match(/(?:firmware|version|fw)[:\s]+([0-9][0-9a-zA-Z._-]+)/i);

          return {
            ip,
            isGigaCore: true,
            model: modelMatch ? modelMatch[0] : undefined,
            firmware: fwMatch ? fwMatch[1] : undefined,
            generation: 1,
            responseTimeMs: elapsed,
          };
        }
      }
    } catch {
      // Host unreachable or not HTTP
    }

    return null;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /**
   * Scan a list of IPs with concurrency limiting and progress reporting.
   */
  private async scanIps(
    ips: string[],
    options: SubnetScanOptions = {},
  ): Promise<SubnetScanResult[]> {
    const {
      concurrency = 20,
      timeoutMs = 2000,
      onProgress,
      onFound,
      signal,
    } = options;

    const queue = new PQueue({ concurrency });
    const results: SubnetScanResult[] = [];
    let scanned = 0;
    const total = ips.length;

    // If an abort signal fires, clear the queue
    if (signal) {
      signal.addEventListener('abort', () => queue.clear(), { once: true });
    }

    const tasks = ips.map((ip) =>
      queue.add(
        async () => {
          if (signal?.aborted) return;

          const result = await this.probeHost(ip, timeoutMs);
          scanned++;

          if (result) {
            results.push(result);
            onFound?.(result);
          }

          onProgress?.(scanned, total);
        },
        { signal },
      ).catch(() => {
        // Task was cancelled via AbortSignal — ignore
      }),
    );

    await Promise.allSettled(tasks);

    return results;
  }

  /**
   * Expand a CIDR notation into an array of host IPs (excluding
   * network and broadcast addresses for prefixes <= 30).
   */
  private expandCidr(cidr: string): string[] {
    const [network, prefixStr] = cidr.split('/');
    const prefix = parseInt(prefixStr, 10);

    if (prefix >= 31) {
      // /31 and /32 — return just the address(es)
      return prefix === 32 ? [network] : [network, this.incrementIp(network)];
    }

    // Convert prefix length to netmask manually
    const maskLong = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
    const netmask = [
      (maskLong >>> 24) & 255,
      (maskLong >>> 16) & 255,
      (maskLong >>> 8) & 255,
      maskLong & 255,
    ].join('.');
    const subnet = ipModule.subnet(network, netmask);
    const firstLong = ipModule.toLong(subnet.firstAddress);
    const lastLong = ipModule.toLong(subnet.lastAddress);

    const hostCount = lastLong - firstLong + 1;
    if (hostCount > 4094) {
      console.warn(`Subnet ${cidr} too large (${hostCount} hosts), limiting to /20`);
      return []; // reject subnets larger than /20
    }

    const ips: string[] = [];
    for (let long = firstLong; long <= lastLong; long++) {
      ips.push(ipModule.fromLong(long));
    }

    return ips;
  }

  /**
   * Expand an inclusive IP range into an array of IPs.
   */
  private expandRange(startIp: string, endIp: string): string[] {
    const startLong = ipModule.toLong(startIp);
    const endLong = ipModule.toLong(endIp);
    const ips: string[] = [];

    for (let long = startLong; long <= endLong; long++) {
      ips.push(ipModule.fromLong(long));
    }

    return ips;
  }

  /**
   * Increment an IP address by one.
   */
  private incrementIp(ip: string): string {
    return ipModule.fromLong(ipModule.toLong(ip) + 1);
  }

  /**
   * Convert a dotted-decimal netmask to a prefix length.
   */
  private netmaskToPrefixLength(netmask: string): number {
    const parts = netmask.split('.').map(Number);
    let bits = 0;
    for (const part of parts) {
      bits += (part >>> 0).toString(2).split('1').length - 1;
    }
    return bits;
  }
}
