// =============================================================================
// Audits Repository - Local Database Operations
// =============================================================================

import * as Crypto from 'expo-crypto';
import { getDatabase } from './schema';
import { AuditSession, AuditAnswer, AuditStatus, SyncStatus } from '../types';

// -----------------------------------------------------------------------------
// Audit Sessions
// -----------------------------------------------------------------------------

export async function createAuditSession(
  projectId: string,
  deviceId: string,
  deviceLocalId: string,
  auditorId: string
): Promise<AuditSession> {
  const localId = Crypto.randomUUID();
  
  const session: AuditSession = {
    id: localId,
    localId,
    projectId,
    deviceId,
    deviceLocalId,
    auditorId,
    status: 'in_progress',
    startedAt: Date.now(),
    createdOffline: true,
    syncStatus: 'local_only',
  };

  await saveAuditSession(session);
  return session;
}

export async function saveAuditSession(session: AuditSession): Promise<void> {
  const db = await getDatabase();
  
  await db.runAsync(
    `INSERT OR REPLACE INTO audit_sessions 
     (id, local_id, server_id, project_id, device_id, device_local_id, auditor_id,
      status, started_at, completed_at, created_offline, notes, sync_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      session.id,
      session.localId,
      session.serverId ?? null,
      session.projectId,
      session.deviceId,
      session.deviceLocalId,
      session.auditorId,
      session.status,
      session.startedAt,
      session.completedAt ?? null,
      session.createdOffline ? 1 : 0,
      session.notes ?? null,
      session.syncStatus
    ]
  );
}

export async function getAuditSession(sessionId: string): Promise<AuditSession | null> {
  const db = await getDatabase();
  
  const row = await db.getFirstAsync<AuditSessionRow>(
    'SELECT * FROM audit_sessions WHERE id = ? OR local_id = ?',
    [sessionId, sessionId]
  );

  return row ? mapRowToAuditSession(row) : null;
}

export async function getAuditSessionByLocalId(localId: string): Promise<AuditSession | null> {
  const db = await getDatabase();
  
  const row = await db.getFirstAsync<AuditSessionRow>(
    'SELECT * FROM audit_sessions WHERE local_id = ?',
    [localId]
  );

  return row ? mapRowToAuditSession(row) : null;
}

export async function getAuditSessionsByDevice(deviceId: string): Promise<AuditSession[]> {
  const db = await getDatabase();
  
  const rows = await db.getAllAsync<AuditSessionRow>(
    'SELECT * FROM audit_sessions WHERE device_id = ? ORDER BY started_at DESC',
    [deviceId]
  );

  return rows.map(mapRowToAuditSession);
}

export async function getAuditSessionsByProject(projectId: string): Promise<AuditSession[]> {
  const db = await getDatabase();
  
  const rows = await db.getAllAsync<AuditSessionRow>(
    'SELECT * FROM audit_sessions WHERE project_id = ? ORDER BY started_at DESC',
    [projectId]
  );

  return rows.map(mapRowToAuditSession);
}

export async function getInProgressSession(
  deviceId: string
): Promise<AuditSession | null> {
  const db = await getDatabase();
  
  const row = await db.getFirstAsync<AuditSessionRow>(
    `SELECT * FROM audit_sessions 
     WHERE device_id = ? AND status = 'in_progress' 
     ORDER BY started_at DESC LIMIT 1`,
    [deviceId]
  );

  return row ? mapRowToAuditSession(row) : null;
}

export async function completeAuditSession(
  localId: string,
  notes?: string
): Promise<void> {
  const db = await getDatabase();
  
  await db.runAsync(
    `UPDATE audit_sessions 
     SET status = 'completed', completed_at = ?, notes = ?, sync_status = 'pending_upload'
     WHERE local_id = ?`,
    [Date.now(), notes ?? null, localId]
  );
}

export async function updateAuditSessionSyncStatus(
  localId: string,
  status: SyncStatus,
  serverId?: string
): Promise<void> {
  const db = await getDatabase();
  
  if (serverId) {
    await db.runAsync(
      'UPDATE audit_sessions SET sync_status = ?, server_id = ? WHERE local_id = ?',
      [status, serverId, localId]
    );
  } else {
    await db.runAsync(
      'UPDATE audit_sessions SET sync_status = ? WHERE local_id = ?',
      [status, localId]
    );
  }
}

export async function getPendingAuditSessions(projectId: string): Promise<AuditSession[]> {
  const db = await getDatabase();
  
  // Include 'uploading' status as pending - these are stuck uploads that need retry
  const rows = await db.getAllAsync<AuditSessionRow>(
    `SELECT * FROM audit_sessions 
     WHERE project_id = ? AND sync_status IN ('local_only', 'pending_upload', 'upload_error', 'uploading')
     ORDER BY started_at`,
    [projectId]
  );

  return rows.map(mapRowToAuditSession);
}

/**
 * Fix stuck audit sessions that have 'uploading' status
 * These are sessions where upload was interrupted and status wasn't reverted
 */
export async function fixStuckUploadingSessions(projectId: string): Promise<number> {
  const db = await getDatabase();
  
  const result = await db.runAsync(
    `UPDATE audit_sessions 
     SET sync_status = 'pending_upload'
     WHERE project_id = ? AND sync_status = 'uploading'`,
    [projectId]
  );
  
  if (result.changes > 0) {
    console.log(`[DB] Fixed ${result.changes} stuck uploading sessions`);
  }
  
  return result.changes;
}

// -----------------------------------------------------------------------------
// Audit Answers
// -----------------------------------------------------------------------------

export async function saveAuditAnswer(answer: AuditAnswer): Promise<void> {
  const db = await getDatabase();
  
  await db.runAsync(
    `INSERT OR REPLACE INTO audit_answers 
     (id, local_id, server_id, audit_session_id, audit_session_local_id, device_id,
      form_field_id, logical_data_column_number, value_text, value_json, comment,
      auditor_id, answered_at, sync_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      answer.id,
      answer.localId,
      answer.serverId ?? null,
      answer.auditSessionId,
      answer.auditSessionLocalId,
      answer.deviceId,
      answer.formFieldId,
      answer.logicalDataColumnNumber ?? null,
      answer.valueText ?? null,
      answer.valueJson ?? null,
      answer.comment ?? null,
      answer.auditorId,
      answer.answeredAt,
      answer.syncStatus
    ]
  );
}

