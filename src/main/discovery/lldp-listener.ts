/**
 * LLDP (Link Layer Discovery Protocol) listener.
 *
 * Retrieves LLDP neighbor tables from GigaCore switches via their
 * REST API and builds a topology map showing how switches are
 * interconnected.
 */

import axios, { type AxiosInstance } from 'axios';
import type { LldpNeighbor, TopologyLink } from './types';

export class LldpListener {
  private httpClient: AxiosInstance;

  constructor() {
    this.httpClient = axios.create({
      timeout: 5000,
      validateStatus: () => true,
    });
  }

  /**
   * Fetch LLDP neighbor information from a single switch via its REST API.
   *
   * Tries the Gen2 endpoint first (`/api/lldp/neighbors`), then falls
   * back to the Gen1 endpoint (`/lldp_neighbors.json` or similar).
   */
  async getNeighbors(switchIp: string): Promise<LldpNeighbor[]> {
    // ── Gen2 API ────────────────────────────────────────────────────────
    try {
      const res = await this.httpClient.get(
        `http://${switchIp}/api/lldp/neighbors`,
      );

      if (res.status === 200 && res.data) {
        return this.parseGen2Neighbors(res.data);
      }
    } catch {
      // Gen2 endpoint not available
    }

    // ── Gen1 API (legacy) ───────────────────────────────────────────────
    try {
      const res = await this.httpClient.get(
        `http://${switchIp}/lldp_neighbors.json`,
      );

      if (res.status === 200 && res.data) {
        return this.parseGen1Neighbors(res.data);
      }
    } catch {
      // Gen1 endpoint not available
    }

    // ── Alternative Gen1 path ───────────────────────────────────────────
    try {
      const res = await this.httpClient.get(
        `http://${switchIp}/api/lldp`,
      );

      if (res.status === 200 && res.data) {
        return this.parseGen2Neighbors(res.data);
      }
    } catch {
      // No LLDP data available from this switch
    }

    return [];
  }

  /**
   * Query every switch in the list for LLDP neighbors and build a
   * deduplicated set of topology links.
   *
   * A link between switch A port 3 and switch B port 7 will appear
   * only once, not twice (once from each side).
   */
  async buildTopology(switchIps: string[]): Promise<TopologyLink[]> {
    // Gather all neighbor tables in parallel
    const neighborTables = await Promise.all(
      switchIps.map(async (ip) => {
        try {
          const neighbors = await this.getNeighbors(ip);
          return { ip, neighbors };
        } catch {
          return { ip, neighbors: [] as LldpNeighbor[] };
        }
      }),
    );

    // Build a set of known switch management addresses for matching
    const switchIpSet = new Set(switchIps);

    // Collect all links
    const links: TopologyLink[] = [];
    const seen = new Set<string>();

    for (const { ip: sourceIp, neighbors } of neighborTables) {
      for (const neighbor of neighbors) {
        // Determine the remote switch IP — prefer management address,
        // fall back to chassis ID if it looks like an IP
        const remoteIp = this.resolveRemoteIp(neighbor, switchIpSet);
        if (!remoteIp) continue;

        // Parse remote port number
        const remotePort = this.parsePortNumber(
          neighbor.remotePortId,
          neighbor.remotePortDesc,
        );
        if (remotePort === null) continue;

        // Deduplicate: create a canonical key for the link
        const key = this.linkKey(sourceIp, neighbor.localPort, remoteIp, remotePort);
        if (seen.has(key)) continue;
        seen.add(key);

        // Also mark the reverse direction as seen
        const reverseKey = this.linkKey(remoteIp, remotePort, sourceIp, neighbor.localPort);
        seen.add(reverseKey);

        links.push({
          sourceSwitch: sourceIp,
          sourcePort: neighbor.localPort,
          targetSwitch: remoteIp,
          targetPort: remotePort,
          linkSpeed: this.extractLinkSpeed(neighbor),
        });
      }
    }

    return links;
  }

  // ── Parsers ──────────────────────────────────────────────────────────────

  /**
   * Parse Gen2 API LLDP neighbor response.
   * Expected structure: array of objects or `{ neighbors: [...] }`.
   */
  private parseGen2Neighbors(data: unknown): LldpNeighbor[] {
    const items = this.extractArray(data);
    const neighbors: LldpNeighbor[] = [];

    for (const item of items) {
      if (!item || typeof item !== 'object') continue;
      const obj = item as Record<string, unknown>;

      const localPort = this.toNumber(
        obj.localPort ?? obj.local_port ?? obj.port ?? obj.portIndex,
      );
      if (localPort === null) continue;

      const chassisId = this.toString(
        obj.remoteChassisId ?? obj.remote_chassis_id ?? obj.chassisId ?? obj.chassis_id ?? '',
      );
      const portId = this.toString(
        obj.remotePortId ?? obj.remote_port_id ?? obj.portId ?? obj.port_id ?? '',
      );

      neighbors.push({
        localPort,
        remoteChassisId: chassisId,
        remotePortId: portId,
        remotePortDesc: this.toString(
          obj.remotePortDesc ?? obj.remote_port_desc ?? obj.portDesc ?? obj.port_description,
        ) || undefined,
        remoteSysName: this.toString(
          obj.remoteSysName ?? obj.remote_sys_name ?? obj.sysName ?? obj.system_name,
        ) || undefined,
        remoteSysDesc: this.toString(
          obj.remoteSysDesc ?? obj.remote_sys_desc ?? obj.sysDesc ?? obj.system_description,
        ) || undefined,
        remoteMgmtAddr: this.toString(
          obj.remoteMgmtAddr ?? obj.remote_mgmt_addr ?? obj.mgmtAddr ?? obj.management_address,
        ) || undefined,
      });
    }

    return neighbors;
  }

