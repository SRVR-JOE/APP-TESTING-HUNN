/**
 * Discovery Manager — orchestrates all discovery methods (mDNS,
 * subnet scanning, LLDP) and maintains a unified view of discovered
 * switches and devices on the network.
 *
 * Emits events for real-time updates to the renderer process.
 */

import { EventEmitter } from 'events';
import { MdnsScanner } from './mdns-scanner';
import { SubnetScanner } from './subnet-scanner';
import { LldpListener } from './lldp-listener';
import { MacOuiResolver } from './mac-oui-resolver';
import type {
  DiscoveredSwitch,
  DiscoveredDevice,
  MdnsDiscoveryResult,
  SubnetScanResult,
  LldpNeighbor,
} from './types';
import { getPortCountForModel } from './types';

// ── Event type map (for documentation — TypeScript EventEmitter doesn't
//    natively support this, but the interface clarifies the API) ──────────

export interface DiscoveryManagerEvents {
  'switch:found': (sw: DiscoveredSwitch) => void;
  'switch:lost': (id: string) => void;
  'switch:updated': (sw: DiscoveredSwitch) => void;
  'device:found': (dev: DiscoveredDevice) => void;
  'device:lost': (id: number) => void;
  'scan:started': () => void;
  'scan:progress': (scanned: number, total: number) => void;
  'scan:completed': (results: { switches: number; devices: number }) => void;
  error: (error: Error) => void;
}

/** Default subnets commonly used by GigaCore switches. */
const DEFAULT_GIGACORE_SUBNETS = ['2.0.0.0/24', '192.168.0.0/24'];

/** How long before a switch is considered lost (ms). */
const SWITCH_LOST_TIMEOUT_MS = 120_000; // 2 minutes

export class DiscoveryManager extends EventEmitter {
  private mdnsScanner: MdnsScanner;
  private subnetScanner: SubnetScanner;
  private lldpListener: LldpListener;
  private ouiResolver: MacOuiResolver;

  private switches: Map<string, DiscoveredSwitch> = new Map();
  private devices: Map<string, DiscoveredDevice> = new Map();
  private pollingInterval: NodeJS.Timeout | null = null;
  private scanAbortController: AbortController | null = null;
  private nextDeviceId = 1;
  private destroyed = false;

  constructor() {
    super();
    this.mdnsScanner = new MdnsScanner();
    this.subnetScanner = new SubnetScanner();
    this.lldpListener = new LldpListener();
    this.ouiResolver = new MacOuiResolver();
  }

  // ── Full scan ─────────────────────────────────────────────────────────────

  /**
   * Perform a comprehensive network scan using all available methods:
   * 1. mDNS browse (5 seconds)
   * 2. Subnet scan (all detected local subnets + default GigaCore ranges)
   * 3. LLDP neighbor discovery on found switches
   */
  async performFullScan(
    subnets?: string[],
  ): Promise<{ switches: DiscoveredSwitch[]; devices: DiscoveredDevice[] }> {
    if (this.destroyed) {
      throw new Error('DiscoveryManager has been destroyed');
    }

    this.emit('scan:started');
    this.scanAbortController = new AbortController();
    const { signal } = this.scanAbortController;

    try {
      // ── Phase 1: mDNS ──────────────────────────────────────────────────
      let mdnsResults: MdnsDiscoveryResult[] = [];
      try {
        mdnsResults = await this.mdnsScanner.scan(5000);
      } catch (err) {
        this.emitError('mDNS scan failed', err);
      }

      // Process mDNS results
      for (const result of mdnsResults) {
        this.processMdnsResult(result);
      }

      if (signal.aborted) return this.currentState();

      // ── Phase 2: Subnet scan ───────────────────────────────────────────
      const targetSubnets = subnets ?? this.buildScanTargets();

      for (const cidr of targetSubnets) {
        if (signal.aborted) break;

        try {
          await this.subnetScanner.scanSubnet(cidr, {
            concurrency: 20,
            timeoutMs: 2000,
            signal,
            onProgress: (scanned, total) => {
              this.emit('scan:progress', scanned, total);
            },
            onFound: (result) => {
              if (result.isGigaCore) {
                this.processSubnetScanResult(result);
              }
            },
          });
        } catch (err) {
          this.emitError(`Subnet scan failed for ${cidr}`, err);
        }
      }

      if (signal.aborted) return this.currentState();

      // ── Phase 3: LLDP topology discovery ───────────────────────────────
      const switchIps = Array.from(this.switches.values()).map((s) => s.ip);

      if (switchIps.length > 0) {
        try {
          const links = await this.lldpListener.buildTopology(switchIps);

          // Discover additional switches found via LLDP that we didn't
          // already know about
          const newIps = new Set<string>();
          for (const link of links) {
            if (!this.switches.has(link.targetSwitch)) {
              newIps.add(link.targetSwitch);
            }
            if (!this.switches.has(link.sourceSwitch)) {
              newIps.add(link.sourceSwitch);
            }
          }

          // Probe any newly discovered IPs
          for (const ip of newIps) {
            if (signal.aborted) break;
            try {
              const result = await this.subnetScanner.probeHost(ip);
              if (result?.isGigaCore) {
                this.processSubnetScanResult(result);
              }
            } catch {
              // Probe failed — skip
            }
          }

          // Extract LLDP neighbor devices from all switches
          for (const switchIp of switchIps) {
            if (signal.aborted) break;
            try {
              const neighbors = await this.lldpListener.getNeighbors(switchIp);
              this.processLldpNeighbors(switchIp, neighbors);
            } catch {
              // LLDP query failed for this switch
            }
          }
        } catch (err) {
          this.emitError('LLDP topology discovery failed', err);
        }
      }

      // ── Finalize ───────────────────────────────────────────────────────
      this.pruneStale();

      const state = this.currentState();
      this.emit('scan:completed', {
        switches: state.switches.length,
        devices: state.devices.length,
      });

      return state;
    } finally {
      this.scanAbortController = null;
    }
  }

