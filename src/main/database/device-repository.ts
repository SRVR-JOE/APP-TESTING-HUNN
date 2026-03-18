// ============================================================================
// GigaCore Command — Device Repository (CRUD for discovered_devices table)
// ============================================================================

import type Database from 'better-sqlite3';
import { DatabaseManager } from './database';
import { DiscoveredDevice, DiscoveredDeviceInput } from '../../shared/types';

export class DeviceRepository {
  private db: Database.Database;

  private stmtUpsert: Database.Statement;
  private stmtGetAll: Database.Statement;
  private stmtGetBySwitch: Database.Statement;
  private stmtGetByProtocol: Database.Statement;
  private stmtDeleteStale: Database.Statement;

  constructor(private manager: DatabaseManager) {
    this.db = manager.getDb();

    // Upsert keyed on mac + connected_switch_mac + connected_port.
    // If the same device appears on the same switch port, update it;
    // otherwise insert a new row.
    this.stmtUpsert = this.db.prepare(`
      INSERT INTO discovered_devices
        (mac, ip, hostname, manufacturer, protocol, connected_switch_mac, connected_port, link_speed, first_seen, last_seen)
      VALUES
        (@mac, @ip, @hostname, @manufacturer, @protocol, @connected_switch_mac, @connected_port, @link_speed, @first_seen, @last_seen)
      ON CONFLICT(id) DO UPDATE SET
        ip                   = excluded.ip,
        hostname             = excluded.hostname,
        manufacturer         = excluded.manufacturer,
        protocol             = excluded.protocol,
        link_speed           = excluded.link_speed,
        last_seen            = excluded.last_seen
    `);

    this.stmtGetAll = this.db.prepare(
      'SELECT * FROM discovered_devices ORDER BY last_seen DESC',
    );

    this.stmtGetBySwitch = this.db.prepare(
      'SELECT * FROM discovered_devices WHERE connected_switch_mac = ? ORDER BY connected_port ASC',
    );

    this.stmtGetByProtocol = this.db.prepare(
      'SELECT * FROM discovered_devices WHERE protocol = ? ORDER BY last_seen DESC',
    );

    this.stmtDeleteStale = this.db.prepare(
      'DELETE FROM discovered_devices WHERE last_seen < ?',
    );
  }

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------

  /** Insert a device or update it if a row with the same id already exists. */
  upsertDevice(device: DiscoveredDeviceInput): void {
    this.stmtUpsert.run({
      mac: device.mac ?? null,
      ip: device.ip ?? null,
      hostname: device.hostname ?? null,
      manufacturer: device.manufacturer ?? null,
      protocol: device.protocol ?? null,
      connected_switch_mac: device.connected_switch_mac ?? null,
      connected_port: device.connected_port ?? null,
      link_speed: device.link_speed ?? null,
      first_seen: device.first_seen ?? null,
      last_seen: device.last_seen ?? null,
    });
  }

  /** Return every discovered device. */
  getAllDevices(): DiscoveredDevice[] {
    return this.stmtGetAll.all() as DiscoveredDevice[];
  }

  /** Return all devices connected to a particular switch (by MAC). */
  getDevicesBySwitch(switchMac: string): DiscoveredDevice[] {
    return this.stmtGetBySwitch.all(switchMac) as DiscoveredDevice[];
  }

  /** Return all devices discovered via a specific protocol (e.g. 'lldp', 'arp'). */
  getDevicesByProtocol(protocol: string): DiscoveredDevice[] {
    return this.stmtGetByProtocol.all(protocol) as DiscoveredDevice[];
  }

  /**
   * Delete devices whose last_seen timestamp is older than the given date.
   * Returns the number of rows removed.
   */
  deleteStaleDevices(olderThan: Date): number {
    const iso = olderThan.toISOString();
    const result = this.stmtDeleteStale.run(iso);
    return result.changes;
  }
}
