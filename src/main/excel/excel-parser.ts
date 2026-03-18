// ── Excel Parser ─────────────────────────────────────────────────────────────
// Parses uploaded .xlsx files into typed GigaCore data structures.

import ExcelJS from 'exceljs';
import {
  ExcelIPScheme,
  ExcelSwitchEntry,
  ExcelPortAssignment,
  ExcelGroupDefinition,
  ExcelProfile,
  ExcelPortConfig,
} from './types';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Safely extract a string value from a cell, handling formulas, rich text, merged cells. */
function cellToString(cell: ExcelJS.Cell): string {
  if (cell.value === null || cell.value === undefined) {
    return '';
  }
  // Formula cell — use the result
  if (typeof cell.value === 'object' && 'result' in cell.value) {
    const result = (cell.value as ExcelJS.CellFormulaValue).result;
    return result !== null && result !== undefined ? String(result).trim() : '';
  }
  // Rich text
  if (typeof cell.value === 'object' && 'richText' in cell.value) {
    const rt = cell.value as ExcelJS.CellRichTextValue;
    return rt.richText.map((seg) => seg.text).join('').trim();
  }
  return String(cell.value).trim();
}

/** Safely extract a number from a cell. Returns NaN if not parseable. */
function cellToNumber(cell: ExcelJS.Cell): number {
  const str = cellToString(cell);
  if (str === '') return NaN;
  const n = Number(str);
  return n;
}

/** Convert ON/OFF/TRUE/FALSE/1/0/Yes/No to boolean. */
function cellToBoolean(cell: ExcelJS.Cell): boolean {
  const str = cellToString(cell).toUpperCase();
  return str === 'ON' || str === 'TRUE' || str === '1' || str === 'YES';
}

/** Check if a row is entirely empty. */
function isRowEmpty(row: ExcelJS.Row, colCount: number): boolean {
  for (let c = 1; c <= colCount; c++) {
    if (cellToString(row.getCell(c)) !== '') return false;
  }
  return true;
}

/** Normalize header text for comparison. */
function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// ── Parser ───────────────────────────────────────────────────────────────────

export class ExcelParser {
  /**
   * Auto-detect the template type by examining sheet names and headers.
   */
  async detectFormat(filePath: string): Promise<'ip-scheme' | 'profile' | 'unknown'> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const sheetNames = workbook.worksheets.map((ws) => ws.name.toLowerCase());

    // IP Scheme detection: has "ip scheme" or ("port assignments" and "group definitions")
    const hasIpScheme = sheetNames.some((n) => n === 'ip scheme');
    const hasPortAssignments = sheetNames.some((n) => n === 'port assignments');
    const hasGroupDefs = sheetNames.some((n) => n === 'group definitions');

    if (hasIpScheme || (hasPortAssignments && hasGroupDefs)) {
      return 'ip-scheme';
    }

    // Profile detection: has "profile config" or any sheet starting with "profile:"
    const hasProfileConfig = sheetNames.some((n) => n === 'profile config');
    const hasProfileSheets = sheetNames.some((n) => n.startsWith('profile:'));

    if (hasProfileConfig || hasProfileSheets) {
      return 'profile';
    }

