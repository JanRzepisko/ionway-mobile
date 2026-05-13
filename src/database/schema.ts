// =============================================================================
// Audix - SQLite Database Schema
// Offline-First Architecture
// =============================================================================

import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;
let migrationsRan = false;

/**
 * Get or create the database instance
 */
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync('audix_offline.db');
    await initializeDatabase();
  }
  
  // Always run migrations on first call per session
  if (!migrationsRan) {
    await runMigrations(db);
    migrationsRan = true;
  }
  
  return db;
}

/**
 * Initialize all database tables
 */
async function initializeDatabase() {
  if (!db) return;

  await db.execAsync(`
    -- =========================================================================
    -- PROJECTS
    -- =========================================================================
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      import_version INTEGER NOT NULL DEFAULT 0,
      last_sync_at INTEGER,
      device_count INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
    );

    -- =========================================================================
    -- DEVICES
    -- =========================================================================
    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      local_id TEXT NOT NULL UNIQUE,
      server_id TEXT,
      project_id TEXT NOT NULL,
      element_id TEXT NOT NULL,
      name TEXT NOT NULL,
      znacznik TEXT,
      building TEXT,
      level TEXT,
      zone TEXT,
      system TEXT,
      "group" TEXT,
      type TEXT,
      drawing_number TEXT,
      route_number TEXT,
      discipline_code TEXT,
      is_new INTEGER DEFAULT 0,
      created_locally INTEGER DEFAULT 0,
      created_by_user_id TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
      audit_count INTEGER DEFAULT 0,
      last_audit_at INTEGER,
      additional_data_json TEXT,
      sync_status TEXT NOT NULL DEFAULT 'synced',
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_devices_project ON devices(project_id);
    CREATE INDEX IF NOT EXISTS idx_devices_local_id ON devices(local_id);
    CREATE INDEX IF NOT EXISTS idx_devices_server_id ON devices(server_id);
    CREATE INDEX IF NOT EXISTS idx_devices_building ON devices(project_id, building);
    CREATE INDEX IF NOT EXISTS idx_devices_level ON devices(project_id, level);
    CREATE INDEX IF NOT EXISTS idx_devices_zone ON devices(project_id, zone);
    CREATE INDEX IF NOT EXISTS idx_devices_sync_status ON devices(sync_status);
    CREATE INDEX IF NOT EXISTS idx_devices_znacznik ON devices(znacznik);

    -- =========================================================================
    -- FORM TABS
    -- =========================================================================
    CREATE TABLE IF NOT EXISTS form_tabs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      tab_number INTEGER NOT NULL,
      tab_type TEXT NOT NULL,
      title TEXT NOT NULL,
      display_order INTEGER NOT NULL,
      is_active INTEGER DEFAULT 1,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_form_tabs_project ON form_tabs(project_id);
    CREATE INDEX IF NOT EXISTS idx_form_tabs_type ON form_tabs(project_id, tab_type);

    -- =========================================================================
    -- FORM FIELDS
    -- =========================================================================
    CREATE TABLE IF NOT EXISTS form_fields (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      form_tab_id TEXT,
      source_row_number INTEGER,
      logical_data_column_number INTEGER,
      tab_number INTEGER NOT NULL,
      tab_type TEXT NOT NULL,
      display_order INTEGER NOT NULL,
      field_type TEXT NOT NULL,
      label TEXT NOT NULL,
      description TEXT,
      question TEXT,
      option_set_id TEXT,
      target_data_column_name TEXT,
      is_required INTEGER DEFAULT 0,
      is_visible INTEGER DEFAULT 1,
      is_active INTEGER DEFAULT 1,
      default_value TEXT,
      validation_rules_json TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (form_tab_id) REFERENCES form_tabs(id) ON DELETE SET NULL,
      FOREIGN KEY (option_set_id) REFERENCES option_sets(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_form_fields_project ON form_fields(project_id);
    CREATE INDEX IF NOT EXISTS idx_form_fields_tab ON form_fields(form_tab_id);
    CREATE INDEX IF NOT EXISTS idx_form_fields_type ON form_fields(project_id, tab_type);

    -- =========================================================================
    -- OPTION SETS
    -- =========================================================================
    CREATE TABLE IF NOT EXISTS option_sets (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      source TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_option_sets_project ON option_sets(project_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_option_sets_code ON option_sets(project_id, code);

    -- =========================================================================
    -- OPTION VALUES
    -- =========================================================================
    CREATE TABLE IF NOT EXISTS option_values (
      id TEXT PRIMARY KEY,
      option_set_id TEXT NOT NULL,
      value TEXT NOT NULL,
      label TEXT NOT NULL,
      display_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      FOREIGN KEY (option_set_id) REFERENCES option_sets(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_option_values_set ON option_values(option_set_id);

    -- =========================================================================
    -- DATA COLUMN MAPPINGS
    -- =========================================================================
    CREATE TABLE IF NOT EXISTS data_column_mappings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT NOT NULL,
      logical_data_column_number INTEGER NOT NULL,
      column_name TEXT NOT NULL,
      excel_column_index INTEGER NOT NULL,
      section_name TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_column_mappings_project ON data_column_mappings(project_id);

    -- =========================================================================
    -- AUDIT SESSIONS
    -- =========================================================================
    CREATE TABLE IF NOT EXISTS audit_sessions (
      id TEXT PRIMARY KEY,
      local_id TEXT NOT NULL UNIQUE,
      server_id TEXT,
      project_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      device_local_id TEXT NOT NULL,
      auditor_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'in_progress',
      started_at INTEGER NOT NULL,
      completed_at INTEGER,
      created_offline INTEGER DEFAULT 1,
      notes TEXT,
      sync_status TEXT NOT NULL DEFAULT 'local_only',
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_audit_sessions_project ON audit_sessions(project_id);
    CREATE INDEX IF NOT EXISTS idx_audit_sessions_device ON audit_sessions(device_id);
    CREATE INDEX IF NOT EXISTS idx_audit_sessions_local_id ON audit_sessions(local_id);
    CREATE INDEX IF NOT EXISTS idx_audit_sessions_sync_status ON audit_sessions(sync_status);

    -- =========================================================================
    -- AUDIT ANSWERS
    -- =========================================================================
    CREATE TABLE IF NOT EXISTS audit_answers (
      id TEXT PRIMARY KEY,
      local_id TEXT NOT NULL UNIQUE,
      server_id TEXT,
      audit_session_id TEXT NOT NULL,
      audit_session_local_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      form_field_id TEXT NOT NULL,
      logical_data_column_number INTEGER,
      value_text TEXT,
      value_json TEXT,
      comment TEXT,
      auditor_id TEXT NOT NULL,
      auditor_name TEXT,
      answered_at INTEGER NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'local_only',
      FOREIGN KEY (audit_session_id) REFERENCES audit_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (form_field_id) REFERENCES form_fields(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_audit_answers_session ON audit_answers(audit_session_id);
    CREATE INDEX IF NOT EXISTS idx_audit_answers_local_id ON audit_answers(local_id);
    CREATE INDEX IF NOT EXISTS idx_audit_answers_field ON audit_answers(form_field_id);
    CREATE INDEX IF NOT EXISTS idx_audit_answers_sync_status ON audit_answers(sync_status);

    -- =========================================================================
    -- AUDIT PHOTOS
    -- =========================================================================
    CREATE TABLE IF NOT EXISTS audit_photos (
      id TEXT PRIMARY KEY,
      local_id TEXT NOT NULL UNIQUE,
      server_id TEXT,
      audit_session_id TEXT NOT NULL,
      audit_session_local_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      local_uri TEXT NOT NULL,
      file_name TEXT NOT NULL,
      content_type TEXT DEFAULT 'image/jpeg',
      size_bytes INTEGER DEFAULT 0,
      description TEXT,
      uploaded_by_user_id TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
      sync_status TEXT NOT NULL DEFAULT 'local_only',
      FOREIGN KEY (audit_session_id) REFERENCES audit_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_audit_photos_session ON audit_photos(audit_session_id);
    CREATE INDEX IF NOT EXISTS idx_audit_photos_device ON audit_photos(device_id);
    CREATE INDEX IF NOT EXISTS idx_audit_photos_local_id ON audit_photos(local_id);
    CREATE INDEX IF NOT EXISTS idx_audit_photos_sync_status ON audit_photos(sync_status);

    -- =========================================================================
    -- SYNC QUEUE
    -- =========================================================================
    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_local_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      attempts INTEGER DEFAULT 0,
      last_attempt_at INTEGER,
      error_message TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
    );

    CREATE INDEX IF NOT EXISTS idx_sync_queue_project ON sync_queue(project_id);
    CREATE INDEX IF NOT EXISTS idx_sync_queue_entity ON sync_queue(entity_type, entity_local_id);

    -- =========================================================================
    -- SYNC STATE
    -- =========================================================================
    CREATE TABLE IF NOT EXISTS sync_state (
      project_id TEXT PRIMARY KEY,
      import_version INTEGER NOT NULL DEFAULT 0,
      last_download_at INTEGER,
      last_upload_at INTEGER,
      device_count INTEGER DEFAULT 0,
      pending_uploads INTEGER DEFAULT 0,
      last_error TEXT
    );

    -- =========================================================================
    -- CURRENT USER (single row for logged in user)
    -- =========================================================================
    CREATE TABLE IF NOT EXISTS current_user (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      user_id TEXT NOT NULL,
      email TEXT NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL,
      access_token TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    );

    -- =========================================================================
    -- ZNACZNIK COUNTER (per-user marker numbering)
    -- =========================================================================
    CREATE TABLE IF NOT EXISTS znacznik_counters (
      user_id TEXT PRIMARY KEY,
      counter INTEGER NOT NULL DEFAULT 0
    );
  `);

}

