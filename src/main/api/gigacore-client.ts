// ============================================================================
// GigaCore Command — Unified REST API Client
// Handles both Gen1 (HTTP GET/POST) and Gen2 (REST JSON) GigaCore switches.
// Runs in the Electron main process.
// ============================================================================

import axios, { AxiosInstance, AxiosError } from 'axios';
import FormData from 'form-data';

import {
  ApiError,
  ApiErrorCode,
  SwitchSystemInfo,
  PortInfo,
  PortSpeed,
  GroupConfig,
  PoeSummary,
  PoePriority,
  IgmpConfig,
  SwitchProfileSlot,
  LldpNeighborInfo,
  PortStatistics,
  IpConfig,
  RequestLogHook,
} from './api-types';

// ---------------------------------------------------------------------------
// Gen1 model identifiers (used in auto-detection)
// ---------------------------------------------------------------------------
const GEN1_MODELS = new Set([
  'GigaCore 12',
  'GigaCore 14R',
  'GigaCore 16Xt',
  'GigaCore 16RFO',
  'GC 12',
  'GC 14R',
  'GC 16Xt',
  'GC 16RFO',
]);

// ---------------------------------------------------------------------------
// Rate limiting — at most 3 concurrent requests per switch
// ---------------------------------------------------------------------------
class SimpleRateLimiter {
  private active = 0;
  private waiting: Array<() => void> = [];

  constructor(private maxConcurrent: number = 3) {}

  async acquire(): Promise<void> {
    if (this.active < this.maxConcurrent) {
      this.active++;
      return;
    }
    return new Promise<void>((resolve) => {
      this.waiting.push(() => {
        this.active++;
        resolve();
      });
    });
  }

  release(): void {
    this.active--;
    const next = this.waiting.shift();
    if (next) next();
  }
}

// ---------------------------------------------------------------------------
// GigaCoreClient
// ---------------------------------------------------------------------------

export class GigaCoreClient {
  private httpClient: AxiosInstance;
  private baseUrl: string;
  private generation: 1 | 2;
  private ip: string;
  private credentials?: { username: string; password: string };
  private rateLimiter = new SimpleRateLimiter(3);
  private logHook?: RequestLogHook;

