// =============================================================================
// Projects Repository - Local Database Operations
// =============================================================================

import { getDatabase } from './schema';
import { Project } from '../types';

export async function saveProject(project: Project): Promise<void> {
  const db = await getDatabase();
  
  await db.runAsync(
    `INSERT OR REPLACE INTO projects 
     (id, name, description, status, import_version, last_sync_at, device_count, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      project.id,
      project.name,
      project.description ?? null,
      project.status,
      project.importVersion,
      project.lastSyncAt ?? null,
      project.deviceCount,
      Date.now()
    ]
  );
}

export async function getProject(projectId: string): Promise<Project | null> {
  const db = await getDatabase();
  
  const row = await db.getFirstAsync<{
    id: string;
    name: string;
    description: string | null;
    status: string;
    import_version: number;
    last_sync_at: number | null;
    device_count: number;
  }>(
    'SELECT * FROM projects WHERE id = ?',
    [projectId]
  );

  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    status: row.status,
    importVersion: row.import_version,
    lastSyncAt: row.last_sync_at ?? undefined,
    deviceCount: row.device_count,
  };
}

export async function getAllProjects(): Promise<Project[]> {
  const db = await getDatabase();
  
  const rows = await db.getAllAsync<{
    id: string;
    name: string;
    description: string | null;
    status: string;
    import_version: number;
    last_sync_at: number | null;
    device_count: number;
  }>('SELECT * FROM projects ORDER BY name');

  return rows.map(row => ({
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    status: row.status,
    importVersion: row.import_version,
    lastSyncAt: row.last_sync_at ?? undefined,
    deviceCount: row.device_count,
  }));
}

export async function updateProjectSyncState(
  projectId: string, 
  importVersion: number,
  deviceCount: number
): Promise<void> {
  const db = await getDatabase();
  
  await db.runAsync(
    `UPDATE projects 
     SET import_version = ?, last_sync_at = ?, device_count = ?
     WHERE id = ?`,
    [importVersion, Date.now(), deviceCount, projectId]
  );
}

export async function deleteProject(projectId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM projects WHERE id = ?', [projectId]);
}
