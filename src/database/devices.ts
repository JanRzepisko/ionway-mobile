// =============================================================================
// Devices Repository - Local Database Operations
// =============================================================================

import * as Crypto from 'expo-crypto';
import { getDatabase } from './schema';
import { Device, DeviceFilters, SyncStatus } from '../types';

// -----------------------------------------------------------------------------
// Device CRUD Operations
// -----------------------------------------------------------------------------

export async function saveDevice(device: Device): Promise<void> {
  const db = await getDatabase();
  
  await db.runAsync(
    `INSERT OR REPLACE INTO devices 
     (id, local_id, server_id, project_id, element_id, name, znacznik, building, level, zone, 
      system, "group", type, drawing_number, route_number, discipline_code,
      is_new, created_locally, created_by_user_id, created_at, audit_count,
      last_audit_at, additional_data_json, sync_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      device.id,
      device.localId,
      device.serverId ?? null,
      device.projectId,
      device.elementId,
      device.name,
      device.znacznik ?? null,
      device.building ?? null,
      device.level ?? null,
      device.zone ?? null,
      device.system ?? null,
      device.group ?? null,
      device.type ?? null,
      device.drawingNumber ?? null,
      device.routeNumber ?? null,
      device.disciplineCode ?? null,
      device.isNew ? 1 : 0,
      device.createdLocally ? 1 : 0,
      device.createdByUserId ?? null,
      device.createdAt,
      device.auditCount,
      device.lastAuditAt ?? null,
      device.additionalDataJson ?? null,
      device.syncStatus
    ]
  );
}

export async function saveDevices(devices: Device[]): Promise<void> {
  const db = await getDatabase();
  
  for (const device of devices) {
    await saveDevice(device);
  }
}

export async function getDevice(deviceId: string): Promise<Device | null> {
  const db = await getDatabase();
  
  const row = await db.getFirstAsync<DeviceRow>(
    'SELECT * FROM devices WHERE id = ? OR local_id = ?',
    [deviceId, deviceId]
  );

  return row ? mapRowToDevice(row) : null;
}

export async function getDeviceByLocalId(localId: string): Promise<Device | null> {
  const db = await getDatabase();
  
  const row = await db.getFirstAsync<DeviceRow>(
    'SELECT * FROM devices WHERE local_id = ?',
    [localId]
  );

  return row ? mapRowToDevice(row) : null;
}

export async function getDevicesByProject(projectId: string): Promise<Device[]> {
  const db = await getDatabase();
  
  const rows = await db.getAllAsync<DeviceRow>(
    'SELECT * FROM devices WHERE project_id = ? ORDER BY name',
    [projectId]
  );

  return rows.map(mapRowToDevice);
}

export async function deleteDevicesByProject(projectId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM devices WHERE project_id = ?', [projectId]);
}

// -----------------------------------------------------------------------------
// Cascading Filters
// -----------------------------------------------------------------------------

export interface PaginatedDevicesResult {
  items: Device[];
  totalCount: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

function buildFilterQuery(
  projectId: string,
  filters: DeviceFilters
): { whereClause: string; params: (string | null)[] } {
  let whereClause = 'WHERE project_id = ?';
  const params: (string | null)[] = [projectId];

  if (filters.building) {
    whereClause += ' AND building = ?';
    params.push(filters.building);
  }
  if (filters.level) {
    whereClause += ' AND level = ?';
    params.push(filters.level);
  }
  if (filters.zone) {
    whereClause += ' AND zone = ?';
    params.push(filters.zone);
  }
  if (filters.system) {
    whereClause += ' AND system = ?';
    params.push(filters.system);
  }
  if (filters.group) {
    whereClause += ' AND "group" = ?';
    params.push(filters.group);
  }
  if (filters.type) {
    whereClause += ' AND type = ?';
    params.push(filters.type);
  }
  if (filters.searchQuery) {
    whereClause += ' AND (name LIKE ? OR element_id LIKE ? OR drawing_number LIKE ?)';
    const search = `%${filters.searchQuery}%`;
    params.push(search, search, search);
  }

  return { whereClause, params };
}

export async function getFilteredDevices(
  projectId: string,
  filters: DeviceFilters
): Promise<Device[]> {
  const db = await getDatabase();
  const { whereClause, params } = buildFilterQuery(projectId, filters);

  const query = `SELECT * FROM devices ${whereClause} ORDER BY name`;
  const rows = await db.getAllAsync<DeviceRow>(query, params);
  return rows.map(mapRowToDevice);
}

export async function getFilteredDevicesPaginated(
  projectId: string,
  filters: DeviceFilters,
  page: number = 1,
  pageSize: number = 30
): Promise<PaginatedDevicesResult> {
  const db = await getDatabase();
  const { whereClause, params } = buildFilterQuery(projectId, filters);

  const countResult = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM devices ${whereClause}`,
    params
  );
  const totalCount = countResult?.count ?? 0;

  const offset = (page - 1) * pageSize;
  const query = `SELECT * FROM devices ${whereClause} ORDER BY name LIMIT ? OFFSET ?`;
  const rows = await db.getAllAsync<DeviceRow>(query, [...params, pageSize, offset]);

  return {
    items: rows.map(mapRowToDevice),
    totalCount,
    page,
    pageSize,
    hasMore: offset + rows.length < totalCount,
  };
}

