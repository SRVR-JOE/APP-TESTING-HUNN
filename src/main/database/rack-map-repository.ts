// ============================================================================
// Luminex Configurator — Rack Map Repository (CRUD for rack layout tables)
// ============================================================================

import type Database from 'better-sqlite3';
import { DatabaseManager } from './database';

// ---------------------------------------------------------------------------
// Row shapes (snake_case from the DB)
// ---------------------------------------------------------------------------

interface RawRackGroupRow {
  id: string;
  name: string | null;
  position_x: number | null;
  position_y: number | null;
  width: number | null;
  height: number | null;
  color: string | null;
  layout_id: string | null;
  sort_order: number | null;
}

interface RawSwitchPositionRow {
  switch_mac: string;
  rack_group_id: string;
  slot_index: number;
}

interface RawMapLayoutRow {
  id: string;
  name: string | null;
  description: string | null;
  created: string | null;
  modified: string | null;
  is_active: number;
}

// ---------------------------------------------------------------------------
// Public camelCase shapes
// ---------------------------------------------------------------------------

export interface RackGroup {
  id: string;
  name: string;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  color: string;
  layoutId: string | null;
  sortOrder: number;
  switches: SwitchPosition[];
}

export interface SwitchPosition {
  switchMac: string;
  rackGroupId: string;
  slotIndex: number;
}

export interface MapLayout {
  id: string;
  name: string;
  description: string;
  created: string;
  modified: string;
  isActive: boolean;
}

