// ============================================================================
// GigaCore Command — Log Exporter (CSV, JSON, Excel)
// ============================================================================

import fs from 'fs';
import path from 'path';
import { DatabaseManager } from '../database/database';
import { EventLogger } from './event-logger';
import { LogFilters, EventLogEntry } from '../../shared/types';

export class LogExporter {
  private logger: EventLogger;

  constructor(private manager: DatabaseManager) {
    this.logger = new EventLogger(manager);
  }

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------

  /** Export filtered log entries to a CSV file. */
  async exportToCSV(filters: LogFilters, outputPath: string): Promise<void> {
    const entries = this.fetchAll(filters);
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const header = 'id,timestamp,category,severity,switch_mac,switch_name,message,details';
    const lines = [header];

    for (const entry of entries) {
      lines.push(
        [
          entry.id,
          csvEscape(entry.timestamp),
          csvEscape(entry.category),
          csvEscape(entry.severity),
          csvEscape(entry.switch_mac ?? ''),
          csvEscape(entry.switch_name ?? ''),
          csvEscape(entry.message),
          csvEscape(entry.details ?? ''),
        ].join(','),
      );
    }

    fs.writeFileSync(outputPath, lines.join('\n'), 'utf-8');
  }

  /** Export filtered log entries to a JSON file. */
  async exportToJSON(filters: LogFilters, outputPath: string): Promise<void> {
    const entries = this.fetchAll(filters);
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const output = {
      exportedAt: new Date().toISOString(),
      count: entries.length,
      entries,
    };

    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');
  }

  /**
   * Export filtered log entries to an Excel file.
   * Requires the `exceljs` package — implementation will use it when available.
   */
  async exportToExcel(filters: LogFilters, outputPath: string): Promise<void> {
    // Dynamic import so the module only fails at call-time if exceljs is missing
    // rather than at module load time.
    let ExcelJS: typeof import('exceljs');
    try {
      ExcelJS = await import('exceljs');
    } catch {
      throw new Error(
        'Excel export requires the "exceljs" package. Install it with: npm install exceljs',
      );
    }

    const entries = this.fetchAll(filters);
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Event Log');

    sheet.columns = [
      { header: 'ID', key: 'id', width: 8 },
      { header: 'Timestamp', key: 'timestamp', width: 22 },
      { header: 'Category', key: 'category', width: 14 },
      { header: 'Severity', key: 'severity', width: 12 },
      { header: 'Switch MAC', key: 'switch_mac', width: 20 },
      { header: 'Switch Name', key: 'switch_name', width: 20 },
      { header: 'Message', key: 'message', width: 50 },
      { header: 'Details', key: 'details', width: 40 },
    ];

    for (const entry of entries) {
      sheet.addRow({
        id: entry.id,
        timestamp: entry.timestamp,
        category: entry.category,
        severity: entry.severity,
        switch_mac: entry.switch_mac ?? '',
        switch_name: entry.switch_name ?? '',
        message: entry.message,
        details: entry.details ?? '',
      });
    }

    await workbook.xlsx.writeFile(outputPath);
  }

  // --------------------------------------------------------------------------
  // Internal
  // --------------------------------------------------------------------------

  /**
   * Fetch all matching entries (no pagination limit) for export.
   */
  private fetchAll(filters: LogFilters): EventLogEntry[] {
    // Override limit/offset so we get everything matching the filter
    const exportFilters: LogFilters = {
      ...filters,
      limit: 1_000_000,
      offset: 0,
    };
    const { entries } = this.logger.query(exportFilters);
    return entries;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Escape a value for safe inclusion in a CSV cell. */
function csvEscape(value: string): string {
  if (
    value.includes(',') ||
    value.includes('"') ||
    value.includes('\n') ||
    value.includes('\r')
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
