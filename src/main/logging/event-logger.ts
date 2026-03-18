// ============================================================================
// GigaCore Command — Event Logger
// ============================================================================

import type Database from 'better-sqlite3';
import { DatabaseManager } from '../database/database';
import {
  EventCategory,
  Severity,
  EventLogEntry,
  LogFilters,
  EventLogStats,
} from '../../shared/types';

export class EventLogger {
  private db: Database.Database;

  private stmtInsert: Database.Statement;
  private stmtGetRecentErrors: Database.Statement;
  private stmtPurge: Database.Statement;
  private stmtTotal: Database.Statement;

  constructor(private manager: DatabaseManager) {
    this.db = manager.getDb();

    this.stmtInsert = this.db.prepare(`
      INSERT INTO event_log (category, severity, switch_mac, switch_name, message, details)
      VALUES (@category, @severity, @switch_mac, @switch_name, @message, @details)
    `);

    this.stmtGetRecentErrors = this.db.prepare(`
      SELECT * FROM event_log
      WHERE severity IN ('error', 'critical')
      ORDER BY timestamp DESC
      LIMIT ?
    `);

    this.stmtPurge = this.db.prepare(`
      DELETE FROM event_log WHERE timestamp < datetime('now', '-' || ? || ' days')
    `);

    this.stmtTotal = this.db.prepare('SELECT COUNT(*) AS cnt FROM event_log');
  }

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------

  /** Log an event to the database. */
  log(
    category: EventCategory,
    severity: Severity,
    message: string,
    opts?: {
      switchMac?: string;
      switchName?: string;
      details?: Record<string, unknown>;
    },
  ): void {
    this.stmtInsert.run({
      category,
      severity,
      switch_mac: opts?.switchMac ?? null,
      switch_name: opts?.switchName ?? null,
      message,
      details: opts?.details ? JSON.stringify(opts.details) : null,
    });
  }

  /**
   * Query the event log with flexible filters.
   * Returns matching entries plus the total count (for pagination).
   */
  query(filters: LogFilters): { entries: EventLogEntry[]; total: number } {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters.category && filters.category.length > 0) {
      const placeholders = filters.category.map(() => '?').join(', ');
      conditions.push(`category IN (${placeholders})`);
      params.push(...filters.category);
    }

    if (filters.severity && filters.severity.length > 0) {
      const placeholders = filters.severity.map(() => '?').join(', ');
      conditions.push(`severity IN (${placeholders})`);
      params.push(...filters.severity);
    }

    if (filters.switchMac) {
      conditions.push('switch_mac = ?');
      params.push(filters.switchMac);
    }

    if (filters.startTime) {
      conditions.push('timestamp >= ?');
      params.push(filters.startTime);
    }

    if (filters.endTime) {
      conditions.push('timestamp <= ?');
      params.push(filters.endTime);
    }

    if (filters.search) {
      conditions.push('(message LIKE ? OR details LIKE ?)');
      const term = `%${filters.search}%`;
      params.push(term, term);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Total count for the filter set
    const countSql = `SELECT COUNT(*) AS cnt FROM event_log ${whereClause}`;
    const countRow = this.db.prepare(countSql).get(...params) as { cnt: number };
    const total = countRow.cnt;

    // Paginated results
    const limit = filters.limit ?? 100;
    const offset = filters.offset ?? 0;

    const dataSql = `SELECT * FROM event_log ${whereClause} ORDER BY timestamp DESC LIMIT ? OFFSET ?`;
    const dataParams = [...params, limit, offset];
    const entries = this.db.prepare(dataSql).all(...dataParams) as EventLogEntry[];

    return { entries, total };
  }

  /** Return the most recent errors/critical entries. */
  getRecentErrors(limit: number = 50): EventLogEntry[] {
    return this.stmtGetRecentErrors.all(limit) as EventLogEntry[];
  }

  /** Delete events older than the given number of days. Returns rows removed. */
  purgeOlderThan(days: number): number {
    const result = this.stmtPurge.run(days);
    return result.changes;
  }

  /** Aggregate statistics about the event log. */
  getStats(): EventLogStats {
    const totalRow = this.stmtTotal.get() as { cnt: number };

    const categoryRows = this.db
      .prepare('SELECT category, COUNT(*) AS cnt FROM event_log GROUP BY category')
      .all() as { category: string; cnt: number }[];

    const severityRows = this.db
      .prepare('SELECT severity, COUNT(*) AS cnt FROM event_log GROUP BY severity')
      .all() as { severity: string; cnt: number }[];

    const byCategory: Record<string, number> = {};
    for (const row of categoryRows) {
      byCategory[row.category] = row.cnt;
    }

    const bySeverity: Record<string, number> = {};
    for (const row of severityRows) {
      bySeverity[row.severity] = row.cnt;
    }

    return {
      total: totalRow.cnt,
      byCategory,
      bySeverity,
    };
  }
}