    return 'unknown';
  }

  /**
   * Parse a full IP Scheme workbook into typed structures.
   */
  async parseIPScheme(filePath: string): Promise<ExcelIPScheme> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const switches = this.parseSwitchSheet(workbook);
    const portAssignments = this.parsePortAssignmentSheet(workbook);
    const groupDefinitions = this.parseGroupDefinitionSheet(workbook);

    return { switches, portAssignments, groupDefinitions };
  }

  /**
   * Parse profile workbook into typed profile structures.
   */
  async parseProfiles(filePath: string): Promise<ExcelProfile[]> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    // Parse profile config mapping
    const configSheet = workbook.getWorksheet('Profile Config');
    if (!configSheet) {
      return [];
    }

    const profileMappings = this.parseSheet(configSheet, ['switchname', 'profilename', 'profiledescription']);

    // Collect unique profile names and find their sheets
    const profiles: ExcelProfile[] = [];

    for (const mapping of profileMappings) {
      const switchName = mapping['switchname'] ?? '';
      const profileName = mapping['profilename'] ?? '';
      const profileDescription = mapping['profiledescription'] ?? '';

      if (!switchName || !profileName) continue;

      // Find the matching profile sheet
      const profileSheetName = `Profile: ${profileName}`;
      const profileSheet = workbook.worksheets.find(
        (ws) => ws.name.toLowerCase() === profileSheetName.toLowerCase(),
      );

      const portConfigs: ExcelPortConfig[] = [];
      const groups: ExcelGroupDefinition[] = [];

      if (profileSheet) {
        const { ports, groupDefs } = this.parseProfileSheet(profileSheet);
        portConfigs.push(...ports);
        groups.push(...groupDefs);
      }

      profiles.push({
        switchName,
        profileName,
        profileDescription,
        portConfigs,
        groups,
      });
    }

    return profiles;
  }

  // ── Private parsers ────────────────────────────────────────────────────────

  private parseSwitchSheet(workbook: ExcelJS.Workbook): ExcelSwitchEntry[] {
    const ws = workbook.getWorksheet('IP Scheme');
    if (!ws) return [];

    const rows = this.parseSheet(ws, [
      'switchname', 'model', 'managementip', 'subnet', 'gateway', 'vlanmgmt', 'locationrack',
    ]);

    return rows
      .filter((r) => r['switchname'])
      .map((r) => ({
        switchName: r['switchname'] ?? '',
        model: r['model'] ?? '',
        managementIp: r['managementip'] ?? '',
        subnet: r['subnet'] ?? '',
        gateway: r['gateway'] ?? '',
        vlanMgmt: parseInt(r['vlanmgmt'] ?? '1', 10) || 1,
        locationRack: r['locationrack'] ?? '',
      }));
  }

  private parsePortAssignmentSheet(workbook: ExcelJS.Workbook): ExcelPortAssignment[] {
    const ws = workbook.getWorksheet('Port Assignments');
    if (!ws) return [];

    const rows = this.parseSheet(ws, ['switchname', 'port', 'groupvlan', 'label', 'notes']);

    return rows
      .filter((r) => r['switchname'] && r['port'])
      .map((r) => ({
        switchName: r['switchname'] ?? '',
        port: r['port'] ?? '',
        groupVlan: r['groupvlan'] ?? '',
        label: r['label'] ?? '',
        notes: r['notes'] ?? '',
      }));
  }

  private parseGroupDefinitionSheet(workbook: ExcelJS.Workbook): ExcelGroupDefinition[] {
    const ws = workbook.getWorksheet('Group Definitions');
    if (!ws) return [];

    const rows = this.parseSheet(ws, [
      'group', 'name', 'vlanid', 'color', 'igmpsnooping', 'igmpquerier', 'unknownflooding',
    ]);

    return rows
      .filter((r) => r['group'] && r['name'])
      .map((r) => ({
        groupNumber: parseInt(r['group'] ?? '0', 10) || 0,
        name: r['name'] ?? '',
        vlanId: parseInt(r['vlanid'] ?? '0', 10) || 0,
        color: r['color'] ?? '',
        igmpSnooping: this.toBool(r['igmpsnooping']),
        igmpQuerier: this.toBool(r['igmpquerier']),
        unknownFlooding: this.toBool(r['unknownflooding']),
      }));
  }

  /**
   * Parse a profile sheet that contains port configs in the top section and
   * group definitions in a lower section (separated by a blank row or a second header row).
   */
  private parseProfileSheet(ws: ExcelJS.Worksheet): {
    ports: ExcelPortConfig[];
    groupDefs: ExcelGroupDefinition[];
  } {
    const ports: ExcelPortConfig[] = [];
    const groupDefs: ExcelGroupDefinition[] = [];

    // Find the header row for ports (row 1 typically)
    const headerRow = ws.getRow(1);
    const portColCount = 9; // Port sheet has 9 columns

    // Determine column mapping from the first header row
    const portHeaderMap = this.buildHeaderMap(headerRow, portColCount);

    // Parse port rows until we hit an empty row or a new header
    let rowNum = 2;
    let foundBlank = false;

    while (rowNum <= ws.rowCount) {
      const row = ws.getRow(rowNum);

      if (isRowEmpty(row, portColCount)) {
        if (!foundBlank) {
          foundBlank = true;
          rowNum++;
          continue;
        }
        // Two consecutive blanks = end
        break;
      }

      if (foundBlank) {
        // Check if this is a group definitions header
        const firstCell = cellToString(row.getCell(1)).toLowerCase();
        if (firstCell.includes('group') || firstCell === 'group #') {
          // This is the group header row — parse groups below
          const groupHeaderMap = this.buildHeaderMap(row, 7);
          rowNum++;
          while (rowNum <= ws.rowCount) {
            const gRow = ws.getRow(rowNum);
            if (isRowEmpty(gRow, 7)) break;

            const groupNum = cellToNumber(gRow.getCell(this.findCol(groupHeaderMap, 'group') ?? 1));
            if (!isNaN(groupNum)) {
              groupDefs.push({
                groupNumber: groupNum,
                name: cellToString(gRow.getCell(this.findCol(groupHeaderMap, 'name') ?? 2)),
                vlanId: cellToNumber(gRow.getCell(this.findCol(groupHeaderMap, 'vlanid') ?? 3)) || 0,
                color: cellToString(gRow.getCell(this.findCol(groupHeaderMap, 'color') ?? 4)),
                igmpSnooping: cellToBoolean(gRow.getCell(this.findCol(groupHeaderMap, 'igmpsnooping') ?? 5)),
                igmpQuerier: cellToBoolean(gRow.getCell(this.findCol(groupHeaderMap, 'igmpquerier') ?? 6)),
                unknownFlooding: cellToBoolean(gRow.getCell(this.findCol(groupHeaderMap, 'unknownflooding') ?? 7)),
              });
            }
            rowNum++;
          }
          break;
        }
      }

      if (!foundBlank) {
        // Parse port config row
        const portNum = cellToNumber(row.getCell(this.findCol(portHeaderMap, 'port') ?? 1));
        if (!isNaN(portNum)) {
          ports.push({
            port: portNum,
            label: cellToString(row.getCell(this.findCol(portHeaderMap, 'label') ?? 2)),
            groupVlan: cellToString(row.getCell(this.findCol(portHeaderMap, 'groupvlan') ?? 3)),
            mode: this.parseMode(cellToString(row.getCell(this.findCol(portHeaderMap, 'mode') ?? 4))),
            trunkGroups: cellToString(row.getCell(this.findCol(portHeaderMap, 'trunkgroups') ?? 5)),
            poeEnabled: cellToBoolean(row.getCell(this.findCol(portHeaderMap, 'poeenabled') ?? 6)),
            speed: cellToString(row.getCell(this.findCol(portHeaderMap, 'speed') ?? 7)) || 'Auto',
            igmpSnooping: cellToBoolean(row.getCell(this.findCol(portHeaderMap, 'igmpsnooping') ?? 8)),
            notes: cellToString(row.getCell(this.findCol(portHeaderMap, 'notes') ?? 9)),
          });
        }
      }

      rowNum++;
    }

    return { ports, groupDefs };
  }

  /**
   * Generic sheet parser: reads header row, maps columns by normalized name,
   * then extracts all data rows into key-value records.
   */
  private parseSheet(
    worksheet: ExcelJS.Worksheet,
    expectedHeaders: string[],
  ): Array<Record<string, string>> {
    const results: Array<Record<string, string>> = [];

    // Find header row (first non-empty row)
    let headerRowNum = 0;
    for (let r = 1; r <= Math.min(worksheet.rowCount, 10); r++) {
      const row = worksheet.getRow(r);
      const firstCell = cellToString(row.getCell(1));
      if (firstCell !== '') {
        headerRowNum = r;
        break;
      }
    }

    if (headerRowNum === 0) return results;

    const headerRow = worksheet.getRow(headerRowNum);
    const colCount = worksheet.columnCount || 20;

    // Build column index → normalized header name mapping
    const colMap: Map<number, string> = new Map();
    for (let c = 1; c <= colCount; c++) {
      const normalized = normalizeHeader(cellToString(headerRow.getCell(c)));
      if (normalized === '') continue;

      // Match against expected headers
      for (const expected of expectedHeaders) {
        if (normalized.includes(expected) || expected.includes(normalized)) {
          colMap.set(c, expected);
          break;
        }
      }

      // If no expected header matched, store with raw normalized name
      if (!colMap.has(c) && normalized !== '') {
        colMap.set(c, normalized);
      }
    }

    // Parse data rows
    for (let r = headerRowNum + 1; r <= worksheet.rowCount; r++) {
      const row = worksheet.getRow(r);
      if (isRowEmpty(row, colCount)) continue;

      const record: Record<string, string> = {};
      for (const [col, key] of colMap.entries()) {
        record[key] = cellToString(row.getCell(col));
      }

      // Only include if at least one expected header has a value
      const hasValue = expectedHeaders.some((h) => record[h] && record[h] !== '');
      if (hasValue) {
        results.push(record);
      }
    }

    return results;
  }

  // ── Utility ────────────────────────────────────────────────────────────────

  private buildHeaderMap(row: ExcelJS.Row, colCount: number): Map<string, number> {
    const map = new Map<string, number>();
    for (let c = 1; c <= colCount; c++) {
      const normalized = normalizeHeader(cellToString(row.getCell(c)));
      if (normalized) {
        map.set(normalized, c);
      }
    }
    return map;
  }

  private findCol(headerMap: Map<string, number>, search: string): number | undefined {
    // Exact match first
    if (headerMap.has(search)) return headerMap.get(search);
    // Partial match
    for (const [key, col] of headerMap.entries()) {
      if (key.includes(search) || search.includes(key)) return col;
    }
    return undefined;
  }

  private toBool(val: string | undefined): boolean {
    if (!val) return false;
    const upper = val.toUpperCase();
    return upper === 'ON' || upper === 'TRUE' || upper === '1' || upper === 'YES';
  }

  private parseMode(val: string): 'access' | 'trunk' {
    return val.toLowerCase() === 'trunk' ? 'trunk' : 'access';
  }
}