  constructor(
    ip: string,
    options?: {
      generation?: 1 | 2;
      username?: string;
      password?: string;
      timeoutMs?: number;
      logHook?: RequestLogHook;
    },
  ) {
    this.ip = ip;
    this.baseUrl = `http://${ip}`;
    this.generation = options?.generation || 2;
    this.logHook = options?.logHook;
    this.credentials = options?.username
      ? { username: options.username, password: options.password || '' }
      : undefined;

    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      timeout: options?.timeoutMs || 5000,
      auth: this.credentials
        ? { username: this.credentials.username, password: this.credentials.password }
        : undefined,
    });
  }

  // =========================================================================
  // Generation detection
  // =========================================================================

  /**
   * Probe the switch to determine whether it speaks Gen2 REST or Gen1 HTTP.
   * Updates the internal `generation` field and returns it.
   */
  async detectGeneration(): Promise<1 | 2> {
    try {
      const res = await this.httpClient.get('/api/system', {
        timeout: 3000,
        validateStatus: () => true,
      });
      if (res.status === 200 && res.data && typeof res.data === 'object') {
        this.generation = 2;
        return 2;
      }
    } catch {
      // Gen2 endpoint unreachable — try Gen1
    }

    try {
      const res = await this.httpClient.get('/command', {
        params: { cmd: 'get_sysinfo' },
        timeout: 3000,
        validateStatus: () => true,
      });
      if (res.status === 200) {
        this.generation = 1;
        return 1;
      }
    } catch {
      // Neither endpoint responded
    }

    throw new ApiError(
      `Unable to detect switch generation at ${this.ip}`,
      ApiErrorCode.NETWORK_ERROR,
      this.ip,
    );
  }

  // =========================================================================
  // System
  // =========================================================================

  async getSystemInfo(): Promise<SwitchSystemInfo> {
    if (this.generation === 2) {
      const data = await this.gen2Get<any>('/api/system');
      return {
        name: data.name ?? data.systemName ?? '',
        model: data.model ?? '',
        firmware: data.firmware ?? data.firmwareVersion ?? '',
        mac: data.mac ?? data.macAddress ?? '',
        serial: data.serial ?? data.serialNumber ?? '',
        generation: 2,
        uptime: data.uptime ?? 0,
        temperature: data.temperature,
      };
    }

    const raw = await this.gen1Command('get_sysinfo');
    return this.parseGen1SystemInfo(raw);
  }

  async setSystemName(name: string): Promise<void> {
    if (this.generation === 2) {
      await this.gen2Put('/api/system', { name });
    } else {
      await this.gen1Command('set_sysname', { name });
    }
  }

  async reboot(): Promise<void> {
    if (this.generation === 2) {
      await this.gen2Post('/api/system/reboot');
    } else {
      await this.gen1Command('reboot');
    }
  }

  async factoryReset(): Promise<void> {
    if (this.generation === 2) {
      await this.gen2Post('/api/system/factory-reset');
    } else {
      await this.gen1Command('factory_reset');
    }
  }

  // =========================================================================
  // Ports
  // =========================================================================

  async getPorts(): Promise<PortInfo[]> {
    if (this.generation === 2) {
      const data = await this.gen2Get<any>('/api/ports');
      const ports: any[] = Array.isArray(data) ? data : data.ports ?? [];
      return ports.map((p: any) => this.mapGen2Port(p));
    }

    const raw = await this.gen1Command('get_ports');
    return this.parseGen1Ports(raw);
  }

  async getPort(portNumber: number): Promise<PortInfo> {
    if (this.generation === 2) {
      const data = await this.gen2Get<any>(`/api/ports/${portNumber}`);
      return this.mapGen2Port(data);
    }

    const ports = await this.getPorts();
    const port = ports.find((p) => p.port === portNumber);
    if (!port) {
      throw new ApiError(
        `Port ${portNumber} not found`,
        ApiErrorCode.NOT_FOUND,
        this.ip,
      );
    }
    return port;
  }

  async setPortEnabled(port: number, enabled: boolean): Promise<void> {
    if (this.generation === 2) {
      await this.gen2Put(`/api/ports/${port}`, {
        adminStatus: enabled ? 'up' : 'down',
      });
    } else {
      await this.gen1Command('set_port', {
        port: String(port),
        enabled: enabled ? '1' : '0',
      });
    }
  }

  async setPortLabel(port: number, label: string): Promise<void> {
    if (this.generation === 2) {
      await this.gen2Put(`/api/ports/${port}`, { label });
    } else {
      await this.gen1Command('set_port_label', {
        port: String(port),
        label,
      });
    }
  }

  async setPortSpeed(port: number, speed: PortSpeed): Promise<void> {
    if (this.generation === 2) {
      await this.gen2Put(`/api/ports/${port}`, { speed });
    } else {
      await this.gen1Command('set_port_speed', {
        port: String(port),
        speed,
      });
    }
  }

  async setPortGroup(port: number, groupId: number): Promise<void> {
    if (this.generation === 2) {
      await this.gen2Put(`/api/ports/${port}`, {
        groupId,
        vlanMode: 'access',
      });
    } else {
      await this.gen1Command('set_port_group', {
        port: String(port),
        group: String(groupId),
      });
    }
  }

  async setPortTrunk(port: number, groupIds: number[]): Promise<void> {
    if (this.generation === 2) {
      await this.gen2Put(`/api/ports/${port}`, {
        vlanMode: 'trunk',
        trunkGroups: groupIds,
      });
    } else {
      await this.gen1Command('set_port_trunk', {
        port: String(port),
        groups: groupIds.join(','),
      });
    }
  }

  // =========================================================================
  // Groups (VLANs)
  // =========================================================================

  async getGroups(): Promise<GroupConfig[]> {
    if (this.generation === 2) {
      const data = await this.gen2Get<any>('/api/groups');
      const groups: any[] = Array.isArray(data) ? data : data.groups ?? [];
      return groups.map((g: any) => this.mapGen2Group(g));
    }

    const raw = await this.gen1Command('get_groups');
    return this.parseGen1Groups(raw);
  }

  async getGroup(id: number): Promise<GroupConfig> {
    if (this.generation === 2) {
      const data = await this.gen2Get<any>(`/api/groups/${id}`);
      return this.mapGen2Group(data);
    }

    const groups = await this.getGroups();
    const group = groups.find((g) => g.id === id);
    if (!group) {
      throw new ApiError(
        `Group ${id} not found`,
        ApiErrorCode.NOT_FOUND,
        this.ip,
      );
    }
    return group;
  }

  async setGroup(id: number, config: Partial<GroupConfig>): Promise<void> {
    if (this.generation === 2) {
      await this.gen2Put(`/api/groups/${id}`, config);
    } else {
      const params: Record<string, string> = { group: String(id) };
      if (config.name !== undefined) params.name = config.name;
      if (config.vlanId !== undefined) params.vlan = String(config.vlanId);
      if (config.color !== undefined) params.color = config.color;
      if (config.igmpSnooping !== undefined)
        params.igmp_snoop = config.igmpSnooping ? '1' : '0';
      if (config.igmpQuerier !== undefined)
        params.igmp_querier = config.igmpQuerier ? '1' : '0';
      if (config.unknownFlooding !== undefined)
        params.flood = config.unknownFlooding ? '1' : '0';
      await this.gen1Command('set_group', params);
    }
  }

  async createGroup(config: Omit<GroupConfig, 'id'>): Promise<GroupConfig> {
    if (this.generation === 2) {
      return this.mapGen2Group(
        await this.gen2Post<any>('/api/groups', config),
      );
    }

    throw new ApiError(
      'Gen1 switches do not support dynamic group creation',
      ApiErrorCode.UNSUPPORTED_OPERATION,
      this.ip,
    );
  }

  // =========================================================================
  // PoE
  // =========================================================================

  async getPoeSummary(): Promise<PoeSummary> {
    if (this.generation === 2) {
      const data = await this.gen2Get<any>('/api/poe');
      return {
        available: data.available ?? true,
        totalBudgetWatts: data.totalBudgetWatts ?? data.budget ?? 0,
        totalDrawWatts: data.totalDrawWatts ?? data.draw ?? 0,
        ports: (data.ports ?? []).map((p: any) => ({
          port: p.port,
          enabled: p.enabled ?? false,
          status: p.status ?? 'disabled',
          watts: p.watts ?? 0,
          maxWatts: p.maxWatts ?? 0,
          poeClass: p.poeClass ?? 0,
        })),
      };
    }

    const raw = await this.gen1Command('get_poe');
    return this.parseGen1Poe(raw);
  }

  async setPortPoe(port: number, enabled: boolean): Promise<void> {
    if (this.generation === 2) {
      await this.gen2Put(`/api/poe/ports/${port}`, { enabled });
    } else {
      await this.gen1Command('set_poe', {
        port: String(port),
        enabled: enabled ? '1' : '0',
      });
    }
  }

  async setPortPoePriority(port: number, priority: PoePriority): Promise<void> {
    if (this.generation === 2) {
      await this.gen2Put(`/api/poe/ports/${port}`, { priority });
    } else {
      await this.gen1Command('set_poe_priority', {
        port: String(port),
        priority,
      });
    }
  }

  // =========================================================================
  // IGMP
  // =========================================================================

  async getIgmpConfig(): Promise<IgmpConfig> {
    if (this.generation === 2) {
      const data = await this.gen2Get<any>('/api/igmp');
      return {
        globalEnabled: data.globalEnabled ?? data.enabled ?? false,
        perGroup: (data.perGroup ?? data.groups ?? []).map((g: any) => ({
          groupId: g.groupId ?? g.id,
          snoopingEnabled: g.snoopingEnabled ?? g.snooping ?? false,
          querierEnabled: g.querierEnabled ?? g.querier ?? false,
          querierIp: g.querierIp,
          queryInterval: g.queryInterval,
        })),
      };
    }

    const raw = await this.gen1Command('get_igmp');
    return this.parseGen1Igmp(raw);
  }

  async setIgmpSnooping(groupId: number, enabled: boolean): Promise<void> {
    if (this.generation === 2) {
      await this.gen2Put(`/api/igmp/groups/${groupId}`, {
        snoopingEnabled: enabled,
      });
    } else {
      await this.gen1Command('set_igmp_snoop', {
        group: String(groupId),
        enabled: enabled ? '1' : '0',
      });
    }
  }

  async setIgmpQuerier(groupId: number, enabled: boolean): Promise<void> {
    if (this.generation === 2) {
      await this.gen2Put(`/api/igmp/groups/${groupId}`, {
        querierEnabled: enabled,
      });
    } else {
      await this.gen1Command('set_igmp_querier', {
        group: String(groupId),
        enabled: enabled ? '1' : '0',
      });
    }
  }

  // =========================================================================
  // Profiles
  // =========================================================================

  async getProfiles(): Promise<SwitchProfileSlot[]> {
    if (this.generation === 2) {
      const data = await this.gen2Get<any>('/api/profiles');
      const slots: any[] = Array.isArray(data) ? data : data.profiles ?? [];
      return slots.map((s: any) => ({
        slot: s.slot,
        name: s.name ?? '',
        isEmpty: s.isEmpty ?? s.empty ?? true,
        lastStored: s.lastStored,
      }));
    }

    const raw = await this.gen1Command('get_profiles');
    return this.parseGen1Profiles(raw);
  }

  async recallProfile(slot: number): Promise<void> {
    if (this.generation === 2) {
      await this.gen2Post(`/api/profiles/${slot}/recall`);
    } else {
      await this.gen1Command('recall_profile', { slot: String(slot) });
    }
  }

  async storeProfile(slot: number, name?: string): Promise<void> {
    if (this.generation === 2) {
      await this.gen2Post(`/api/profiles/${slot}/store`, name ? { name } : undefined);
    } else {
      const params: Record<string, string> = { slot: String(slot) };
      if (name) params.name = name;
      await this.gen1Command('store_profile', params);
    }
  }

  // =========================================================================
  // LLDP
  // =========================================================================

  async getLldpNeighbors(): Promise<LldpNeighborInfo[]> {
    if (this.generation === 2) {
      const data = await this.gen2Get<any>('/api/lldp');
      const neighbors: any[] = Array.isArray(data)
        ? data
        : data.neighbors ?? [];
      return neighbors.map((n: any) => ({
        localPort: n.localPort ?? n.port,
        chassisId: n.chassisId ?? '',
        portId: n.portId ?? '',
        portDescription: n.portDescription,
        systemName: n.systemName,
        systemDescription: n.systemDescription,
        managementAddress: n.managementAddress,
        capabilities: n.capabilities,
      }));
    }

    const raw = await this.gen1Command('get_lldp');
    return this.parseGen1Lldp(raw);
  }

  // =========================================================================
  // Port Statistics
  // =========================================================================

  async getPortStats(): Promise<PortStatistics[]> {
    if (this.generation === 2) {
      const data = await this.gen2Get<any>('/api/ports/statistics');
      const stats: any[] = Array.isArray(data) ? data : data.statistics ?? [];
      return stats.map((s: any) => ({
        port: s.port,
        txBytes: s.txBytes ?? 0,
        rxBytes: s.rxBytes ?? 0,
        txPackets: s.txPackets ?? 0,
        rxPackets: s.rxPackets ?? 0,
        txBroadcast: s.txBroadcast ?? 0,
        rxBroadcast: s.rxBroadcast ?? 0,
        txMulticast: s.txMulticast ?? 0,
        rxMulticast: s.rxMulticast ?? 0,
        crcErrors: s.crcErrors ?? 0,
        collisions: s.collisions ?? 0,
        drops: s.drops ?? 0,
      }));
    }

    const raw = await this.gen1Command('get_port_stats');
    return this.parseGen1PortStats(raw);
  }

  // =========================================================================
  // Firmware
  // =========================================================================

  async getFirmwareVersion(): Promise<string> {
    const info = await this.getSystemInfo();
    return info.firmware;
  }

  async uploadFirmware(
    firmwareBuffer: Buffer,
    onProgress?: (pct: number) => void,
  ): Promise<void> {
    await this.rateLimiter.acquire();
    const start = Date.now();

    try {
      if (this.generation === 2) {
        const form = new FormData();
        form.append('firmware', firmwareBuffer, {
          filename: 'firmware.bin',
          contentType: 'application/octet-stream',
        });

        await this.httpClient.post('/api/system/firmware', form, {
          headers: form.getHeaders(),
          timeout: 300_000, // 5 minutes for firmware upload
          onUploadProgress: (progressEvent) => {
            if (onProgress && progressEvent.total) {
              const pct = Math.round(
                (progressEvent.loaded / progressEvent.total) * 100,
              );
              onProgress(pct);
            }
          },
        });
      } else {
        const form = new FormData();
        form.append('file', firmwareBuffer, {
          filename: 'firmware.bin',
          contentType: 'application/octet-stream',
        });

        await this.httpClient.post('/firmware_upload', form, {
          headers: form.getHeaders(),
          timeout: 300_000,
          onUploadProgress: (progressEvent) => {
            if (onProgress && progressEvent.total) {
              const pct = Math.round(
                (progressEvent.loaded / progressEvent.total) * 100,
              );
              onProgress(pct);
            }
          },
        });
      }

      this.logRequest('POST', '/api/system/firmware', Date.now() - start, 200);
    } catch (err) {
      this.logRequest(
        'POST',
        '/api/system/firmware',
        Date.now() - start,
        undefined,
        err,
      );
      throw this.wrapError(err, 'Firmware upload failed');
    } finally {
      this.rateLimiter.release();
    }
  }

  // =========================================================================
  // IP Configuration
  // =========================================================================

  async getIpConfig(): Promise<IpConfig> {
    if (this.generation === 2) {
      const data = await this.gen2Get<any>('/api/system/network');
      return {
        ip: data.ip ?? data.ipAddress ?? '',
        subnet: data.subnet ?? data.subnetMask ?? '',
        gateway: data.gateway ?? '',
        dhcp: data.dhcp ?? false,
      };
    }

    const raw = await this.gen1Command('get_ipconfig');
    return this.parseGen1IpConfig(raw);
  }

  async setIpConfig(config: Partial<IpConfig>): Promise<void> {
    if (this.generation === 2) {
      await this.gen2Put('/api/system/network', config);
    } else {
      const params: Record<string, string> = {};
      if (config.ip !== undefined) params.ip = config.ip;
      if (config.subnet !== undefined) params.subnet = config.subnet;
      if (config.gateway !== undefined) params.gateway = config.gateway;
      if (config.dhcp !== undefined) params.dhcp = config.dhcp ? '1' : '0';
      await this.gen1Command('set_ipconfig', params);
    }
  }

  // =========================================================================
  // Accessors
  // =========================================================================

  get switchIp(): string {
    return this.ip;
  }

  get switchGeneration(): 1 | 2 {
    return this.generation;
  }

  /** Attach a logging hook for every request/response cycle. */
  setLogHook(hook: RequestLogHook): void {
    this.logHook = hook;
  }

  // =========================================================================
  // Gen2 HTTP helpers (JSON REST)
  // =========================================================================

  private async gen2Get<T>(endpoint: string): Promise<T> {
    await this.rateLimiter.acquire();
    const start = Date.now();

    try {
      const res = await this.httpClient.get<T>(endpoint);
      this.logRequest('GET', endpoint, Date.now() - start, res.status);
      return res.data;
    } catch (err) {
      this.logRequest('GET', endpoint, Date.now() - start, undefined, err);

      // Fallback: if Gen2 returns 404 and we haven't explicitly set generation,
      // the switch might actually be Gen1.
      if (this.isNotFoundError(err)) {
        throw new ApiError(
          `Endpoint ${endpoint} not found — switch may be Gen1`,
          ApiErrorCode.NOT_FOUND,
          this.ip,
          404,
        );
      }
      throw this.wrapError(err, `GET ${endpoint} failed`);
    } finally {
      this.rateLimiter.release();
    }
  }

  private async gen2Put<T>(endpoint: string, data: any): Promise<T> {
    await this.rateLimiter.acquire();
    const start = Date.now();

    try {
      const res = await this.httpClient.put<T>(endpoint, data);
      this.logRequest('PUT', endpoint, Date.now() - start, res.status);
      return res.data;
    } catch (err) {
      this.logRequest('PUT', endpoint, Date.now() - start, undefined, err);
      throw this.wrapError(err, `PUT ${endpoint} failed`);
    } finally {
      this.rateLimiter.release();
    }
  }

  private async gen2Post<T>(endpoint: string, data?: any): Promise<T> {
    await this.rateLimiter.acquire();
    const start = Date.now();

    try {
      const res = await this.httpClient.post<T>(endpoint, data);
      this.logRequest('POST', endpoint, Date.now() - start, res.status);
      return res.data;
    } catch (err) {
      this.logRequest('POST', endpoint, Date.now() - start, undefined, err);
      throw this.wrapError(err, `POST ${endpoint} failed`);
    } finally {
      this.rateLimiter.release();
    }
  }

  // =========================================================================
  // Gen1 HTTP helper (query-parameter commands)
  // =========================================================================

  private async gen1Command(
    command: string,
    params?: Record<string, string>,
  ): Promise<string> {
    await this.rateLimiter.acquire();
    const start = Date.now();

    try {
      const res = await this.httpClient.get('/command', {
        params: { cmd: command, ...params },
        responseType: 'text',
      });
      this.logRequest('GET', `/command?cmd=${command}`, Date.now() - start, res.status);
      return typeof res.data === 'string' ? res.data : String(res.data);
    } catch (err) {
      this.logRequest(
        'GET',
        `/command?cmd=${command}`,
        Date.now() - start,
        undefined,
        err,
      );
      throw this.wrapError(err, `Gen1 command '${command}' failed`);
    } finally {
      this.rateLimiter.release();
    }
  }

  // =========================================================================
  // Gen2 response mapping helpers
  // =========================================================================

  private mapGen2Port(p: any): PortInfo {
    return {
      port: p.port ?? p.id ?? 0,
      label: p.label ?? p.name ?? '',
      adminStatus: p.adminStatus ?? 'down',
      operStatus: p.operStatus ?? p.linkStatus ?? 'down',
      speed: p.speed ?? '',
      duplex: p.duplex ?? 'full',
      type: p.type ?? p.mediaType ?? 'copper',
      groupId: p.groupId ?? p.group,
      vlanMode: p.vlanMode,
      trunkGroups: p.trunkGroups,
      poeEnabled: p.poeEnabled,
      poeStatus: p.poeStatus,
      poeWatts: p.poeWatts,
      poeClass: p.poeClass,
      lldpNeighbor: p.lldpNeighbor
        ? {
            name: p.lldpNeighbor.name ?? p.lldpNeighbor.systemName ?? '',
            mac: p.lldpNeighbor.mac ?? p.lldpNeighbor.chassisId ?? '',
            portDesc: p.lldpNeighbor.portDesc ?? p.lldpNeighbor.portDescription ?? '',
          }
        : undefined,
    };
  }

  private mapGen2Group(g: any): GroupConfig {
    return {
      id: g.id ?? 0,
      name: g.name ?? '',
      vlanId: g.vlanId ?? g.vlan ?? 0,
      color: g.color ?? '#808080',
      igmpSnooping: g.igmpSnooping ?? false,
      igmpQuerier: g.igmpQuerier ?? false,
      unknownFlooding: g.unknownFlooding ?? g.flooding ?? false,
    };
  }

  // =========================================================================
  // Gen1 response parsers
  // =========================================================================

  /**
   * Gen1 responses are typically semicolon- or newline-delimited key=value
   * pairs, or simple HTML tables. These parsers handle the common formats.
   */

  private parseGen1KeyValue(raw: string): Record<string, string> {
    const result: Record<string, string> = {};
    // Try semicolon-delimited first, then newline-delimited
    const parts = raw.includes(';') ? raw.split(';') : raw.split('\n');
    for (const part of parts) {
      const eqIdx = part.indexOf('=');
      if (eqIdx > 0) {
        const key = part.substring(0, eqIdx).trim();
        const value = part.substring(eqIdx + 1).trim();
        result[key] = value;
      }
    }
    return result;
  }

  private parseGen1SystemInfo(raw: string): SwitchSystemInfo {
    const kv = this.parseGen1KeyValue(raw);
    return {
      name: kv['name'] ?? kv['sysname'] ?? '',
      model: kv['model'] ?? '',
      firmware: kv['firmware'] ?? kv['fw'] ?? '',
      mac: kv['mac'] ?? '',
      serial: kv['serial'] ?? '',
      generation: 1,
      uptime: parseInt(kv['uptime'] ?? '0', 10) || 0,
      temperature: kv['temp'] ? parseFloat(kv['temp']) : undefined,
    };
  }

  private parseGen1Ports(raw: string): PortInfo[] {
    const ports: PortInfo[] = [];
    const lines = raw.split('\n').filter((l) => l.trim().length > 0);

    for (const line of lines) {
      const kv = this.parseGen1KeyValue(line);
      if (kv['port'] === undefined) continue;

      ports.push({
        port: parseInt(kv['port'], 10),
        label: kv['label'] ?? '',
        adminStatus: kv['admin'] === '1' || kv['admin'] === 'up' ? 'up' : 'down',
        operStatus: kv['link'] === '1' || kv['link'] === 'up' ? 'up' : 'down',
        speed: kv['speed'] ?? 'auto',
        duplex: kv['duplex'] ?? 'full',
        type: (kv['type'] as PortInfo['type']) ?? 'copper',
        groupId: kv['group'] ? parseInt(kv['group'], 10) : undefined,
        vlanMode: kv['mode'] as PortInfo['vlanMode'],
        trunkGroups: kv['trunk']
          ? kv['trunk'].split(',').map(Number)
          : undefined,
      });
    }
    return ports;
  }

  private parseGen1Groups(raw: string): GroupConfig[] {
    const groups: GroupConfig[] = [];
    const lines = raw.split('\n').filter((l) => l.trim().length > 0);

    for (const line of lines) {
      const kv = this.parseGen1KeyValue(line);
      if (kv['id'] === undefined && kv['group'] === undefined) continue;

      groups.push({
        id: parseInt(kv['id'] ?? kv['group'] ?? '0', 10),
        name: kv['name'] ?? '',
        vlanId: parseInt(kv['vlan'] ?? '0', 10),
        color: kv['color'] ?? '#808080',
        igmpSnooping: kv['igmp_snoop'] === '1',
        igmpQuerier: kv['igmp_querier'] === '1',
        unknownFlooding: kv['flood'] !== '0',
      });
    }
    return groups;
  }

  private parseGen1Poe(raw: string): PoeSummary {
    const kv = this.parseGen1KeyValue(raw);
    const lines = raw.split('\n').filter((l) => l.trim().length > 0);

    const ports: PoeSummary['ports'] = [];
    for (const line of lines) {
      const pkv = this.parseGen1KeyValue(line);
      if (pkv['port'] === undefined) continue;
      ports.push({
        port: parseInt(pkv['port'], 10),
        enabled: pkv['enabled'] === '1',
        status: pkv['status'] ?? 'disabled',
        watts: parseFloat(pkv['watts'] ?? '0'),
        maxWatts: parseFloat(pkv['max_watts'] ?? '0'),
        poeClass: parseInt(pkv['class'] ?? '0', 10),
      });
    }

    return {
      available: kv['available'] !== '0',
      totalBudgetWatts: parseFloat(kv['budget'] ?? '0'),
      totalDrawWatts: parseFloat(kv['draw'] ?? '0'),
      ports,
    };
  }

  private parseGen1Igmp(raw: string): IgmpConfig {
    const kv = this.parseGen1KeyValue(raw);
    const lines = raw.split('\n').filter((l) => l.trim().length > 0);

    const perGroup: IgmpConfig['perGroup'] = [];
    for (const line of lines) {
      const gkv = this.parseGen1KeyValue(line);
      if (gkv['group'] === undefined) continue;
      perGroup.push({
        groupId: parseInt(gkv['group'], 10),
        snoopingEnabled: gkv['snooping'] === '1',
        querierEnabled: gkv['querier'] === '1',
        querierIp: gkv['querier_ip'],
        queryInterval: gkv['interval']
          ? parseInt(gkv['interval'], 10)
          : undefined,
      });
    }

    return {
      globalEnabled: kv['enabled'] === '1' || kv['igmp'] === '1',
      perGroup,
    };
  }

  private parseGen1Profiles(raw: string): SwitchProfileSlot[] {
    const slots: SwitchProfileSlot[] = [];
    const lines = raw.split('\n').filter((l) => l.trim().length > 0);

    for (const line of lines) {
      const kv = this.parseGen1KeyValue(line);
      if (kv['slot'] === undefined) continue;
      slots.push({
        slot: parseInt(kv['slot'], 10),
        name: kv['name'] ?? '',
        isEmpty: kv['empty'] === '1' || kv['name'] === '',
        lastStored: kv['stored'] || undefined,
      });
    }
    return slots;
  }

  private parseGen1Lldp(raw: string): LldpNeighborInfo[] {
    const neighbors: LldpNeighborInfo[] = [];
    const lines = raw.split('\n').filter((l) => l.trim().length > 0);

    for (const line of lines) {
      const kv = this.parseGen1KeyValue(line);
      if (kv['port'] === undefined) continue;
      neighbors.push({
        localPort: parseInt(kv['port'], 10),
        chassisId: kv['chassis_id'] ?? '',
        portId: kv['port_id'] ?? '',
        portDescription: kv['port_desc'],
        systemName: kv['sys_name'],
        systemDescription: kv['sys_desc'],
        managementAddress: kv['mgmt_addr'],
        capabilities: kv['caps'] ? kv['caps'].split(',') : undefined,
      });
    }
    return neighbors;
  }

  private parseGen1PortStats(raw: string): PortStatistics[] {
    const stats: PortStatistics[] = [];
    const lines = raw.split('\n').filter((l) => l.trim().length > 0);

    for (const line of lines) {
      const kv = this.parseGen1KeyValue(line);
      if (kv['port'] === undefined) continue;
      stats.push({
        port: parseInt(kv['port'], 10),
        txBytes: parseInt(kv['tx_bytes'] ?? '0', 10),
        rxBytes: parseInt(kv['rx_bytes'] ?? '0', 10),
        txPackets: parseInt(kv['tx_packets'] ?? '0', 10),
        rxPackets: parseInt(kv['rx_packets'] ?? '0', 10),
        txBroadcast: parseInt(kv['tx_bcast'] ?? '0', 10),
        rxBroadcast: parseInt(kv['rx_bcast'] ?? '0', 10),
        txMulticast: parseInt(kv['tx_mcast'] ?? '0', 10),
        rxMulticast: parseInt(kv['rx_mcast'] ?? '0', 10),
        crcErrors: parseInt(kv['crc_err'] ?? '0', 10),
        collisions: parseInt(kv['collisions'] ?? '0', 10),
        drops: parseInt(kv['drops'] ?? '0', 10),
      });
    }
    return stats;
  }

  private parseGen1IpConfig(raw: string): IpConfig {
    const kv = this.parseGen1KeyValue(raw);
    return {
      ip: kv['ip'] ?? '',
      subnet: kv['subnet'] ?? kv['mask'] ?? '',
      gateway: kv['gateway'] ?? kv['gw'] ?? '',
      dhcp: kv['dhcp'] === '1',
    };
  }

  // =========================================================================
  // Error handling
  // =========================================================================

  private wrapError(err: unknown, context: string): ApiError {
    if (err instanceof ApiError) return err;

    const axiosErr = err as AxiosError;

    if (axiosErr.code === 'ECONNABORTED' || axiosErr.code === 'ETIMEDOUT') {
      return new ApiError(
        `${context}: request timed out`,
        ApiErrorCode.TIMEOUT,
        this.ip,
      );
    }

    if (!axiosErr.response) {
      return new ApiError(
        `${context}: ${axiosErr.message ?? 'network error'}`,
        ApiErrorCode.NETWORK_ERROR,
        this.ip,
      );
    }

    const status = axiosErr.response.status;

    if (status === 401 || status === 403) {
      return new ApiError(
        `${context}: authentication failed`,
        ApiErrorCode.AUTH_FAILED,
        this.ip,
        status,
      );
    }

    if (status === 404) {
      return new ApiError(
        `${context}: endpoint not found`,
        ApiErrorCode.NOT_FOUND,
        this.ip,
        status,
      );
    }

    if (status === 429) {
      return new ApiError(
        `${context}: rate limited by switch`,
        ApiErrorCode.RATE_LIMITED,
        this.ip,
        status,
      );
    }

    return new ApiError(
      `${context}: HTTP ${status}`,
      ApiErrorCode.SWITCH_ERROR,
      this.ip,
      status,
    );
  }

  private isNotFoundError(err: unknown): boolean {
    const axiosErr = err as AxiosError;
    return axiosErr.response?.status === 404;
  }

  // =========================================================================
  // Logging
  // =========================================================================

  private logRequest(
    method: string,
    url: string,
    durationMs: number,
    statusCode?: number,
    error?: unknown,
  ): void {
    if (!this.logHook) return;

    this.logHook({
      method,
      url: `${this.baseUrl}${url}`,
      switchIp: this.ip,
      generation: this.generation,
      durationMs,
      statusCode,
      error: error instanceof Error ? error.message : error ? String(error) : undefined,
    });
  }
}