export async function upsertAnswer(
  auditSessionId: string,
  auditSessionLocalId: string,
  deviceId: string,
  formFieldId: string,
  auditorId: string,
  value: string | null,
  logicalDataColumnNumber?: number,
  comment?: string
): Promise<AuditAnswer> {
  const db = await getDatabase();
  
  const existing = await db.getFirstAsync<AuditAnswerRow>(
    `SELECT * FROM audit_answers 
     WHERE audit_session_local_id = ? AND form_field_id = ?`,
    [auditSessionLocalId, formFieldId]
  );

  const now = Date.now();

  if (existing) {
    await db.runAsync(
      `UPDATE audit_answers 
       SET value_text = ?, comment = ?, answered_at = ?, sync_status = 'local_only'
       WHERE local_id = ?`,
      [value, comment ?? null, now, existing.local_id]
    );

    return {
      ...mapRowToAuditAnswer(existing),
      valueText: value ?? undefined,
      comment,
      answeredAt: now,
      syncStatus: 'local_only',
    };
  }

  const localId = Crypto.randomUUID();
  const answer: AuditAnswer = {
    id: localId,
    localId,
    auditSessionId,
    auditSessionLocalId,
    deviceId,
    formFieldId,
    logicalDataColumnNumber,
    valueText: value ?? undefined,
    comment,
    auditorId,
    answeredAt: now,
    syncStatus: 'local_only',
  };

  await saveAuditAnswer(answer);
  return answer;
}

export async function getAnswersBySession(sessionLocalId: string): Promise<AuditAnswer[]> {
  const db = await getDatabase();
  
  const rows = await db.getAllAsync<AuditAnswerRow>(
    'SELECT * FROM audit_answers WHERE audit_session_local_id = ? ORDER BY answered_at',
    [sessionLocalId]
  );

  return rows.map(mapRowToAuditAnswer);
}

export async function getAnswer(
  sessionLocalId: string,
  formFieldId: string
): Promise<AuditAnswer | null> {
  const db = await getDatabase();
  
  const row = await db.getFirstAsync<AuditAnswerRow>(
    `SELECT * FROM audit_answers 
     WHERE audit_session_local_id = ? AND form_field_id = ?`,
    [sessionLocalId, formFieldId]
  );

  return row ? mapRowToAuditAnswer(row) : null;
}

export async function getAnswersMap(
  sessionLocalId: string
): Promise<Map<string, AuditAnswer>> {
  const answers = await getAnswersBySession(sessionLocalId);
  
  const map = new Map<string, AuditAnswer>();
  for (const answer of answers) {
    map.set(answer.formFieldId, answer);
  }
  
  return map;
}

/**
 * Get all answers for a device (from any session)
 */
export async function getAnswersForDevice(
  deviceId: string
): Promise<Map<string, AuditAnswer> | null> {
  const db = await getDatabase();
  
  // Find the most recent session for this device
  const session = await db.getFirstAsync<{ local_id: string }>(
    `SELECT local_id FROM audit_sessions 
     WHERE device_id = ? OR device_local_id = ?
     ORDER BY started_at DESC
     LIMIT 1`,
    [deviceId, deviceId]
  );
  
  if (!session) return null;
  
  return getAnswersMap(session.local_id);
}

export async function updateAnswerSyncStatus(
  localId: string,
  status: SyncStatus,
  serverId?: string
): Promise<void> {
  const db = await getDatabase();
  
  if (serverId) {
    await db.runAsync(
      'UPDATE audit_answers SET sync_status = ?, server_id = ? WHERE local_id = ?',
      [status, serverId, localId]
    );
  } else {
    await db.runAsync(
      'UPDATE audit_answers SET sync_status = ? WHERE local_id = ?',
      [status, localId]
    );
  }
}