export interface RackLayoutData {
  layout: MapLayout;
  groups: RackGroup[];
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export class RackMapRepository {
  private db: Database.Database;

  // Prepared statements
  private stmtGetAllGroups: Database.Statement;
  private stmtGetGroupsByLayout: Database.Statement;
  private stmtUpsertGroup: Database.Statement;
  private stmtDeleteGroup: Database.Statement;
  private stmtGetSwitchPositions: Database.Statement;
  private stmtUpsertSwitchPosition: Database.Statement;
  private stmtDeleteSwitchPositionsByGroup: Database.Statement;
  private stmtGetActiveLayout: Database.Statement;
  private stmtGetAllLayouts: Database.Statement;
  private stmtUpsertLayout: Database.Statement;
  private stmtClearActiveLayouts: Database.Statement;
  private stmtDeleteLayout: Database.Statement;
  private stmtDeleteGroupsByLayout: Database.Statement;

  constructor(private manager: DatabaseManager) {
    this.db = manager.getDb();

    this.stmtGetAllGroups = this.db.prepare(
      'SELECT * FROM rack_groups ORDER BY sort_order ASC',
    );

    this.stmtGetGroupsByLayout = this.db.prepare(
      'SELECT * FROM rack_groups WHERE layout_id = ? ORDER BY sort_order ASC',
    );

    this.stmtUpsertGroup = this.db.prepare(`
      INSERT INTO rack_groups (id, name, position_x, position_y, width, height, color, layout_id, sort_order)
      VALUES (@id, @name, @position_x, @position_y, @width, @height, @color, @layout_id, @sort_order)
      ON CONFLICT(id) DO UPDATE SET
        name       = excluded.name,
        position_x = excluded.position_x,
        position_y = excluded.position_y,
        width      = excluded.width,
        height     = excluded.height,
        color      = excluded.color,
        layout_id  = excluded.layout_id,
        sort_order = excluded.sort_order
    `);

    this.stmtDeleteGroup = this.db.prepare('DELETE FROM rack_groups WHERE id = ?');

    this.stmtGetSwitchPositions = this.db.prepare(
      'SELECT * FROM rack_switch_positions WHERE rack_group_id = ?',
    );

    this.stmtUpsertSwitchPosition = this.db.prepare(`
      INSERT INTO rack_switch_positions (switch_mac, rack_group_id, slot_index)
      VALUES (@switch_mac, @rack_group_id, @slot_index)
      ON CONFLICT(switch_mac, rack_group_id) DO UPDATE SET
        slot_index = excluded.slot_index
    `);

    this.stmtDeleteSwitchPositionsByGroup = this.db.prepare(
      'DELETE FROM rack_switch_positions WHERE rack_group_id = ?',
    );

    this.stmtGetActiveLayout = this.db.prepare(
      'SELECT * FROM map_layouts WHERE is_active = 1 LIMIT 1',
    );

    this.stmtGetAllLayouts = this.db.prepare(
      'SELECT * FROM map_layouts ORDER BY modified DESC',
    );

    this.stmtUpsertLayout = this.db.prepare(`
      INSERT INTO map_layouts (id, name, description, created, modified, is_active)
      VALUES (@id, @name, @description, @created, @modified, @is_active)
      ON CONFLICT(id) DO UPDATE SET
        name        = excluded.name,
        description = excluded.description,
        modified    = excluded.modified,
        is_active   = excluded.is_active
    `);

    this.stmtClearActiveLayouts = this.db.prepare(
      'UPDATE map_layouts SET is_active = 0',
    );

    this.stmtDeleteLayout = this.db.prepare('DELETE FROM map_layouts WHERE id = ?');

    this.stmtDeleteGroupsByLayout = this.db.prepare(
      'DELETE FROM rack_groups WHERE layout_id = ?',
    );
  }

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------

  /** Get all rack groups with their switch positions. */
  getAllGroups(): RackGroup[] {
    const rows = this.stmtGetAllGroups.all() as RawRackGroupRow[];
    return rows.map((r) => this.toRackGroup(r));
  }

  /** Get rack groups for a specific layout. */
  getGroupsByLayout(layoutId: string): RackGroup[] {
    const rows = this.stmtGetGroupsByLayout.all(layoutId) as RawRackGroupRow[];
    return rows.map((r) => this.toRackGroup(r));
  }

  /** Save a full rack layout (layout metadata + groups + switch positions). */
  saveLayout(data: RackLayoutData): void {
    const txn = this.db.transaction(() => {
      // Upsert layout, marking it active
      this.stmtClearActiveLayouts.run();
      this.stmtUpsertLayout.run({
        id: data.layout.id,
        name: data.layout.name,
        description: data.layout.description,
        created: data.layout.created,
        modified: data.layout.modified,
        is_active: 1,
      });

      // Remove old groups for this layout, then re-insert
      this.stmtDeleteGroupsByLayout.run(data.layout.id);

      for (const group of data.groups) {
        this.stmtUpsertGroup.run({
          id: group.id,
          name: group.name,
          position_x: group.positionX,
          position_y: group.positionY,
          width: group.width,
          height: group.height,
          color: group.color,
          layout_id: data.layout.id,
          sort_order: group.sortOrder,
        });

        // Delete old switch positions for this group, then re-insert
        this.stmtDeleteSwitchPositionsByGroup.run(group.id);
        for (const sw of group.switches) {
          this.stmtUpsertSwitchPosition.run({
            switch_mac: sw.switchMac,
            rack_group_id: group.id,
            slot_index: sw.slotIndex,
          });
        }
      }
    });

    txn();
  }

  /** Export the active layout (or all data) as a JSON string. */
  exportLayoutJson(): string {
    const activeLayout = this.stmtGetActiveLayout.get() as RawMapLayoutRow | undefined;

    if (!activeLayout) {
      // No active layout -- export all groups with no layout association
      const allGroups = this.getAllGroups();
      return JSON.stringify({ layout: null, groups: allGroups }, null, 2);
    }

    const layout = this.toMapLayout(activeLayout);
    const groups = this.getGroupsByLayout(layout.id);

    const data: RackLayoutData = { layout, groups };
    return JSON.stringify(data, null, 2);
  }

  /** Import a layout from a JSON string.  */
  importLayoutJson(json: string): RackLayoutData {
    const parsed = JSON.parse(json);

    // Validate minimal structure
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Invalid layout JSON: root must be an object');
    }

    const data: RackLayoutData = {
      layout: {
        id: parsed.layout?.id ?? `layout-${Date.now()}`,
        name: parsed.layout?.name ?? 'Imported Layout',
        description: parsed.layout?.description ?? '',
        created: parsed.layout?.created ?? new Date().toISOString(),
        modified: new Date().toISOString(),
        isActive: true,
      },
      groups: Array.isArray(parsed.groups)
        ? parsed.groups.map((g: any) => ({
            id: g.id ?? `group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            name: g.name ?? '',
            positionX: g.positionX ?? 0,
            positionY: g.positionY ?? 0,
            width: g.width ?? 200,
            height: g.height ?? 400,
            color: g.color ?? '#808080',
            layoutId: null,
            sortOrder: g.sortOrder ?? 0,
            switches: Array.isArray(g.switches)
              ? g.switches.map((s: any) => ({
                  switchMac: s.switchMac ?? '',
                  rackGroupId: g.id ?? '',
                  slotIndex: s.slotIndex ?? 0,
                }))
              : [],
          }))
        : [],
    };

    this.saveLayout(data);
    return data;
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  private toRackGroup(row: RawRackGroupRow): RackGroup {
    const positions = this.stmtGetSwitchPositions.all(row.id) as RawSwitchPositionRow[];

    return {
      id: row.id,
      name: row.name ?? '',
      positionX: row.position_x ?? 0,
      positionY: row.position_y ?? 0,
      width: row.width ?? 200,
      height: row.height ?? 400,
      color: row.color ?? '#808080',
      layoutId: row.layout_id ?? null,
      sortOrder: row.sort_order ?? 0,
      switches: positions.map((p) => ({
        switchMac: p.switch_mac,
        rackGroupId: p.rack_group_id,
        slotIndex: p.slot_index,
      })),
    };
  }

  private toMapLayout(row: RawMapLayoutRow): MapLayout {
    return {
      id: row.id,
      name: row.name ?? '',
      description: row.description ?? '',
      created: row.created ?? '',
      modified: row.modified ?? '',
      isActive: row.is_active === 1,
    };
  }
}
