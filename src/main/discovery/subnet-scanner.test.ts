/**
 * Tests for SubnetScanner.
 *
 * The class exposes expandCidr, expandRange, netmaskToPrefixLength, and
 * incrementIp as private methods.  We access them via the public API
 * (scanSubnet, scanRange) or by casting to `any` for pure-logic helpers.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SubnetScanner } from './subnet-scanner';

// We need to mock axios so no real HTTP requests fire.
vi.mock('axios', () => {
  const instance = {
    get: vi.fn().mockRejectedValue(new Error('no network')),
  };
  return {
    default: { create: () => instance },
  };
});

// Mock `ip` module with a minimal implementation for unit tests
vi.mock('ip', () => {
  function toLong(ip: string): number {
    const parts = ip.split('.').map(Number);
    return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
  }
  function fromLong(long: number): string {
    return [
      (long >>> 24) & 255,
      (long >>> 16) & 255,
      (long >>> 8) & 255,
      long & 255,
    ].join('.');
  }
  return {
    toLong,
    fromLong,
    subnet: (network: string, netmask: string) => {
      const netLong = toLong(network);
      const maskLong = toLong(netmask);
      const networkAddr = (netLong & maskLong) >>> 0;
      const broadcastAddr = (networkAddr | (~maskLong >>> 0)) >>> 0;
      // firstAddress = networkAddr + 1, lastAddress = broadcastAddr - 1
      return {
        firstAddress: fromLong(networkAddr + 1),
        lastAddress: fromLong(broadcastAddr - 1),
      };
    },
  };
});

// Mock p-queue to run tasks synchronously (no concurrency needed in tests)
vi.mock('p-queue', () => {
  return {
    default: class FakeQueue {
      add(fn: () => Promise<void>) { return fn(); }
      clear() {}
    },
  };
});

describe('SubnetScanner', () => {
  let scanner: SubnetScanner;

  beforeEach(() => {
    scanner = new SubnetScanner();
  });

  // ── netmaskToPrefixLength ───────────────────────────────────────────────

  describe('netmaskToPrefixLength', () => {
    const helper = (netmask: string): number =>
      (scanner as any).netmaskToPrefixLength(netmask);

    it('should convert 255.255.255.0 to 24', () => {
      expect(helper('255.255.255.0')).toBe(24);
    });

    it('should convert 255.255.0.0 to 16', () => {
      expect(helper('255.255.0.0')).toBe(16);
    });

    it('should convert 255.255.255.128 to 25', () => {
      expect(helper('255.255.255.128')).toBe(25);
    });

    it('should convert 255.255.255.252 to 30', () => {
      expect(helper('255.255.255.252')).toBe(30);
    });

    it('should convert 255.0.0.0 to 8', () => {
      expect(helper('255.0.0.0')).toBe(8);
    });

    it('should return 0 for 0.0.0.0', () => {
      expect(helper('0.0.0.0')).toBe(0);
    });

    it('should convert 255.255.255.255 to 32', () => {
      expect(helper('255.255.255.255')).toBe(32);
    });
  });

  // ── expandCidr ──────────────────────────────────────────────────────────

  describe('expandCidr', () => {
    const expand = (cidr: string): string[] =>
      (scanner as any).expandCidr(cidr);

    it('should return a single IP for /32', () => {
      const ips = expand('10.0.0.5/32');
      expect(ips).toEqual(['10.0.0.5']);
    });

    it('should return two IPs for /31 (point-to-point link)', () => {
      const ips = expand('10.0.0.4/31');
      expect(ips).toHaveLength(2);
      expect(ips[0]).toBe('10.0.0.4');
      expect(ips[1]).toBe('10.0.0.5');
    });

    it('should expand /30 to 2 host IPs (excluding network and broadcast)', () => {
      const ips = expand('192.168.1.0/30');
      // /30 network=.0 broadcast=.3 => hosts = .1, .2
      expect(ips).toHaveLength(2);
      expect(ips).toContain('192.168.1.1');
      expect(ips).toContain('192.168.1.2');
    });

    it('should expand /29 to 6 host IPs', () => {
      const ips = expand('10.0.0.0/29');
      // /29: 8 addresses, minus network and broadcast = 6 hosts (.1-.6)
      expect(ips).toHaveLength(6);
      expect(ips[0]).toBe('10.0.0.1');
      expect(ips[5]).toBe('10.0.0.6');
    });

    it('should expand /24 to 254 host IPs', () => {
      const ips = expand('192.168.1.0/24');
      expect(ips).toHaveLength(254);
      expect(ips[0]).toBe('192.168.1.1');
      expect(ips[253]).toBe('192.168.1.254');
    });

    it('should reject subnets larger than /20 (>4094 hosts)', () => {
      const ips = expand('10.0.0.0/19');
      // /19 has 8190 hosts — should be rejected
      expect(ips).toEqual([]);
    });
  });

  // ── expandRange ─────────────────────────────────────────────────────────

  describe('expandRange', () => {
    const expandRange = (start: string, end: string): string[] =>
      (scanner as any).expandRange(start, end);

    it('should return a single IP when start equals end', () => {
      const ips = expandRange('10.0.0.1', '10.0.0.1');
      expect(ips).toEqual(['10.0.0.1']);
    });

    it('should expand a small range correctly', () => {
      const ips = expandRange('10.0.0.1', '10.0.0.5');
      expect(ips).toHaveLength(5);
      expect(ips).toEqual([
        '10.0.0.1',
        '10.0.0.2',
        '10.0.0.3',
        '10.0.0.4',
        '10.0.0.5',
      ]);
    });

    it('should cross octet boundaries', () => {
      const ips = expandRange('10.0.0.254', '10.0.1.2');
      expect(ips).toHaveLength(5);
      expect(ips[0]).toBe('10.0.0.254');
      expect(ips[1]).toBe('10.0.0.255');
      expect(ips[2]).toBe('10.0.1.0');
      expect(ips[3]).toBe('10.0.1.1');
      expect(ips[4]).toBe('10.0.1.2');
    });
  });

  // ── scanSubnet integration (with mocked probeHost) ──────────────────────

  describe('scanSubnet', () => {
    it('should call probeHost for every IP in the CIDR range', async () => {
      const probeSpy = vi.spyOn(scanner, 'probeHost').mockResolvedValue(null);

      await scanner.scanSubnet('10.0.0.0/30');

      // /30 => 2 host IPs
      expect(probeSpy).toHaveBeenCalledTimes(2);
      expect(probeSpy).toHaveBeenCalledWith('10.0.0.1', 2000);
      expect(probeSpy).toHaveBeenCalledWith('10.0.0.2', 2000);
    });

    it('should collect results from probeHost', async () => {
      const fakeResult = {
        ip: '10.0.0.1',
        isGigaCore: true,
        model: 'GigaCore 30i',
        generation: 2 as const,
        responseTimeMs: 42,
      };
      vi.spyOn(scanner, 'probeHost').mockImplementation(async (ip) =>
        ip === '10.0.0.1' ? fakeResult : null,
      );

      const results = await scanner.scanSubnet('10.0.0.0/30');
      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({ ip: '10.0.0.1', isGigaCore: true });
    });

    it('should invoke onProgress and onFound callbacks', async () => {
      const fakeResult = {
        ip: '10.0.0.1',
        isGigaCore: true,
        responseTimeMs: 10,
      };
      vi.spyOn(scanner, 'probeHost').mockImplementation(async (ip) =>
        ip === '10.0.0.1' ? fakeResult : null,
      );

      const onProgress = vi.fn();
      const onFound = vi.fn();

      await scanner.scanSubnet('10.0.0.0/30', { onProgress, onFound });

      expect(onProgress).toHaveBeenCalledTimes(2);
      expect(onFound).toHaveBeenCalledTimes(1);
      expect(onFound).toHaveBeenCalledWith(fakeResult);
    });
  });

  // ── scanRange integration ───────────────────────────────────────────────

  describe('scanRange', () => {
    it('should scan inclusive range of IPs', async () => {
      const probeSpy = vi.spyOn(scanner, 'probeHost').mockResolvedValue(null);

      await scanner.scanRange('192.168.1.10', '192.168.1.12');

      expect(probeSpy).toHaveBeenCalledTimes(3);
      expect(probeSpy).toHaveBeenCalledWith('192.168.1.10', 2000);
      expect(probeSpy).toHaveBeenCalledWith('192.168.1.11', 2000);
      expect(probeSpy).toHaveBeenCalledWith('192.168.1.12', 2000);
    });
  });
});
