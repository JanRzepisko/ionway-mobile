import { getDatabase } from './schema';
import * as Crypto from 'expo-crypto';

export interface AuditPhoto {
  id: string;
  localId: string;
  serverId: string | null;
  auditSessionId: string;
  auditSessionLocalId: string;
  deviceId: string;
  localUri: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  description: string | null;
  uploadedByUserId: string;
  createdAt: Date;
  syncStatus: 'local_only' | 'pending_upload' | 'synced' | 'error';
}

interface AuditPhotoRow {
  id: string;
  local_id: string;
  server_id: string | null;
  audit_session_id: string;
  audit_session_local_id: string;
  device_id: string;
  local_uri: string;
  file_name: string;
  content_type: string;
  size_bytes: number;
  description: string | null;
  uploaded_by_user_id: string;
  created_at: number;
  sync_status: string;
}

function mapRowToPhoto(row: AuditPhotoRow): AuditPhoto {
  return {
    id: row.id,
    localId: row.local_id,
    serverId: row.server_id,
    auditSessionId: row.audit_session_id,
    auditSessionLocalId: row.audit_session_local_id,
    deviceId: row.device_id,
    localUri: row.local_uri,
    fileName: row.file_name,
    contentType: row.content_type,
    sizeBytes: row.size_bytes,
    description: row.description,
    uploadedByUserId: row.uploaded_by_user_id,
    createdAt: new Date(row.created_at),
    syncStatus: row.sync_status as AuditPhoto['syncStatus'],
  };
}

/**
 * Create a new audit photo record
 */
export async function createAuditPhoto(
  auditSessionId: string,
  auditSessionLocalId: string,
  deviceId: string,
  localUri: string,
  fileName: string,
  contentType: string,
  sizeBytes: number,
  uploadedByUserId: string,
  description?: string
): Promise<AuditPhoto> {
  const db = await getDatabase();
  
  const id = Crypto.randomUUID();
  const localId = Crypto.randomUUID();
  const createdAt = Date.now();
  
  await db.runAsync(
    `INSERT INTO audit_photos (
      id, local_id, audit_session_id, audit_session_local_id,
      device_id, local_uri, file_name, content_type, size_bytes,
      description, uploaded_by_user_id, created_at, sync_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'local_only')`,
    [
      id, localId, auditSessionId, auditSessionLocalId,
      deviceId, localUri, fileName, contentType, sizeBytes,
      description ?? null, uploadedByUserId, createdAt
    ]
  );
  
  console.log(`[DB Photos] Created photo ${localId} for device ${deviceId}`);
  
  return {
    id,
    localId,
    serverId: null,
    auditSessionId,
    auditSessionLocalId,
    deviceId,
    localUri,
    fileName,
    contentType,
    sizeBytes,
    description: description ?? null,
    uploadedByUserId,
    createdAt: new Date(createdAt),
    syncStatus: 'local_only',
  };
}

/**
 * Create photo records for multiple devices (batch audit)
 */
export async function createAuditPhotosForDevices(
  auditSessionId: string,
  auditSessionLocalId: string,
  deviceIds: string[],
  localUri: string,
  fileName: string,
  contentType: string,
  sizeBytes: number,
  uploadedByUserId: string,
  description?: string
): Promise<AuditPhoto[]> {
  const photos: AuditPhoto[] = [];
  
  for (const deviceId of deviceIds) {
    const photo = await createAuditPhoto(
      auditSessionId,
      auditSessionLocalId,
      deviceId,
      localUri,
      fileName,
      contentType,
      sizeBytes,
      uploadedByUserId,
      description
    );
    photos.push(photo);
  }
  
  console.log(`[DB Photos] Created ${photos.length} photo records for batch audit`);
  return photos;
}

/**
 * Get photos for a specific audit session
 */
export async function getPhotosBySession(
  auditSessionId: string
): Promise<AuditPhoto[]> {
  const db = await getDatabase();
  
  const rows = await db.getAllAsync<AuditPhotoRow>(
    `SELECT * FROM audit_photos WHERE audit_session_id = ? ORDER BY created_at DESC`,
    [auditSessionId]
  );
  
  return rows.map(mapRowToPhoto);
}

/**
 * Get photos for a specific device
 */
export async function getPhotosByDevice(
  deviceId: string
): Promise<AuditPhoto[]> {
  const db = await getDatabase();
  
  const rows = await db.getAllAsync<AuditPhotoRow>(
    `SELECT * FROM audit_photos WHERE device_id = ? ORDER BY created_at DESC`,
    [deviceId]
  );
  
  return rows.map(mapRowToPhoto);
}

/**
 * Get all photos pending upload
 */
export async function getPhotosPendingUpload(): Promise<AuditPhoto[]> {
  const db = await getDatabase();
  
  const rows = await db.getAllAsync<AuditPhotoRow>(
    `SELECT * FROM audit_photos WHERE sync_status IN ('local_only', 'pending_upload') ORDER BY created_at ASC`
  );
  
  return rows.map(mapRowToPhoto);
}

/**
 * Get all photos pending upload for a specific project
 */
export async function getPhotosPendingUploadForProject(
  projectId: string
): Promise<AuditPhoto[]> {
  const db = await getDatabase();
  
  const rows = await db.getAllAsync<AuditPhotoRow>(
    `SELECT ap.* FROM audit_photos ap
     JOIN audit_sessions s ON ap.audit_session_id = s.id
     WHERE s.project_id = ? AND ap.sync_status IN ('local_only', 'pending_upload')
     ORDER BY ap.created_at ASC`,
    [projectId]
  );
  
  return rows.map(mapRowToPhoto);
}

/**
 * Update photo sync status after upload
 */
export async function markPhotoAsSynced(
  localId: string,
  serverId: string
): Promise<void> {
  const db = await getDatabase();
  
  await db.runAsync(
    `UPDATE audit_photos SET server_id = ?, sync_status = 'synced' WHERE local_id = ?`,
    [serverId, localId]
  );
  
  console.log(`[DB Photos] Marked photo ${localId} as synced with server ID ${serverId}`);
}

/**
 * Mark photo upload as failed
 */
export async function markPhotoUploadError(
  localId: string
): Promise<void> {
  const db = await getDatabase();
  
  await db.runAsync(
    `UPDATE audit_photos SET sync_status = 'error' WHERE local_id = ?`,
    [localId]
  );
}

/**
 * Delete a photo by local ID
 */
export async function deletePhoto(localId: string): Promise<void> {
  const db = await getDatabase();
  
  await db.runAsync(
    `DELETE FROM audit_photos WHERE local_id = ?`,
    [localId]
  );
  
  console.log(`[DB Photos] Deleted photo ${localId}`);
}

/**
 * Delete all photos for a session
 */
export async function deletePhotosBySession(
  auditSessionId: string
): Promise<void> {
  const db = await getDatabase();
  
  await db.runAsync(
    `DELETE FROM audit_photos WHERE audit_session_id = ?`,
    [auditSessionId]
  );
}

/**
 * Get photo by local ID
 */
export async function getPhotoByLocalId(
  localId: string
): Promise<AuditPhoto | null> {
  const db = await getDatabase();
  
  const row = await db.getFirstAsync<AuditPhotoRow>(
    `SELECT * FROM audit_photos WHERE local_id = ?`,
    [localId]
  );
  
  return row ? mapRowToPhoto(row) : null;
}

/**
 * Count photos for a device
 */
export async function countPhotosForDevice(
  deviceId: string
): Promise<number> {
  const db = await getDatabase();
  
  const result = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM audit_photos WHERE device_id = ?`,
    [deviceId]
  );
  
  return result?.count ?? 0;
}