export async function getPendingAnswersForSession(
  sessionLocalId: string
): Promise<AuditAnswer[]> {
  const db = await getDatabase();
  
  const rows = await db.getAllAsync<AuditAnswerRow>(
    `SELECT * FROM audit_answers 
     WHERE audit_session_local_id = ? 
     AND sync_status IN ('local_only', 'pending_upload', 'upload_error')
     ORDER BY answered_at`,
    [sessionLocalId]
  );

  return rows.map(mapRowToAuditAnswer);
}

// -----------------------------------------------------------------------------
// Delete local audit session (only if not synced)
// -----------------------------------------------------------------------------

export async function deleteLocalAuditSession(localId: string): Promise<boolean> {
  const db = await getDatabase();
  
  // First check if the session is synced - don't allow deletion of synced sessions
  const session = await db.getFirstAsync<{ sync_status: string }>(
    'SELECT sync_status FROM audit_sessions WHERE local_id = ?',
    [localId]
  );
  
  if (!session) {
    console.log(`[DB] Session ${localId} not found`);
    return false;
  }
  
  if (session.sync_status === 'synced') {
    console.log(`[DB] Cannot delete synced session ${localId}`);
    return false;
  }
  
  // Delete answers first (foreign key constraint)
  await db.runAsync(
    'DELETE FROM audit_answers WHERE audit_session_local_id = ?',
    [localId]
  );
  
  // Delete the session
  const result = await db.runAsync(
    'DELETE FROM audit_sessions WHERE local_id = ?',
    [localId]
  );
  
  console.log(`[DB] Deleted local audit session ${localId} with ${result.changes} rows affected`);
  return result.changes > 0;
}

// -----------------------------------------------------------------------------
// Statistics
// -----------------------------------------------------------------------------

export async function getAuditStats(projectId: string): Promise<{
  totalSessions: number;
  completedSessions: number;
  pendingUpload: number;
  totalAnswers: number;
}> {
  const db = await getDatabase();
  
  const totalSessions = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM audit_sessions WHERE project_id = ?',
    [projectId]
  );
  
  const completedSessions = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM audit_sessions 
     WHERE project_id = ? AND status = 'completed'`,
    [projectId]
  );
  
  const pendingUpload = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM audit_sessions 
     WHERE project_id = ? AND sync_status != 'synced'`,
    [projectId]
  );
  
  const totalAnswers = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM audit_answers 
     WHERE audit_session_id IN (SELECT id FROM audit_sessions WHERE project_id = ?)`,
    [projectId]
  );

  return {
    totalSessions: totalSessions?.count ?? 0,
    completedSessions: completedSessions?.count ?? 0,
    pendingUpload: pendingUpload?.count ?? 0,
    totalAnswers: totalAnswers?.count ?? 0,
  };
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

interface AuditSessionRow {
  id: string;
  local_id: string;
  server_id: string | null;
  project_id: string;
  device_id: string;
  device_local_id: string;
  auditor_id: string;
  status: string;
  started_at: number;
  completed_at: number | null;
  created_offline: number;
  notes: string | null;
  sync_status: string;
}

interface AuditAnswerRow {
  id: string;
  local_id: string;
  server_id: string | null;
  audit_session_id: string;
  audit_session_local_id: string;
  device_id: string;
  form_field_id: string;
  logical_data_column_number: number | null;
  value_text: string | null;
  value_json: string | null;
  comment: string | null;
  auditor_id: string;
  answered_at: number;
  sync_status: string;
}

function mapRowToAuditSession(row: AuditSessionRow): AuditSession {
  return {
    id: row.id,
    localId: row.local_id,
    serverId: row.server_id ?? undefined,
    projectId: row.project_id,
    deviceId: row.device_id,
    deviceLocalId: row.device_local_id,
    auditorId: row.auditor_id,
    status: row.status as AuditStatus,
    startedAt: row.started_at,
    completedAt: row.completed_at ?? undefined,
    createdOffline: row.created_offline === 1,
    notes: row.notes ?? undefined,
    syncStatus: row.sync_status as SyncStatus,
  };
}

function mapRowToAuditAnswer(row: AuditAnswerRow): AuditAnswer {
  return {
    id: row.id,
    localId: row.local_id,
    serverId: row.server_id ?? undefined,
    auditSessionId: row.audit_session_id,
    auditSessionLocalId: row.audit_session_local_id,
    deviceId: row.device_id,
    formFieldId: row.form_field_id,
    logicalDataColumnNumber: row.logical_data_column_number ?? undefined,
    valueText: row.value_text ?? undefined,
    valueJson: row.value_json ?? undefined,
    comment: row.comment ?? undefined,
    auditorId: row.auditor_id,
    answeredAt: row.answered_at,
    syncStatus: row.sync_status as SyncStatus,
  };
}