export async function getFilteredDevicesCount(
  projectId: string,
  filters: DeviceFilters
): Promise<number> {
  const db = await getDatabase();
  const { whereClause, params } = buildFilterQuery(projectId, filters);

  const result = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM devices ${whereClause}`,
    params
  );
  return result?.count ?? 0;
}

export async function getDistinctBuildings(projectId: string): Promise<string[]> {
  const db = await getDatabase();
  
  const rows = await db.getAllAsync<{ building: string }>(
    `SELECT DISTINCT building FROM devices 
     WHERE project_id = ? AND building IS NOT NULL AND building != ''
     ORDER BY building`,
    [projectId]
  );

  return rows.map(r => r.building);
}

export async function getDistinctLevels(
  projectId: string,
  building?: string
): Promise<string[]> {
  const db = await getDatabase();
  
  let query = `SELECT DISTINCT level FROM devices 
               WHERE project_id = ? AND level IS NOT NULL AND level != ''`;
  const params: string[] = [projectId];

  if (building) {
    query += ' AND building = ?';
    params.push(building);
  }

  query += ' ORDER BY level';

  const rows = await db.getAllAsync<{ level: string }>(query, params);
  return rows.map(r => r.level);
}

export async function getDistinctZones(
  projectId: string,
  building?: string,
  level?: string
): Promise<string[]> {
  const db = await getDatabase();
  
  let query = `SELECT DISTINCT zone FROM devices 
               WHERE project_id = ? AND zone IS NOT NULL AND zone != ''`;
  const params: string[] = [projectId];

  if (building) {
    query += ' AND building = ?';
    params.push(building);
  }
  if (level) {
    query += ' AND level = ?';
    params.push(level);
  }

  query += ' ORDER BY zone';

  const rows = await db.getAllAsync<{ zone: string }>(query, params);
  return rows.map(r => r.zone);
}

export async function getDistinctSystems(
  projectId: string,
  building?: string,
  level?: string,
  zone?: string
): Promise<string[]> {
  const db = await getDatabase();
  
  let query = `SELECT DISTINCT system FROM devices 
               WHERE project_id = ? AND system IS NOT NULL AND system != ''`;
  const params: string[] = [projectId];

  if (building) {
    query += ' AND building = ?';
    params.push(building);
  }
  if (level) {
    query += ' AND level = ?';
    params.push(level);
  }
  if (zone) {
    query += ' AND zone = ?';
    params.push(zone);
  }

  query += ' ORDER BY system';

  const rows = await db.getAllAsync<{ system: string }>(query, params);
  return rows.map(r => r.system);
}

export async function getDistinctGroups(
  projectId: string,
  filters: Partial<DeviceFilters>
): Promise<string[]> {
  const db = await getDatabase();
  
  let query = `SELECT DISTINCT "group" FROM devices 
               WHERE project_id = ? AND "group" IS NOT NULL AND "group" != ''`;
  const params: string[] = [projectId];

  if (filters.building) {
    query += ' AND building = ?';
    params.push(filters.building);
  }
  if (filters.level) {
    query += ' AND level = ?';
    params.push(filters.level);
  }
  if (filters.zone) {
    query += ' AND zone = ?';
    params.push(filters.zone);
  }
  if (filters.system) {
    query += ' AND system = ?';
    params.push(filters.system);
  }

  query += ' ORDER BY "group"';

  const rows = await db.getAllAsync<{ group: string }>(query, params);
  return rows.map(r => r.group);
}

export async function getDistinctTypes(
  projectId: string,
  filters: Partial<DeviceFilters>
): Promise<string[]> {
  const db = await getDatabase();
  
  let query = `SELECT DISTINCT type FROM devices 
               WHERE project_id = ? AND type IS NOT NULL AND type != ''`;
  const params: string[] = [projectId];

  if (filters.building) {
    query += ' AND building = ?';
    params.push(filters.building);
  }
  if (filters.level) {
    query += ' AND level = ?';
    params.push(filters.level);
  }
  if (filters.zone) {
    query += ' AND zone = ?';
    params.push(filters.zone);
  }
  if (filters.system) {
    query += ' AND system = ?';
    params.push(filters.system);
  }
  if (filters.group) {
    query += ' AND "group" = ?';
    params.push(filters.group);
  }

  query += ' ORDER BY type';

  const rows = await db.getAllAsync<{ type: string }>(query, params);
  return rows.map(r => r.type);
}

export async function getDistinctDrawingNumbers(
  projectId: string,
  filters?: {
    building?: string;
    level?: string;
    zone?: string;
    system?: string;
    group?: string;
    type?: string;
  }
): Promise<string[]> {
  const db = await getDatabase();
  
  let query = `SELECT DISTINCT drawing_number FROM devices 
               WHERE project_id = ? AND drawing_number IS NOT NULL AND drawing_number != ''`;
  const params: string[] = [projectId];

  if (filters?.building) {
    query += ` AND building = ?`;
    params.push(filters.building);
  }
  if (filters?.level) {
    query += ` AND level = ?`;
    params.push(filters.level);
  }
  if (filters?.zone) {
    query += ` AND zone = ?`;
    params.push(filters.zone);
  }
  if (filters?.system) {
    query += ` AND system = ?`;
    params.push(filters.system);
  }
  if (filters?.group) {
    query += ` AND "group" = ?`;
    params.push(filters.group);
  }
  if (filters?.type) {
    query += ` AND type = ?`;
    params.push(filters.type);
  }

  query += ` ORDER BY drawing_number`;

  const rows = await db.getAllAsync<{ drawing_number: string }>(query, params);
  return rows.map(r => r.drawing_number);
}

// -----------------------------------------------------------------------------
// Create New Device Offline
// -----------------------------------------------------------------------------

export async function createDeviceOffline(
  projectId: string,
  userId: string,
  userFirstName: string,
  userLastName: string,
  data: {
    name: string;
    building?: string;
    level?: string;
    zone?: string;
    system?: string;
    group?: string;
    type?: string;
    drawingNumber?: string;
    routeNumber?: string;
    disciplineCode?: string;
  }
): Promise<Device> {
  const localId = Crypto.randomUUID();
  const elementId = await generateElementId(projectId, data);
  const znacznik = await generateZnacznik(userId, userFirstName, userLastName);
  
  const device: Device = {
    id: localId,
    localId,
    projectId,
    elementId,
    name: data.name,
    znacznik,
    building: data.building,
    level: data.level,
    zone: data.zone,
    system: data.system,
    group: data.group,
    type: data.type,
    drawingNumber: data.drawingNumber,
    routeNumber: data.routeNumber,
    disciplineCode: data.disciplineCode,
    isNew: true,
    createdLocally: true,
    createdByUserId: userId,
    createdAt: Date.now(),
    auditCount: 0,
    syncStatus: 'pending_upload' as SyncStatus,
  };

  await saveDevice(device);
  return device;
}

/**
 * Preview next znacznik for a user (without incrementing counter).
 * Used to show what znacznik will be assigned before creating device.
 */
export async function getNextZnacznikPreview(
  userId: string,
  firstName: string,
  lastName: string
): Promise<string> {
  const db = await getDatabase();
  
  // Get current counter for this user (don't increment)
  const existing = await db.getFirstAsync<{ counter: number }>(
    'SELECT counter FROM znacznik_counters WHERE user_id = ?',
    [userId]
  );
  
  const nextCounter = (existing?.counter ?? 0) + 1;
  
  // Format: Z00001
  const counterPart = 'Z' + nextCounter.toString().padStart(5, '0');
  
  // Get initials (first letter of first name + first letter of last name)
  const initials = (
    (firstName?.charAt(0) || 'X') + 
    (lastName?.charAt(0) || 'X')
  ).toUpperCase();
  
  // Get last 2 characters of user GUID
  const guidSuffix = userId.slice(-2).toLowerCase();
  
  return counterPart + initials + guidSuffix;
}

/**
 * Generate auto-marker (znacznik) for new devices.
 * Format: Z00001JK0b
 * - Z + 5-digit counter (per user)
 * - First letter of first name + first letter of last name (uppercase)
 * - Last 2 characters of user GUID
 */
async function generateZnacznik(
  userId: string,
  firstName: string,
  lastName: string
): Promise<string> {
  const db = await getDatabase();
  
  // Get and increment counter for this user
  const existing = await db.getFirstAsync<{ counter: number }>(
    'SELECT counter FROM znacznik_counters WHERE user_id = ?',
    [userId]
  );
  
  let counter: number;
  if (existing) {
    counter = existing.counter + 1;
    await db.runAsync(
      'UPDATE znacznik_counters SET counter = ? WHERE user_id = ?',
      [counter, userId]
    );
  } else {
    counter = 1;
    await db.runAsync(
      'INSERT INTO znacznik_counters (user_id, counter) VALUES (?, ?)',
      [userId, counter]
    );
  }
  
  // Format: Z00001
  const counterPart = 'Z' + counter.toString().padStart(5, '0');
  
  // Get initials (first letter of first name + first letter of last name)
  const initials = (
    (firstName?.charAt(0) || 'X') + 
    (lastName?.charAt(0) || 'X')
  ).toUpperCase();
  
  // Get last 2 characters of user GUID
  const guidSuffix = userId.slice(-2).toLowerCase();
  
  return counterPart + initials + guidSuffix;
}

async function generateElementId(
  projectId: string,
  data: { building?: string; level?: string; type?: string }
): Promise<string> {
  const db = await getDatabase();
  
  const prefix = [
    data.building || 'XX',
    data.level || 'XX',
    data.type?.substring(0, 3).toUpperCase() || 'DEV'
  ].join('-');

  const existingCount = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM devices 
     WHERE project_id = ? AND element_id LIKE ?`,
    [projectId, `${prefix}-%`]
  );

  const nextNumber = (existingCount?.count ?? 0) + 1;
  return `${prefix}-${String(nextNumber).padStart(4, '0')}`;
}

