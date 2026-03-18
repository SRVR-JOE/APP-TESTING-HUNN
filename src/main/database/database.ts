// ============================================================================
// GigaCore Command — Core Database Manager (better-sqlite3)
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

    const dbPath = path.join(userDataPath, 'gigacore-command.db');
    this.db = new Database(dbPath);

    // WAL mode for concurrent read performance
    this.db.pragma('journal_mode = WAL');
    // Enable foreign key enforcement
    this.db.pragma('foreign_keys = ON');

    this.initialize();
  }

  // --------------------------------------------------------------------------
  // Schema initialisation — idempotent (IF NOT EXISTS)
  // --------------------------------------------------------------------------

  private initialize(): void {
    this.db.exec(`
      -- switches
      CREATE TABLE IF NOT EXISTS switches (
        id TEXT PRIMARY KEY,
        name TEXT,
        model TEXT,
        ip TEXT,
        subnet TEXT,
        gateway TEXT,
        mac TEXT UNIQUE,
        firmware TEXT,
        generation INTEGER,
        serial TEXT,
        rack_group TEXT,
        last_seen DATETIME,
        first_seen DATETIME,
        is_online BOOLEAN DEFAULT 1
      );

      -- discovered_devices
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
        FOREIGN KEY (connected_switch_mac) REFERENCES switches(id)
      );

      -- event_log
      CREATE TABLE IF NOT EXISTS event_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        category TEXT,
        severity TEXT,
        switch_mac TEXT,
        switch_name TEXT,
        message TEXT,
        details TEXT,
        FOREIGN KEY (switch_mac) REFERENCES switches(id)
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
        FOREIGN KEY (switch_mac) REFERENCES switches(id)
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
        sort_order INTEGER
      );

      -- rack_switch_positions
      CREATE TABLE IF NOT EXISTS rack_switch_positions (
        switch_mac TEXT,
        rack_group_id TEXT,
        slot_index INTEGER,
        FOREIGN KEY (switch_mac) REFERENCES switches(id),
        FOREIGN KEY (rack_group_id) REFERENCES rack_groups(id),
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
        layout_id TEXT
      );

      -- health_checks
      CREATE TABLE IF NOT EXISTS health_checks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        check_type TEXT,
        switch_mac TEXT,
        status TEXT,
        message TEXT,
        details TEXT
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
    `);
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
