// ── Excel Template Generator ─────────────────────────────────────────────────
// Generates pre-formatted .xlsx templates for IP Schemes and Profiles.

import ExcelJS from 'exceljs';
import {
  ExcelGroupDefinition,
  ExcelSwitchEntry,
  ExcelPortAssignment,
  GIGACORE_MODELS,
  SOLOTECH_DEFAULT_GROUPS,
  GROUP_COLORS,
  MODEL_PORT_COUNTS,
  GigaCoreModel,
} from './types';

// ── Helpers ──────────────────────────────────────────────────────────────────

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF1F3864' },
};

const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: 'FFFFFFFF' },
  size: 11,
  name: 'Calibri',
};

const THIN_BORDER: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: 'FFB0B0B0' } };

const CELL_BORDER: Partial<ExcelJS.Borders> = {
  top: THIN_BORDER,
  bottom: THIN_BORDER,
  left: THIN_BORDER,
  right: THIN_BORDER,
};

function applyHeaderStyle(row: ExcelJS.Row, colCount: number): void {
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c);
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.border = CELL_BORDER;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  }
  row.height = 28;
}

function applyCellBorders(worksheet: ExcelJS.Worksheet, startRow: number, endRow: number, colCount: number): void {
  for (let r = startRow; r <= endRow; r++) {
    const row = worksheet.getRow(r);
    for (let c = 1; c <= colCount; c++) {
      row.getCell(c).border = CELL_BORDER;
    }
  }
}

function setDropdownValidation(
  cell: ExcelJS.Cell,
  options: readonly string[] | string[],
  allowBlank = true,
): void {
  cell.dataValidation = {
    type: 'list',
    allowBlank,
    formulae: [`"${options.join(',')}"`],
    showErrorMessage: true,
    errorTitle: 'Invalid value',
    error: `Value must be one of: ${options.join(', ')}`,
  };
}

function boolToOnOff(val: boolean): string {
  return val ? 'ON' : 'OFF';
}

// ── Template Generator ───────────────────────────────────────────────────────

export class TemplateGenerator {
  /**
   * Generate a blank IP Scheme template with 4 sheets:
   *  1. IP Scheme — switch management addresses
   *  2. Port Assignments — per-port group/label mapping
   *  3. Group Definitions — VLAN/group table
   *  4. Instructions — usage guide
   */
  async generateIPSchemeTemplate(outputPath: string): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Luminex Configurator';
    workbook.created = new Date();

    this.buildIPSchemeSheet(workbook);
    this.buildPortAssignmentsSheet(workbook);
    this.buildGroupDefinitionsSheet(workbook);
    this.buildInstructionsSheet(workbook);