// -----------------------------------------------------------------------------
// Sync Status Updates
// -----------------------------------------------------------------------------

export async function updateDeviceSyncStatus(
  localId: string,
  status: SyncStatus,
  serverId?: string
): Promise<void> {
  const db = await getDatabase();
  
  if (serverId) {
    await db.runAsync(
      'UPDATE devices SET sync_status = ?, server_id = ? WHERE local_id = ?',
      [status, serverId, localId]
    );
  } else {
    await db.runAsync(
      'UPDATE devices SET sync_status = ? WHERE local_id = ?',
      [status, localId]
    );
  }
}

export async function getPendingDevices(projectId: string): Promise<Device[]> {
  const db = await getDatabase();
  
  // Include 'uploading' status - these are stuck uploads that need retry
  const rows = await db.getAllAsync<DeviceRow>(
    `SELECT * FROM devices 
     WHERE project_id = ? AND sync_status IN ('local_only', 'pending_upload', 'upload_error', 'uploading')
     ORDER BY created_at`,
    [projectId]
  );

  return rows.map(mapRowToDevice);
}

export async function getDeviceCount(projectId: string): Promise<number> {
  const db = await getDatabase();
  
  const result = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM devices WHERE project_id = ?',
    [projectId]
  );

  return result?.count ?? 0;
}

