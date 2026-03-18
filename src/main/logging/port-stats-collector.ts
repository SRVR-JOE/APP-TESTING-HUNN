// ============================================================================
// GigaCore Command — Port Statistics Collector
// ============================================================================

import type Database from 'better-sqlite3';
import { DatabaseManager } from '../database/database';
import { PortStats, PortStatsInput } from '../../shared/types';

export class PortStatsCollector {
  private db: Database.Database;
  private intervalId: NodeJS.Timeout | null = null;

  private stmtInsert: Database.Statement;
  private stmtGetRange: Database.Statement;
  private stmtGetLatest: Database.Statement;
  private stmtPurge: Database.Statement;

  constructor(private manager: DatabaseManager) {
    this.db = manager.getDb();

    this.stmtInsert = this.db.prepare(`
      INSERT INTO port_stats
        (switch_mac, port, tx_bytes, rx_bytes, tx_packets, rx_packets,
         tx_broadcast, rx_broadcast, tx_multicast, rx_multicast,
         crc_errors, collisions, drops, link_speed, poe_watts)
      VALUES
        (@switch_mac, @port, @tx_bytes, @rx_bytes, @tx_packets, @rx_packets,
         @tx_broadcast, @rx_broadcast, @tx_multicast, @rx_multicast,
         @crc_errors, @collisions, @drops, @link_speed, @poe_watts)
    `);

    this.stmtGetRange = this.db.prepare(`
      SELECT * FROM port_stats
      WHERE switch_mac = ? AND port = ? AND timestamp >= ? AND timestamp <= ?
      ORDER BY timestamp ASC
    `);

    this.stmtGetLatest = this.db.prepare(`
      SELECT ps.* FROM port_stats ps
      INNER JOIN (
        SELECT port, MAX(timestamp) AS max_ts
        FROM port_stats
        WHERE switch_mac = ?
        GROUP BY port
      ) latest ON ps.port = latest.port AND ps.timestamp = latest.max_ts
      WHERE ps.switch_mac = ?
      ORDER BY ps.port ASC
    `);

    this.stmtPurge = this.db.prepare(`
      DELETE FROM port_stats WHERE timestamp < datetime('now', '-' || ? || ' days')
    `);
  }

  // --------------------------------------------------------------------------
  // Collection lifecycle
  // --------------------------------------------------------------------------

  /**
   * Start periodic stats collection.
   * The actual collection callback is a no-op placeholder — in production this
   * would poll each switch via SNMP / REST and call recordStats() for every port.
   */
  start(intervalMs: number = 60000): void {
    if (this.intervalId !== null) {
      return; // already running
    }

    this.intervalId = setInterval(() => {
      // Collection happens externally — the caller is responsible for
      // invoking recordStats() with data gathered from each switch.
      // This timer exists so the caller can rely on PortStatsCollector
      // to drive the cadence if desired.
    }, intervalMs);
  }

  /** Stop periodic collection. */
  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------

  /** Record a single port's statistics snapshot. */
  recordStats(switchMac: string, port: number, stats: PortStatsInput): void {
    this.stmtInsert.run({
      switch_mac: switchMac,
      port,
      tx_bytes: stats.tx_bytes,
      rx_bytes: stats.rx_bytes,
      tx_packets: stats.tx_packets,
      rx_packets: stats.rx_packets,
      tx_broadcast: stats.tx_broadcast,
      rx_broadcast: stats.rx_broadcast,
      tx_multicast: stats.tx_multicast,
      rx_multicast: stats.rx_multicast,
      crc_errors: stats.crc_errors,
      collisions: stats.collisions,
      drops: stats.drops,
      link_speed: stats.link_speed ?? null,
      poe_watts: stats.poe_watts ?? null,
    });
  }

  /**
   * Retrieve port stats for a specific switch + port within a time range.
   */
  getStats(
    switchMac: string,
    port: number,
    timeRange: { start: string; end: string },
  ): PortStats[] {
    return this.stmtGetRange.all(
      switchMac,
      port,
      timeRange.start,
      timeRange.end,
    ) as PortStats[];
  }

  /** Return the latest stats snapshot for every port on a switch. */
  getLatestStats(switchMac: string): PortStats[] {
    return this.stmtGetLatest.all(switchMac, switchMac) as PortStats[];
  }

  /** Delete stats older than the given number of days. Returns rows removed. */
  purgeOlderThan(days: number): number {
    const result = this.stmtPurge.run(days);
    return result.changes;
  }
}