    await workbook.xlsx.writeFile(outputPath);
  }

  /**
   * Generate a blank Profile template with 3 sheets:
   *  1. Profile Config — switch-to-profile mapping
   *  2. Profile: Example — full port/group config template
   *  3. Instructions
   */
  async generateProfileTemplate(outputPath: string): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Luminex Configurator';
    workbook.created = new Date();

    this.buildProfileConfigSheet(workbook);
    this.buildProfileExampleSheet(workbook);
    this.buildProfileInstructionsSheet(workbook);

    await workbook.xlsx.writeFile(outputPath);
  }

  /**
   * Generate an IP Scheme template pre-filled from live switch data.
   */
  async generateFromLiveData(
    switches: Array<{
      name: string;
      ip: string;
      model: string;
      subnet?: string;
      gateway?: string;
      vlanMgmt?: number;
      location?: string;
      ports?: Array<{ port: number; label: string; groupVlan: string; notes?: string }>;
      groups?: Array<{
        groupNumber: number;
        name: string;
        vlanId: number;
        color?: string;
        igmpSnooping: boolean;
        igmpQuerier: boolean;
        unknownFlooding: boolean;
      }>;
    }>,
    outputPath: string,
  ): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Luminex Configurator';
    workbook.created = new Date();

    // ── Sheet 1: IP Scheme ───────────────────────────────────────────────
    const ipSheet = this.buildIPSchemeSheet(workbook, false);

    for (const sw of switches) {
      const row = ipSheet.addRow([
        sw.name,
        sw.model,
        sw.ip,
        sw.subnet ?? '255.255.255.0',
        sw.gateway ?? '',
        sw.vlanMgmt ?? 1,
        sw.location ?? '',
      ]);
      this.applyModelDropdown(row.getCell(2));
      row.eachCell((cell) => {
        cell.border = CELL_BORDER;
      });
    }

    // ── Sheet 2: Port Assignments ────────────────────────────────────────
    const portSheet = this.buildPortAssignmentsSheet(workbook, false);

    for (const sw of switches) {
      if (!sw.ports) continue;
      for (const p of sw.ports) {
        const row = portSheet.addRow([
          sw.name,
          String(p.port),
          p.groupVlan,
          p.label,
          p.notes ?? '',
        ]);
        row.eachCell((cell) => {
          cell.border = CELL_BORDER;
        });
      }
    }

    // ── Sheet 3: Group Definitions ───────────────────────────────────────
    const groupSheet = this.buildGroupDefinitionsSheet(workbook, false);

    // Collect unique groups from all switches
    const seenGroups = new Map<number, typeof switches[0]['groups'] extends Array<infer T> | undefined ? T : never>();
    for (const sw of switches) {
      if (!sw.groups) continue;
      for (const g of sw.groups) {
        if (!seenGroups.has(g.groupNumber)) {
          seenGroups.set(g.groupNumber, g);
        }
      }
    }

    for (const g of Array.from(seenGroups.values()).sort((a, b) => a.groupNumber - b.groupNumber)) {
      const row = groupSheet.addRow([
        g.groupNumber,
        g.name,
        g.vlanId,
        g.color ?? 'Blue',
        boolToOnOff(g.igmpSnooping),
        boolToOnOff(g.igmpQuerier),
        boolToOnOff(g.unknownFlooding),
      ]);
      setDropdownValidation(row.getCell(5), ['ON', 'OFF']);
      setDropdownValidation(row.getCell(6), ['ON', 'OFF']);
      setDropdownValidation(row.getCell(7), ['ON', 'OFF']);
      setDropdownValidation(row.getCell(4), GROUP_COLORS as unknown as string[]);
      row.eachCell((cell) => {
        cell.border = CELL_BORDER;
      });
    }

    // If no groups found from live data, fill Solotech defaults
    if (seenGroups.size === 0) {
      this.fillDefaultGroups(groupSheet);
    }

    this.buildInstructionsSheet(workbook);

    // Add conditional formatting for duplicate IPs
    this.addDuplicateIpConditionalFormatting(ipSheet, switches.length + 1);

    await workbook.xlsx.writeFile(outputPath);
  }

  // ── Private sheet builders ─────────────────────────────────────────────────

  private buildIPSchemeSheet(workbook: ExcelJS.Workbook, addExamples = true): ExcelJS.Worksheet {
    const ws = workbook.addWorksheet('IP Scheme');

    const headers = ['Switch Name', 'Model', 'Management IP', 'Subnet', 'Gateway', 'VLAN Mgmt', 'Location/Rack'];
    const headerRow = ws.addRow(headers);
    applyHeaderStyle(headerRow, headers.length);

    ws.views = [{ state: 'frozen', ySplit: 1, xSplit: 0 }];
    ws.autoFilter = { from: 'A1', to: 'G1' };

    ws.getColumn(1).width = 22; // Switch Name
    ws.getColumn(2).width = 14; // Model
    ws.getColumn(3).width = 18; // Management IP
    ws.getColumn(4).width = 18; // Subnet
    ws.getColumn(5).width = 18; // Gateway
    ws.getColumn(6).width = 12; // VLAN Mgmt
    ws.getColumn(7).width = 22; // Location/Rack

    if (addExamples) {
      const examples: Array<[string, string, string, string, string, number, string]> = [
        ['GC-Main-FOH', 'GC-26', '192.168.1.10', '255.255.255.0', '192.168.1.1', 100, 'FOH Rack A'],
        ['GC-Stage-L', 'GC-30i', '192.168.1.11', '255.255.255.0', '192.168.1.1', 100, 'Stage Left Rack'],
        ['GC-Stage-R', 'GC-30i', '192.168.1.12', '255.255.255.0', '192.168.1.1', 100, 'Stage Right Rack'],
        ['GC-Broadcast', 'GC-20t', '192.168.1.13', '255.255.255.0', '192.168.1.1', 100, 'Broadcast Booth'],
        ['GC-Amp-Room', 'GC-16t', '192.168.1.14', '255.255.255.0', '192.168.1.1', 100, 'Amp Room'],
      ];

      for (const ex of examples) {
        const row = ws.addRow(ex);
        this.applyModelDropdown(row.getCell(2));
        row.eachCell((cell) => {
          cell.border = CELL_BORDER;
        });
      }

      this.addDuplicateIpConditionalFormatting(ws, examples.length + 1);
    }

    // Apply model dropdown validation for rows 2-100
    for (let r = 2; r <= 100; r++) {
      this.applyModelDropdown(ws.getRow(r).getCell(2));
    }

    return ws;
  }

  private buildPortAssignmentsSheet(workbook: ExcelJS.Workbook, addExamples = true): ExcelJS.Worksheet {
    const ws = workbook.addWorksheet('Port Assignments');

    const headers = ['Switch Name', 'Port', 'Group/VLAN', 'Label', 'Notes'];
    const headerRow = ws.addRow(headers);
    applyHeaderStyle(headerRow, headers.length);

    ws.views = [{ state: 'frozen', ySplit: 1, xSplit: 0 }];
    ws.autoFilter = { from: 'A1', to: 'E1' };

    ws.getColumn(1).width = 22;
    ws.getColumn(2).width = 10;
    ws.getColumn(3).width = 16;
    ws.getColumn(4).width = 24;
    ws.getColumn(5).width = 30;

    if (addExamples) {
      const examples: Array<[string, string, string, string, string]> = [
        ['GC-Main-FOH', '1', 'Dante Pri', 'Console Main L', 'Yamaha CL5 Primary'],
        ['GC-Main-FOH', '2', 'Dante Sec', 'Console Main L', 'Yamaha CL5 Secondary'],
        ['GC-Main-FOH', '4-8', 'NDI', 'NDI Sources', 'PTZ Cameras'],
        ['GC-Main-FOH', 'ISL1', 'Trunk', 'Uplink Stage-L', 'ISL to Stage Left'],
        ['GC-Stage-L', '1-4', 'Dante Pri', 'Stage Inputs', 'Rio3224-D2 units'],
      ];

      for (const ex of examples) {
        const row = ws.addRow(ex);
        row.eachCell((cell) => {
          cell.border = CELL_BORDER;
        });
      }
    }

    return ws;
  }

  private buildGroupDefinitionsSheet(workbook: ExcelJS.Workbook, addDefaults = true): ExcelJS.Worksheet {
    const ws = workbook.addWorksheet('Group Definitions');

    const headers = ['Group #', 'Name', 'VLAN ID', 'Color', 'IGMP Snooping', 'IGMP Querier', 'Unknown Flooding'];
    const headerRow = ws.addRow(headers);
    applyHeaderStyle(headerRow, headers.length);

    ws.views = [{ state: 'frozen', ySplit: 1, xSplit: 0 }];
    ws.autoFilter = { from: 'A1', to: 'G1' };

    ws.getColumn(1).width = 10;
    ws.getColumn(2).width = 16;
    ws.getColumn(3).width = 10;
    ws.getColumn(4).width = 12;
    ws.getColumn(5).width = 16;
    ws.getColumn(6).width = 16;
    ws.getColumn(7).width = 18;

    if (addDefaults) {
      this.fillDefaultGroups(ws);
    }

    return ws;
  }

  private fillDefaultGroups(ws: ExcelJS.Worksheet): void {
    for (const g of SOLOTECH_DEFAULT_GROUPS) {
      const row = ws.addRow([
        g.groupNumber,
        g.name,
        g.vlanId,
        g.color,
        boolToOnOff(g.igmpSnooping),
        boolToOnOff(g.igmpQuerier),
        boolToOnOff(g.unknownFlooding),
      ]);
      setDropdownValidation(row.getCell(4), GROUP_COLORS as unknown as string[]);
      setDropdownValidation(row.getCell(5), ['ON', 'OFF']);
      setDropdownValidation(row.getCell(6), ['ON', 'OFF']);
      setDropdownValidation(row.getCell(7), ['ON', 'OFF']);
      row.eachCell((cell) => {
        cell.border = CELL_BORDER;
      });

      // Apply color fill to the color cell
      const colorArgb = this.colorNameToArgb(g.color);
      if (colorArgb) {
        row.getCell(4).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: colorArgb },
        };
      }
    }
  }

  private buildInstructionsSheet(workbook: ExcelJS.Workbook): ExcelJS.Worksheet {
    const ws = workbook.addWorksheet('Instructions');

    ws.getColumn(1).width = 100;

    const lines = [
      '╔══════════════════════════════════════════════════════════════════╗',
      '║          Luminex Configurator — IP Scheme Template Guide           ║',
      '╚══════════════════════════════════════════════════════════════════╝',
      '',
      '── Sheet 1: IP Scheme ──────────────────────────────────────────────',
      'Define each GigaCore switch on your network.',
      '  • Switch Name    — Unique descriptive name (e.g., "GC-Main-FOH")',
      '  • Model          — Select from the dropdown (GC-10, GC-10i, GC-14R, etc.)',
      '  • Management IP  — IPv4 address for switch management',
      '  • Subnet         — Subnet mask (e.g., 255.255.255.0)',
      '  • Gateway        — Default gateway IP',
      '  • VLAN Mgmt      — Management VLAN ID (1-4094)',
      '  • Location/Rack  — Physical location description',
      '',
      '── Sheet 2: Port Assignments ───────────────────────────────────────',
      'Map ports to groups/VLANs on each switch.',
      '  • Switch Name    — Must match a name from Sheet 1',
      '  • Port           — Port number, range ("4-8"), or ISL ("ISL1")',
      '  • Group/VLAN     — Group name (from Sheet 3) or VLAN ID',
      '  • Label          — Device or purpose connected to this port',
      '  • Notes          — Additional notes',
      '',
      '── Sheet 3: Group Definitions ──────────────────────────────────────',
      'Define VLAN groups used across switches.',
      '  • Group #          — Group number (1-8 typical)',
      '  • Name             — Descriptive name (e.g., "Dante Pri")',
      '  • VLAN ID          — 802.1Q VLAN tag (1-4094)',
      '  • Color            — Visual identifier color',
      '  • IGMP Snooping    — ON/OFF — filter multicast at layer 2',
      '  • IGMP Querier     — ON/OFF — switch acts as IGMP querier',
      '  • Unknown Flooding — ON/OFF — flood unknown multicast',
      '',
      '── Tips ───────────────────────────────────────────────────────────',
      '  • Port ranges accept "4-8" (expands to ports 4,5,6,7,8)',
      '  • ISL ports use "ISL1", "ISL2" naming',
      '  • Duplicate management IPs will be highlighted in red',
      '  • Leave rows blank to skip — empty rows are ignored',
      '  • Save as .xlsx before importing into Luminex Configurator',
    ];

    for (const line of lines) {
      const row = ws.addRow([line]);
      if (line.startsWith('══') || line.startsWith('║') || line.startsWith('╔') || line.startsWith('╚')) {
        row.getCell(1).font = { bold: true, size: 13, name: 'Consolas' };
      } else if (line.startsWith('──')) {
        row.getCell(1).font = { bold: true, size: 11, name: 'Calibri', color: { argb: 'FF1F3864' } };
      } else {
        row.getCell(1).font = { size: 11, name: 'Calibri' };
      }
    }

    return ws;
  }

  private buildProfileConfigSheet(workbook: ExcelJS.Workbook): ExcelJS.Worksheet {
    const ws = workbook.addWorksheet('Profile Config');

    const headers = ['Switch Name', 'Profile Name', 'Profile Description'];
    const headerRow = ws.addRow(headers);
    applyHeaderStyle(headerRow, headers.length);

    ws.views = [{ state: 'frozen', ySplit: 1, xSplit: 0 }];
    ws.autoFilter = { from: 'A1', to: 'C1' };

    ws.getColumn(1).width = 22;
    ws.getColumn(2).width = 22;
    ws.getColumn(3).width = 40;

    // Example row
    const exRow = ws.addRow(['GC-Main-FOH', 'FOH Standard', 'Standard FOH configuration with Dante + NDI']);
    exRow.eachCell((cell) => {
      cell.border = CELL_BORDER;
    });

    return ws;
  }

  private buildProfileExampleSheet(workbook: ExcelJS.Workbook): ExcelJS.Worksheet {
    const ws = workbook.addWorksheet('Profile: Example');

    // Section 1: Port Configuration
    const portHeaders = [
      'Port', 'Label', 'Group/VLAN', 'Mode', 'Trunk Groups', 'PoE Enabled', 'Speed', 'IGMP Snooping', 'Notes',
    ];
    const portHeaderRow = ws.addRow(portHeaders);
    applyHeaderStyle(portHeaderRow, portHeaders.length);

    ws.getColumn(1).width = 8;
    ws.getColumn(2).width = 20;
    ws.getColumn(3).width = 14;
    ws.getColumn(4).width = 10;
    ws.getColumn(5).width = 16;
    ws.getColumn(6).width = 12;
    ws.getColumn(7).width = 10;
    ws.getColumn(8).width = 16;
    ws.getColumn(9).width = 28;

    ws.views = [{ state: 'frozen', ySplit: 1, xSplit: 0 }];

    // Example port rows
    const portExamples: Array<[number, string, string, string, string, string, string, string, string]> = [
      [1, 'Console Main L', 'Dante Pri', 'access', '', 'OFF', 'Auto', 'ON', 'Yamaha CL5 Primary'],
      [2, 'Console Main R', 'Dante Sec', 'access', '', 'OFF', 'Auto', 'ON', 'Yamaha CL5 Secondary'],
      [3, 'PTZ Camera 1', 'NDI', 'access', '', 'ON', '1G', 'ON', 'NDI PTZ'],
      [4, 'Trunk Uplink', '', 'trunk', 'Dante Pri,Dante Sec,NDI', 'OFF', '10G', 'OFF', 'ISL trunk'],
    ];

    for (const ex of portExamples) {
      const row = ws.addRow(ex);
      setDropdownValidation(row.getCell(4), ['access', 'trunk']);
      setDropdownValidation(row.getCell(6), ['ON', 'OFF']);
      setDropdownValidation(row.getCell(7), ['Auto', '100M', '1G', '10G']);
      setDropdownValidation(row.getCell(8), ['ON', 'OFF']);
      row.eachCell((cell) => {
        cell.border = CELL_BORDER;
      });
    }

    // Blank spacer
    ws.addRow([]);

    // Section 2: Group definitions embedded in profile
    const groupHeaders = ['Group #', 'Name', 'VLAN ID', 'Color', 'IGMP Snooping', 'IGMP Querier', 'Unknown Flooding'];
    const groupHeaderRow = ws.addRow(groupHeaders);
    applyHeaderStyle(groupHeaderRow, groupHeaders.length);

    for (const g of SOLOTECH_DEFAULT_GROUPS.slice(0, 4)) {
      const row = ws.addRow([
        g.groupNumber,
        g.name,
        g.vlanId,
        g.color,
        boolToOnOff(g.igmpSnooping),
        boolToOnOff(g.igmpQuerier),
        boolToOnOff(g.unknownFlooding),
      ]);
      row.eachCell((cell) => {
        cell.border = CELL_BORDER;
      });
    }

    return ws;
  }

  private buildProfileInstructionsSheet(workbook: ExcelJS.Workbook): ExcelJS.Worksheet {
    const ws = workbook.addWorksheet('Instructions');

    ws.getColumn(1).width = 100;

    const lines = [
      '╔══════════════════════════════════════════════════════════════════╗',
      '║         Luminex Configurator — Profile Template Guide              ║',
      '╚══════════════════════════════════════════════════════════════════╝',
      '',
      '── Sheet 1: Profile Config ─────────────────────────────────────────',
      'Map switches to named profiles.',
      '  • Switch Name          — Target switch name',
      '  • Profile Name         — Name of the profile to apply',
      '  • Profile Description  — Optional description',
      '',
      '── Sheet 2+: Profile Sheets ────────────────────────────────────────',
      'Each profile is defined on its own sheet, named "Profile: <name>".',
      'The sheet contains two sections:',
      '',
      '  PORT CONFIGURATION (top section)',
      '  • Port             — Port number (1-based)',
      '  • Label            — Device/purpose label',
      '  • Group/VLAN       — Group name or VLAN ID for access ports',
      '  • Mode             — "access" or "trunk"',
      '  • Trunk Groups     — Comma-separated group names for trunk mode',
      '  • PoE Enabled      — ON/OFF',
      '  • Speed            — Auto, 100M, 1G, 10G',
      '  • IGMP Snooping    — ON/OFF per-port override',
      '  • Notes            — Additional notes',
      '',
      '  GROUP DEFINITIONS (bottom section, after blank row)',
      '  • Same format as IP Scheme Group Definitions sheet',
      '',
      '── Tips ───────────────────────────────────────────────────────────',
      '  • Create one "Profile: <name>" sheet per unique profile',
      '  • Multiple switches can reference the same profile name',
      '  • Port numbers not listed will retain their current configuration',
    ];

    for (const line of lines) {
      const row = ws.addRow([line]);
      if (line.startsWith('══') || line.startsWith('║') || line.startsWith('╔') || line.startsWith('╚')) {
        row.getCell(1).font = { bold: true, size: 13, name: 'Consolas' };
      } else if (line.startsWith('──')) {
        row.getCell(1).font = { bold: true, size: 11, name: 'Calibri', color: { argb: 'FF1F3864' } };
      } else {
        row.getCell(1).font = { size: 11, name: 'Calibri' };
      }
    }

    return ws;
  }

  // ── Utility ────────────────────────────────────────────────────────────────

  private applyModelDropdown(cell: ExcelJS.Cell): void {
    setDropdownValidation(cell, GIGACORE_MODELS as unknown as string[]);
  }

  private addDuplicateIpConditionalFormatting(ws: ExcelJS.Worksheet, lastDataRow: number): void {
    // ExcelJS supports conditional formatting via worksheet.addConditionalFormatting
    ws.addConditionalFormatting({
      ref: `C2:C${Math.max(lastDataRow, 100)}`,
      rules: [
        {
          type: 'expression',
          formulae: ['COUNTIF($C$2:$C$1000,C2)>1'],
          priority: 1,
          style: {
            fill: {
              type: 'pattern',
              pattern: 'solid',
              bgColor: { argb: 'FFFF0000' },
            },
            font: {
              color: { argb: 'FFFFFFFF' },
              bold: true,
            },
          },
        },
      ],
    });
  }

  private colorNameToArgb(color: string): string | undefined {
    const map: Record<string, string> = {
      Red: 'FFFF4444',
      Orange: 'FFFF8C00',
      Yellow: 'FFFFF44F',
      Green: 'FF22B14C',
      Cyan: 'FF00CED1',
      Blue: 'FF4472C4',
      Purple: 'FF9B59B6',
      Gray: 'FFB0B0B0',
      White: 'FFFFFFFF',
      Black: 'FF333333',
    };
    return map[color];
  }
}
