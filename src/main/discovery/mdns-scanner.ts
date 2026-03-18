/**
 * mDNS / Bonjour scanner for discovering GigaCore switches and
 * other networked AV devices (Dante, NDI, etc.).
 *
 * Uses the `bonjour-service` package which is a pure-JS mDNS
 * implementation suitable for Electron main-process usage.
 */

import Bonjour, { type Browser } from 'bonjour-service';
import type { MdnsDiscoveryResult } from './types';

/** Service types we actively browse for. */
const SERVICE_TYPES = [
  { type: 'http', protocol: 'tcp' },   // GigaCore web UI
  { type: 'ndi',  protocol: 'tcp' },   // NDI devices
  { type: 'dante', protocol: 'tcp' },  // Dante / AES67
  { type: 'artnet', protocol: 'udp' }, // Art-Net nodes
] as const;

export class MdnsScanner {
  private bonjour: Bonjour;
  private browsers: Browser[] = [];
  private destroyed = false;

  constructor() {
    this.bonjour = new Bonjour();
  }

  /**
   * Start continuous browsing for relevant service types.
   * Every time a matching service is discovered the `onFound` callback fires.
   */
  startBrowsing(onFound: (result: MdnsDiscoveryResult) => void): void {
    if (this.destroyed) return;

    this.stopBrowsing();

    for (const svc of SERVICE_TYPES) {
      try {
        const browser = this.bonjour.find(
          { type: svc.type, protocol: svc.protocol },
          (service: any) => {
            const result = this.serviceToResult(service, svc.type);
            if (result) {
              onFound(result);
            }
          },
        );
        this.browsers.push(browser);
      } catch {
        // If a particular service type cannot be browsed (e.g. unsupported
        // protocol on the platform), skip it silently.
      }
    }
  }

  /**
   * Stop all active browse sessions.
   */
  stopBrowsing(): void {
    for (const browser of this.browsers) {
      try {
        browser.stop();
      } catch {
        // Ignore errors during cleanup
      }
    }
    this.browsers = [];
  }

  /**
   * One-shot scan: browse for `durationMs` milliseconds, collect every
   * result and return them as an array.
   */
  async scan(durationMs: number = 5000): Promise<MdnsDiscoveryResult[]> {
    return new Promise<MdnsDiscoveryResult[]>((resolve) => {
      const results: MdnsDiscoveryResult[] = [];
      const seen = new Set<string>();

      this.startBrowsing((result) => {
        const key = `${result.ip}:${result.port}:${result.type}`;
        if (!seen.has(key)) {
          seen.add(key);
          results.push(result);
        }
      });

      setTimeout(() => {
        this.stopBrowsing();
        resolve(results);
      }, durationMs);
    });
  }

  /**
   * Tear down the scanner and release all resources.
   */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.stopBrowsing();
    try {
      this.bonjour.destroy();
    } catch {
      // Ignore cleanup errors
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  private serviceToResult(
    service: any,
    type: string,
  ): MdnsDiscoveryResult | null {
    // Prefer the first IPv4 address
    const ip = (service.addresses ?? []).find((a: string) => /^\d+\.\d+\.\d+\.\d+$/.test(a));
    if (!ip) return null;

    // Flatten TXT record – bonjour-service provides it as either
    // a Record<string,string> or Buffer[]
    const txt: Record<string, string> = {};
    if (service.txt && typeof service.txt === 'object') {
      for (const [k, v] of Object.entries(service.txt)) {
        txt[k] = typeof v === 'string' ? v : String(v);
      }
    }

    return {
      name: service.name ?? '',
      ip,
      port: service.port ?? 0,
      type,
      txt,
    };
  }
}