  /**
   * Parse Gen1 API LLDP neighbor response.
   * Gen1 often uses slightly different field names or nesting.
   */
  private parseGen1Neighbors(data: unknown): LldpNeighbor[] {
    // Gen1 responses often have the same shape — delegate to the Gen2
    // parser which already handles multiple naming conventions
    return this.parseGen2Neighbors(data);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  /**
   * Extract an array of items from various response shapes.
   */
  private extractArray(data: unknown): unknown[] {
    if (Array.isArray(data)) return data;
    if (data && typeof data === 'object') {
      const obj = data as Record<string, unknown>;
      // Common wrapper keys
      for (const key of ['neighbors', 'lldp', 'lldpNeighbors', 'data', 'entries', 'rows']) {
        if (Array.isArray(obj[key])) return obj[key] as unknown[];
      }
    }
    return [];
  }

  /**
   * Try to resolve the remote switch's IP address from an LLDP neighbor record.
   */
  private resolveRemoteIp(
    neighbor: LldpNeighbor,
    knownSwitchIps: Set<string>,
  ): string | null {
    // Management address is the most reliable source
    if (neighbor.remoteMgmtAddr && this.isIpv4(neighbor.remoteMgmtAddr)) {
      return neighbor.remoteMgmtAddr;
    }

    // Chassis ID may be an IP
    if (this.isIpv4(neighbor.remoteChassisId)) {
      return neighbor.remoteChassisId;
    }

    // Try to match system name to a known switch IP
    // (some networks use IP-based naming like "10.0.1.5")
    if (neighbor.remoteSysName && this.isIpv4(neighbor.remoteSysName)) {
      return neighbor.remoteSysName;
    }

    // Check if the management address or chassis ID matches a known switch
    for (const ip of knownSwitchIps) {
      if (
        neighbor.remoteMgmtAddr === ip ||
        neighbor.remoteChassisId === ip
      ) {
        return ip;
      }
    }

    return null;
  }

  /**
   * Parse a port number from LLDP port ID / description fields.
   */
  private parsePortNumber(portId: string, portDesc?: string): number | null {
    // Try direct numeric parse
    const direct = parseInt(portId, 10);
    if (!isNaN(direct) && direct >= 0) return direct;

    // Try extracting number from strings like "port5", "Ethernet1/3", "GigabitEthernet0/5"
    const match = portId.match(/(\d+)\s*$/);
    if (match) return parseInt(match[1], 10);

    // Try the description
    if (portDesc) {
      const descMatch = portDesc.match(/(\d+)\s*$/);
      if (descMatch) return parseInt(descMatch[1], 10);
    }

    return null;
  }

  /**
   * Try to extract link speed from LLDP neighbor data.
   */
  private extractLinkSpeed(neighbor: LldpNeighbor): string | undefined {
    // Link speed may be embedded in the system or port description
    const desc = neighbor.remoteSysDesc ?? neighbor.remotePortDesc ?? '';
    const speedMatch = desc.match(/((?:\d+(?:\.\d+)?)\s*[GMK]bps|(?:\d+(?:\.\d+)?)\s*[GMK](?:bit|b))/i);
    return speedMatch ? speedMatch[0] : undefined;
  }

  /**
   * Create a canonical key for a link (for deduplication).
   */
  private linkKey(
    srcIp: string,
    srcPort: number,
    dstIp: string,
    dstPort: number,
  ): string {
    return `${srcIp}:${srcPort}->${dstIp}:${dstPort}`;
  }

  /**
   * Check if a string is a valid IPv4 address.
   */
  private isIpv4(value: string): boolean {
    return /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(value);
  }

  private toNumber(value: unknown): number | null {
    if (typeof value === 'number' && !isNaN(value)) return value;
    if (typeof value === 'string') {
      const n = parseInt(value, 10);
      if (!isNaN(n)) return n;
    }
    return null;
  }

  private toString(value: unknown): string {
    if (typeof value === 'string') return value;
    if (value === null || value === undefined) return '';
    return String(value);
  }
}
