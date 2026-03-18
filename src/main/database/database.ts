// ============================================================================
// Luminex Configurator — Core Database Manager (better-sqlite3)
// ============================================================================

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';

export class DatabaseManager {
  private db: Database.Database;

  constructor() {
    const userDataPath = app.getPath('userData');

    // Ensure the userData directory exists (first-run safety)
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }

    const dbPath = path.join(userDataPath, 'luminex-configurator.db');
    this.db = new Database(dbPath);

    // WAL mode for concurrent read performance
    this.db.pragma('journal_mode = WAL');
    // Enable foreign key enforcement
    this.db.pragma('foreign_keys = ON');

    this.initialize();
  }

  // --------------------------------------------------------------------------
  // Schema initialisation — versioned via SQLite user_version pragma
  // --------------------------------------------------------------------------

  private initialize(): void {
    const currentVersion = this.db.pragma('user_version', { simple: true }) as number;

    if (currentVersion < 1) {
      // Run full schema creation
      this.createSchema();
      this.db.pragma('user_version = 1');
    }
  }

  // --------------------------------------------------------------------------
  // Schema creation — idempotent (IF NOT EXISTS) with constraints & indexes
  // --------------------------------------------------------------------------

  private createSchema(): void {
    this.db.exec(`
      -- switches
      CREATE TABLE IF NOT EXISTS switches (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT,
        model TEXT,
        ip TEXT NOT NULL,
        subnet TEXT,
        gateway TEXT,
        mac TEXT NOT NULL UNIQUE,
        firmware TEXT,
        generation INTEGER,
        serial TEXT,
        rack_group TEXT,
        last_seen DATETIME,
        first_seen DATETIME,
        is_online BOOLEAN DEFAULT 1
      );

      -- discovered_devices
      -- NOTE: connected_switch_mac stores the switch ID (which is typically the
      -- MAC address). The FK references switches(id), not switches(mac).
      CREATE TABLE IF NOT EXISTS discovered_devices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mac TEXT,
        ip TEXT,
        hostname TEXT,
        manufacturer TEXT,
        protocol TEXT,
        connected_switch_mac TEXT,
        connected_port INTEGER,
        link_speed TEXT,
        first_seen DATETIME,
        last_seen DATETIME,
        FOREIGN KEY (connected_switch_mac) REFERENCES switches(id) ON DELETE CASCADE
      );

      -- event_log
      CREATE TABLE IF NOT EXISTS event_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        category TEXT,
        severity TEXT NOT NULL,
        switch_mac TEXT,
        switch_name TEXT,
        message TEXT NOT NULL,
        details TEXT,
        FOREIGN KEY (switch_mac) REFERENCES switches(id) ON DELETE CASCADE
      );

      -- port_stats (time-series)
      CREATE TABLE IF NOT EXISTS port_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        switch_mac TEXT,
        port INTEGER,
        tx_bytes INTEGER,
        rx_bytes INTEGER,
        tx_packets INTEGER,
        rx_packets INTEGER,
        tx_broadcast INTEGER,
        rx_broadcast INTEGER,
        tx_multicast INTEGER,
        rx_multicast INTEGER,
        crc_errors INTEGER,
        collisions INTEGER,
        drops INTEGER,
        link_speed TEXT,
        poe_watts REAL,
        FOREIGN KEY (switch_mac) REFERENCES switches(id) ON DELETE CASCADE
      );

      -- rack_groups
      CREATE TABLE IF NOT EXISTS rack_groups (
        id TEXT PRIMARY KEY,
        name TEXT,
        position_x REAL,
        position_y REAL,
        width REAL,
        height REAL,
        color TEXT,
        layout_id TEXT,
        sort_order INTEGER,
        FOREIGN KEY (layout_id) REFERENCES map_layouts(id) ON DELETE SET NULL
      );

      -- rack_switch_positions
      CREATE TABLE IF NOT EXISTS rack_switch_positions (
        switch_mac TEXT,
        rack_group_id TEXT,
        slot_index INTEGER,
        FOREIGN KEY (switch_mac) REFERENCES switches(id) ON DELETE CASCADE,
        FOREIGN KEY (rack_group_id) REFERENCES rack_groups(id) ON DELETE CASCADE,
        PRIMARY KEY (switch_mac, rack_group_id)
      );

      -- map_layouts
      CREATE TABLE IF NOT EXISTS map_layouts (
        id TEXT PRIMARY KEY,
        name TEXT,
        description TEXT,
        created DATETIME,
        modified DATETIME,
        is_active BOOLEAN DEFAULT 0
      );

      -- show_presets
      CREATE TABLE IF NOT EXISTS show_presets (
        id TEXT PRIMARY KEY,
        name TEXT,
        description TEXT,
        created DATETIME,
        config_json TEXT,
        layout_id TEXT,
        FOREIGN KEY (layout_id) REFERENCES map_layouts(id) ON DELETE SET NULL
      );

      -- health_checks
      CREATE TABLE IF NOT EXISTS health_checks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        check_type TEXT,
        switch_mac TEXT,
        status TEXT,
        message TEXT,
        details TEXT,
        FOREIGN KEY (switch_mac) REFERENCES switches(id) ON DELETE CASCADE
      );

      -- ----------------------------------------------------------------
      -- Indexes
      -- ----------------------------------------------------------------

      CREATE INDEX IF NOT EXISTS idx_port_stats_time
        ON port_stats(switch_mac, port, timestamp);

      CREATE INDEX IF NOT EXISTS idx_event_log_time
        ON event_log(timestamp);

      CREATE INDEX IF NOT EXISTS idx_event_log_category
        ON event_log(category);

      CREATE INDEX IF NOT EXISTS idx_event_log_severity
        ON event_log(severity);

      CREATE INDEX IF NOT EXISTS idx_event_log_switch
        ON event_log(switch_mac);

      CREATE INDEX IF NOT EXISTS idx_health_checks_type
        ON health_checks(check_type);

      CREATE INDEX IF NOT EXISTS idx_health_checks_time
        ON health_checks(timestamp);

      -- Composite unique index for device upsert (prevents duplicate device
      -- entries for the same MAC on the same switch port)
      CREATE UNIQUE INDEX IF NOT EXISTS idx_devices_identity
        ON discovered_devices(mac, connected_switch_mac, connected_port);

      -- FK lookup index for discovered_devices -> switches
      CREATE INDEX IF NOT EXISTS idx_devices_switch
        ON discovered_devices(connected_switch_mac);

      -- Support time-range queries on device last_seen
      CREATE INDEX IF NOT EXISTS idx_devices_last_seen
        ON discovered_devices(last_seen);

      -- FK lookup index for health_checks -> switches
      CREATE INDEX IF NOT EXISTS idx_health_checks_switch
        ON health_checks(switch_mac);
    `);
  }

  // --------------------------------------------------------------------------
  // Maintenance — automatic purge of stale time-series data
  // --------------------------------------------------------------------------

  /** Start background maintenance jobs (call once after construction). */
  startMaintenanceJobs(): void {
    const SIX_HOURS = 6 * 60 * 60 * 1000;

    // Purge old port stats every 6 hours (keep last 30 days)
    setInterval(() => {
      try {
        const days = 30; // PORT_STATS_RETENTION_DAYS
        this.db
          .prepare(
            `DELETE FROM port_stats WHERE timestamp < datetime('now', '-' || ? || ' days')`
          )
          .run(days);
      } catch (e) {
        console.error('Port stats purge failed:', e);
      }
    }, SIX_HOURS);

    // Purge old event logs every 6 hours (keep last 50 000 rows)
    setInterval(() => {
      try {
        this.db
          .prepare(
            `DELETE FROM event_log WHERE id NOT IN (SELECT id FROM event_log ORDER BY timestamp DESC LIMIT 50000)`
          )
          .run();
      } catch (e) {
        console.error('Event log purge failed:', e);
      }
    }, SIX_HOURS);
  }

  // --------------------------------------------------------------------------
  // Public helpers
  // --------------------------------------------------------------------------

  /** Return the underlying better-sqlite3 Database instance. */
  getDb(): Database.Database {
    return this.db;
  }

  /** Gracefully close the database connection. */
  close(): void {
    this.db.close();
  }
}
