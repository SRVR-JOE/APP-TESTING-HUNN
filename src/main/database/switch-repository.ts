// ============================================================================
// GigaCore Command — Switch Repository (CRUD for switches table)
// ============================================================================

import type Database from 'better-sqlite3';
import { DatabaseManager } from './database';
import { DiscoveredSwitch } from '../../shared/types';

export class SwitchRepository {
  private db: Database.Database;

  // Prepared statements (lazily assigned in constructor)
  private stmtUpsert: Database.Statement;
  private stmtGetAll: Database.Statement;
  private stmtGetById: Database.Statement;
  private stmtGetByIp: Database.Statement;
  private stmtUpdateStatus: Database.Statement;
  private stmtDelete: Database.Statement;
  private stmtMarkAllOffline: Database.Statement;

  constructor(private manager: DatabaseManager) {
    this.db = manager.getDb();

    this.stmtUpsert = this.db.prepare(`
      INSERT INTO switches (id, name, model, ip, subnet, gateway, mac, firmware, generation, serial, rack_group, last_seen, first_seen, is_online)
      VALUES (@id, @name, @model, @ip, @subnet, @gateway, @mac, @firmware, @generation, @serial, @rack_group, @last_seen, @first_seen, @is_online)
      ON CONFLICT(id) DO UPDATE SET
        name            = excluded.name,
        model           = excluded.model,
        ip              = excluded.ip,
        subnet          = excluded.subnet,
        gateway         = excluded.gateway,
        mac             = excluded.mac,
        firmware        = excluded.firmware,
        generation      = excluded.generation,
        serial          = excluded.serial,
        rack_group      = excluded.rack_group,
        last_seen       = excluded.last_seen,
        is_online       = excluded.is_online
    `);

    this.stmtGetAll = this.db.prepare('SELECT * FROM switches ORDER BY name ASC');

    this.stmtGetById = this.db.prepare('SELECT * FROM switches WHERE id = ?');

    this.stmtGetByIp = this.db.prepare('SELECT * FROM switches WHERE ip = ?');

    this.stmtUpdateStatus = this.db.prepare(
      'UPDATE switches SET is_online = ?, last_seen = CURRENT_TIMESTAMP WHERE id = ?',
    );

    this.stmtDelete = this.db.prepare('DELETE FROM switches WHERE id = ?');

    this.stmtMarkAllOffline = this.db.prepare('UPDATE switches SET is_online = 0');
  }

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------

  /** Insert or update a switch (keyed on id). */
  upsertSwitch(sw: DiscoveredSwitch): void {
    this.stmtUpsert.run({
      id: sw.id,
      name: sw.name ?? null,
      model: sw.model ?? null,
      ip: sw.ip ?? null,
      subnet: sw.subnet ?? null,
      gateway: sw.gateway ?? null,
      mac: sw.mac ?? null,
      firmware: sw.firmware ?? null,
      generation: sw.generation ?? null,
      serial: sw.serial ?? null,
      rack_group: sw.rack_group ?? null,
      last_seen: sw.last_seen ?? null,
      first_seen: sw.first_seen ?? null,
      is_online: sw.is_online ? 1 : 0,
    });
  }

  /** Return every switch. */
  getAllSwitches(): DiscoveredSwitch[] {
    const rows = this.stmtGetAll.all() as RawSwitchRow[];
    return rows.map(toDiscoveredSwitch);
  }

  /** Fetch a single switch by primary key. */
  getSwitchById(id: string): DiscoveredSwitch | null {
    const row = this.stmtGetById.get(id) as RawSwitchRow | undefined;
    return row ? toDiscoveredSwitch(row) : null;
  }

  /** Fetch a single switch by its IP address. */
  getSwitchByIp(ip: string): DiscoveredSwitch | null {
    const row = this.stmtGetByIp.get(ip) as RawSwitchRow | undefined;
    return row ? toDiscoveredSwitch(row) : null;
  }

  /** Toggle the online status of a switch. */
  updateSwitchStatus(id: string, isOnline: boolean): void {
    this.stmtUpdateStatus.run(isOnline ? 1 : 0, id);
  }

  /** Remove a switch from the database. */
  deleteSwitch(id: string): void {
    this.stmtDelete.run(id);
  }

  /** Mark every switch as offline — useful at app startup before re-discovery. */
  markAllOffline(): void {
    this.stmtMarkAllOffline.run();
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Raw row shape returned by better-sqlite3 (booleans come back as 0/1). */
interface RawSwitchRow {
  id: string;
  name: string | null;
  model: string | null;
  ip: string | null;
  subnet: string | null;
  gateway: string | null;
  mac: string | null;
  firmware: string | null;
  generation: number | null;
  serial: string | null;
  rack_group: string | null;
  last_seen: string | null;
  first_seen: string | null;
  is_online: number;
}

function toDiscoveredSwitch(row: RawSwitchRow): DiscoveredSwitch {
  return {
    ...row,
    is_online: row.is_online === 1,
  };
}
