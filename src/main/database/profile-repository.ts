// ============================================================================
// Luminex Configurator — Profile Repository (CRUD for show_presets table)
// ============================================================================

import type Database from 'better-sqlite3';
import { DatabaseManager } from './database';

// ---------------------------------------------------------------------------
// Row shape (snake_case from the DB)
// ---------------------------------------------------------------------------

interface RawPresetRow {
  id: string;
  name: string | null;
  description: string | null;
  created: string | null;
  config_json: string | null;
  layout_id: string | null;
}

// ---------------------------------------------------------------------------
// Public camelCase shape
// ---------------------------------------------------------------------------

export interface ShowProfile {
  id: string;
  name: string;
  description: string;
  created: string;
  configJson: Record<string, unknown> | null;
  layoutId: string | null;
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export class ProfileRepository {
  private db: Database.Database;

  private stmtGetAll: Database.Statement;
  private stmtGetById: Database.Statement;
  private stmtUpsert: Database.Statement;
  private stmtDelete: Database.Statement;

  constructor(private manager: DatabaseManager) {
    this.db = manager.getDb();

    this.stmtGetAll = this.db.prepare(
      'SELECT * FROM show_presets ORDER BY name ASC',
    );

    this.stmtGetById = this.db.prepare(
      'SELECT * FROM show_presets WHERE id = ?',
    );

    this.stmtUpsert = this.db.prepare(`
      INSERT INTO show_presets (id, name, description, created, config_json, layout_id)
      VALUES (@id, @name, @description, @created, @config_json, @layout_id)
      ON CONFLICT(id) DO UPDATE SET
        name        = excluded.name,
        description = excluded.description,
        config_json = excluded.config_json,
        layout_id   = excluded.layout_id
    `);

    this.stmtDelete = this.db.prepare('DELETE FROM show_presets WHERE id = ?');
  }

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------

  /** List all saved show profiles. */
  listProfiles(): ShowProfile[] {
    const rows = this.stmtGetAll.all() as RawPresetRow[];
    return rows.map(toShowProfile);
  }

  /** Get a single profile by ID. */
  getProfile(id: string): ShowProfile | null {
    const row = this.stmtGetById.get(id) as RawPresetRow | undefined;
    return row ? toShowProfile(row) : null;
  }

  /** Insert or update a profile. Accepts the camelCase ShowProfile shape. */
  saveProfile(profile: ShowProfile): void {
    this.stmtUpsert.run({
      id: profile.id,
      name: profile.name,
      description: profile.description,
      created: profile.created,
      config_json: profile.configJson ? JSON.stringify(profile.configJson) : null,
      layout_id: profile.layoutId ?? null,
    });
  }

  /** Delete a profile by ID. Returns true if a row was deleted. */
  deleteProfile(id: string): boolean {
    const result = this.stmtDelete.run(id);
    return result.changes > 0;
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function toShowProfile(row: RawPresetRow): ShowProfile {
  let configJson: Record<string, unknown> | null = null;
  if (row.config_json) {
    try {
      configJson = JSON.parse(row.config_json);
    } catch {
      configJson = null;
    }
  }

  return {
    id: row.id,
    name: row.name ?? '',
    description: row.description ?? '',
    created: row.created ?? '',
    configJson,
    layoutId: row.layout_id ?? null,
  };
}