/**
 * Run schema migrations for existing databases
 */
async function runMigrations(database: SQLite.SQLiteDatabase): Promise<void> {
  console.log('[DB Migration] Running migrations...');
  
  // Migration 1: Add znacznik column to devices table
  try {
    const tableInfo = await database.getAllAsync<{ name: string }>(
      `PRAGMA table_info(devices)`
    );
    const columnNames = tableInfo.map(col => col.name);
    console.log('[DB Migration] devices columns:', columnNames.join(', '));
    
    const hasZnacznik = columnNames.includes('znacznik');
    
    if (!hasZnacznik) {
      console.log('[DB Migration] Adding znacznik column to devices table...');
      await database.execAsync(`ALTER TABLE devices ADD COLUMN znacznik TEXT`);
      console.log('[DB Migration] znacznik column added successfully!');
    } else {
      console.log('[DB Migration] znacznik column already exists');
    }
  } catch (e) {
    console.error('[DB Migration] Error in migration 1:', e);
  }
  
  // Migration 2: Create audit_photos table if not exists
  try {
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS audit_photos (
        id TEXT PRIMARY KEY,
        local_id TEXT NOT NULL UNIQUE,
        server_id TEXT,
        audit_session_id TEXT NOT NULL,
        audit_session_local_id TEXT NOT NULL,
        device_id TEXT NOT NULL,
        local_uri TEXT NOT NULL,
        file_name TEXT NOT NULL,
        content_type TEXT DEFAULT 'image/jpeg',
        size_bytes INTEGER DEFAULT 0,
        description TEXT,
        uploaded_by_user_id TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
        sync_status TEXT NOT NULL DEFAULT 'local_only',
        FOREIGN KEY (audit_session_id) REFERENCES audit_sessions(id) ON DELETE CASCADE,
        FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_audit_photos_session ON audit_photos(audit_session_id);
      CREATE INDEX IF NOT EXISTS idx_audit_photos_device ON audit_photos(device_id);
      CREATE INDEX IF NOT EXISTS idx_audit_photos_local_id ON audit_photos(local_id);
      CREATE INDEX IF NOT EXISTS idx_audit_photos_sync_status ON audit_photos(sync_status);
    `);
    console.log('[DB Migration] audit_photos table ensured');
  } catch (e) {
    console.error('[DB Migration] Error in migration 2:', e);
  }
  
  console.log('[DB Migration] Migrations completed');
}

/**
 * Clear all local data (for logout or reset)
 */
export async function clearAllData(): Promise<void> {
  const database = await getDatabase();
  await database.execAsync(`
    DELETE FROM audit_photos;
    DELETE FROM audit_answers;
    DELETE FROM audit_sessions;
    DELETE FROM sync_queue;
    DELETE FROM sync_state;
    DELETE FROM data_column_mappings;
    DELETE FROM option_values;
    DELETE FROM option_sets;
    DELETE FROM form_fields;
    DELETE FROM form_tabs;
    DELETE FROM devices;
    DELETE FROM projects;
    DELETE FROM current_user;
  `);
}

/**
 * Clear project-specific data (for re-download)
 */
export async function clearProjectData(projectId: string): Promise<void> {
  const database = await getDatabase();
  await database.execAsync(`
    DELETE FROM audit_photos WHERE audit_session_id IN (
      SELECT id FROM audit_sessions WHERE project_id = '${projectId}'
    );
    DELETE FROM audit_answers WHERE audit_session_id IN (
      SELECT id FROM audit_sessions WHERE project_id = '${projectId}'
    );
    DELETE FROM audit_sessions WHERE project_id = '${projectId}';
    DELETE FROM sync_queue WHERE project_id = '${projectId}';
    DELETE FROM sync_state WHERE project_id = '${projectId}';
    DELETE FROM data_column_mappings WHERE project_id = '${projectId}';
    DELETE FROM option_values WHERE option_set_id IN (
      SELECT id FROM option_sets WHERE project_id = '${projectId}'
    );
    DELETE FROM option_sets WHERE project_id = '${projectId}';
    DELETE FROM form_fields WHERE project_id = '${projectId}';
    DELETE FROM form_tabs WHERE project_id = '${projectId}';
    DELETE FROM devices WHERE project_id = '${projectId}';
    DELETE FROM projects WHERE id = '${projectId}';
  `);
}

/**
 * Check if there's any local data available for offline work
 */
export async function hasLocalData(): Promise<boolean> {
  try {
    const database = await getDatabase();
    
    const projects = await database.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM projects'
    );
    
    return (projects?.count ?? 0) > 0;
  } catch {
    return false;
  }
}

/**
 * Get database statistics
 */
export async function getDatabaseStats(): Promise<{
  projects: number;
  devices: number;
  auditSessions: number;
  auditAnswers: number;
  auditPhotos: number;
  pendingUploads: number;
}> {
  const database = await getDatabase();
  
  const projects = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM projects'
  );
  const devices = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM devices'
  );
  const auditSessions = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM audit_sessions'
  );
  const auditAnswers = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM audit_answers'
  );
  const auditPhotos = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM audit_photos'
  );
  const pendingUploads = await database.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM audit_sessions WHERE sync_status != 'synced'"
  );

  return {
    projects: projects?.count ?? 0,
    devices: devices?.count ?? 0,
    auditSessions: auditSessions?.count ?? 0,
    auditAnswers: auditAnswers?.count ?? 0,
    auditPhotos: auditPhotos?.count ?? 0,
    pendingUploads: pendingUploads?.count ?? 0,
  };
}