/**
 * Fix stuck devices that have 'uploading' status
 * These are devices where upload was interrupted and status wasn't reverted
 */
export async function fixStuckUploadingDevices(projectId: string): Promise<number> {
  const db = await getDatabase();
  
  const result = await db.runAsync(
    `UPDATE devices 
     SET sync_status = 'pending_upload'
     WHERE project_id = ? AND sync_status = 'uploading'`,
    [projectId]
  );
  
  if (result.changes > 0) {
    console.log(`[DB] Fixed ${result.changes} stuck uploading devices`);
  }
  
  return result.changes;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

interface DeviceRow {
  id: string;
  local_id: string;
  server_id: string | null;
  project_id: string;
  element_id: string;
  name: string;
  znacznik: string | null;
  building: string | null;
  level: string | null;
  zone: string | null;
  system: string | null;
  group: string | null;
  type: string | null;
  drawing_number: string | null;
  route_number: string | null;
  discipline_code: string | null;
  is_new: number;
  created_locally: number;
  created_by_user_id: string | null;
  created_at: number;
  audit_count: number;
  last_audit_at: number | null;
  additional_data_json: string | null;
  sync_status: string;
}

function mapRowToDevice(row: DeviceRow): Device {
  return {
    id: row.id,
    localId: row.local_id,
    serverId: row.server_id ?? undefined,
    projectId: row.project_id,
    elementId: row.element_id,
    name: row.name,
    znacznik: row.znacznik ?? undefined,
    building: row.building ?? undefined,
    level: row.level ?? undefined,
    zone: row.zone ?? undefined,
    system: row.system ?? undefined,
    group: row.group ?? undefined,
    type: row.type ?? undefined,
    drawingNumber: row.drawing_number ?? undefined,
    routeNumber: row.route_number ?? undefined,
    disciplineCode: row.discipline_code ?? undefined,
    isNew: row.is_new === 1,
    createdLocally: row.created_locally === 1,
    createdByUserId: row.created_by_user_id ?? undefined,
    createdAt: row.created_at,
    auditCount: row.audit_count,
    lastAuditAt: row.last_audit_at ?? undefined,
    additionalDataJson: row.additional_data_json ?? undefined,
    syncStatus: row.sync_status as SyncStatus,
  };
}