  // ── Polling ───────────────────────────────────────────────────────────────

  /**
   * Start continuous polling at the given interval.
   */
  startPolling(intervalMs: number = 30_000): void {
    this.stopPolling();

    // Run an initial scan immediately
    this.performFullScan().catch((err) => {
      this.emitError('Polling scan failed', err);
    });

    this.pollingInterval = setInterval(() => {
      this.performFullScan().catch((err) => {
        this.emitError('Polling scan failed', err);
      });
    }, intervalMs);
  }

  /**
   * Stop continuous polling.
   */
  stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    // Cancel any in-flight scan
    this.scanAbortController?.abort();
  }

  // ── Manual add ────────────────────────────────────────────────────────────

  /**
   * Manually probe and add a switch by IP address.
   */
  async addManualSwitch(ip: string): Promise<DiscoveredSwitch | null> {
    const result = await this.subnetScanner.probeHost(ip, 5000);
    if (!result?.isGigaCore) return null;

    this.processSubnetScanResult(result);
    return this.switches.get(ip) ?? null;
  }

  // ── Accessors ─────────────────────────────────────────────────────────────

  /**
   * Return all currently known switches.
   */
  getSwitches(): DiscoveredSwitch[] {
    return Array.from(this.switches.values());
  }

  /**
   * Return all currently known devices.
   */
  getDevices(): DiscoveredDevice[] {
    return Array.from(this.devices.values());
  }

  // ── Teardown ──────────────────────────────────────────────────────────────

  /**
   * Release all resources and stop background tasks.
   */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    this.stopPolling();
    this.mdnsScanner.destroy();
    this.switches.clear();
    this.devices.clear();
    this.removeAllListeners();
  }

  // ── Private: result processing ────────────────────────────────────────────

  /**
   * Process an mDNS discovery result and update state accordingly.
   */
  private processMdnsResult(result: MdnsDiscoveryResult): void {
    const now = new Date().toISOString();

    // Check if this is a device we should track
    if (result.type === 'http') {
      // Could be a GigaCore web UI — we'll pick it up via subnet scan
      // but record the device for now
      const deviceKey = `${result.ip}:${result.type}`;
      if (!this.devices.has(deviceKey)) {
        const device: DiscoveredDevice = {
          id: this.nextDeviceId++,
          mac: '',
          ip: result.ip,
          hostname: result.name,
          protocol: 'HTTP',
          firstSeen: now,
          lastSeen: now,
        };
        this.devices.set(deviceKey, device);
        this.emit('device:found', device);
      } else {
        const existing = this.devices.get(deviceKey)!;
        existing.lastSeen = now;
        if (result.name) existing.hostname = result.name;
      }
    } else {
      // NDI, Dante, Art-Net device
      const protocol = result.type.toUpperCase();
      const deviceKey = `${result.ip}:${protocol}`;

      if (!this.devices.has(deviceKey)) {
        const device: DiscoveredDevice = {
          id: this.nextDeviceId++,
          mac: '',
          ip: result.ip,
          hostname: result.name,
          protocol,
          firstSeen: now,
          lastSeen: now,
        };
        this.devices.set(deviceKey, device);
        this.emit('device:found', device);
      } else {
        const existing = this.devices.get(deviceKey)!;
        existing.lastSeen = now;
      }
    }
  }

  /**
   * Process a subnet scan result for a GigaCore switch.
   */
  private processSubnetScanResult(result: SubnetScanResult): void {
    const now = new Date().toISOString();
    const existing = this.switches.get(result.ip);

    if (existing) {
      // Update existing switch
      const updated: DiscoveredSwitch = {
        ...existing,
        isOnline: true,
        lastSeen: now,
        healthStatus: 'healthy',
      };

      if (result.model) updated.model = result.model;
      if (result.name) updated.name = result.name;
      if (result.firmware) updated.firmware = result.firmware;
      if (result.generation) updated.generation = result.generation;
      if (result.mac) {
        updated.mac = this.ouiResolver.normalizeMac(result.mac);
      }
      if (result.model) {
        updated.portCount = getPortCountForModel(result.model);
      }

      this.switches.set(result.ip, updated);
      this.emit('switch:updated', updated);
    } else {
      // New switch
      const mac = result.mac
        ? this.ouiResolver.normalizeMac(result.mac)
        : '';

      const sw: DiscoveredSwitch = {
        id: result.ip,
        name: result.name ?? result.model ?? `GigaCore @ ${result.ip}`,
        model: result.model ?? 'Unknown GigaCore',
        ip: result.ip,
        mac,
        firmware: result.firmware ?? '',
        generation: result.generation ?? 1,
        serial: '',
        isOnline: true,
        lastSeen: now,
        firstSeen: now,
        portCount: result.model ? getPortCountForModel(result.model) : 0,
        portsUp: 0,
        healthStatus: 'healthy',
      };

      this.switches.set(result.ip, sw);
      this.emit('switch:found', sw);
    }
  }

  /**
   * Process LLDP neighbors from a switch and register them as devices.
   */
  private processLldpNeighbors(
    switchIp: string,
    neighbors: LldpNeighbor[],
  ): void {
    const now = new Date().toISOString();
    const switchEntry = this.switches.get(switchIp);
    const switchMac = switchEntry?.mac ?? '';

    for (const neighbor of neighbors) {
      const deviceKey = `lldp:${neighbor.remoteChassisId}:${neighbor.remotePortId}`;
      const manufacturer = neighbor.remoteChassisId
        ? this.ouiResolver.resolve(neighbor.remoteChassisId)
        : undefined;

      if (!this.devices.has(deviceKey)) {
        const device: DiscoveredDevice = {
          id: this.nextDeviceId++,
          mac: neighbor.remoteChassisId,
          ip: neighbor.remoteMgmtAddr,
          hostname: neighbor.remoteSysName,
          manufacturer,
          connectedSwitchMac: switchMac,
          connectedPort: neighbor.localPort,
          firstSeen: now,
          lastSeen: now,
        };
        this.devices.set(deviceKey, device);
        this.emit('device:found', device);
      } else {
        const existing = this.devices.get(deviceKey)!;
        existing.lastSeen = now;
        if (neighbor.remoteMgmtAddr) existing.ip = neighbor.remoteMgmtAddr;
        if (neighbor.remoteSysName) existing.hostname = neighbor.remoteSysName;
        if (manufacturer) existing.manufacturer = manufacturer;
        existing.connectedSwitchMac = switchMac;
        existing.connectedPort = neighbor.localPort;
      }
    }
  }

  // ── Private: helpers ──────────────────────────────────────────────────────

  /**
   * Build the list of subnets to scan, combining local interfaces
   * with default GigaCore ranges.
   */
  private buildScanTargets(): string[] {
    const localSubnets = this.subnetScanner.getLocalSubnets();
    const cidrs = new Set<string>(localSubnets.map((s) => s.cidr));

    // Always include default GigaCore management subnets
    for (const cidr of DEFAULT_GIGACORE_SUBNETS) {
      cidrs.add(cidr);
    }

    return Array.from(cidrs);
  }

  /**
   * Mark switches that haven't been seen recently as offline / lost.
   */
  private pruneStale(): void {
    const now = Date.now();

    for (const [key, sw] of this.switches) {
      const lastSeen = new Date(sw.lastSeen).getTime();
      if (now - lastSeen > SWITCH_LOST_TIMEOUT_MS) {
        if (sw.isOnline) {
          sw.isOnline = false;
          sw.healthStatus = 'offline';
          this.emit('switch:lost', sw.id);
        }
      }
    }

    for (const [key, dev] of this.devices) {
      const lastSeen = new Date(dev.lastSeen).getTime();
      if (now - lastSeen > SWITCH_LOST_TIMEOUT_MS) {
        this.devices.delete(key);
        this.emit('device:lost', dev.id);
      }
    }
  }

  /**
   * Return the current state snapshot.
   */
  private currentState(): {
    switches: DiscoveredSwitch[];
    devices: DiscoveredDevice[];
  } {
    return {
      switches: this.getSwitches(),
      devices: this.getDevices(),
    };
  }

  /**
   * Emit an error event with a wrapped Error.
   */
  private emitError(message: string, cause: unknown): void {
    const error =
      cause instanceof Error
        ? new Error(`${message}: ${cause.message}`)
        : new Error(message);
    this.emit('error', error);
  }
}
