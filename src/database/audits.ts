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

export async function getCompletedSessionsForProject(projectId: string): Promise<AuditSession[]> {
  const db = await getDatabase();
  
  // Include both completed and in_progress sessions that have answers
  const rows = await db.getAllAsync<AuditSessionRow>(
    `SELECT s.* FROM audit_sessions s
     WHERE s.project_id = ? 
     AND s.status IN ('completed', 'in_progress')
     AND EXISTS (SELECT 1 FROM audit_answers a WHERE a.audit_session_local_id = s.local_id)
     ORDER BY COALESCE(s.completed_at, s.started_at) DESC`,
    [projectId]
  );

  return rows.map(mapRowToAuditSession);
}

// Get ALL in_progress and completed sessions for a project (for copy feature in batch audits)
export async function getAllSessionsForProject(projectId: string): Promise<AuditSession[]> {
  const db = await getDatabase();
  
  // Return all sessions regardless of answers - useful for batch audit copy feature
  const rows = await db.getAllAsync<AuditSessionRow>(
    `SELECT * FROM audit_sessions 
     WHERE project_id = ? 
     AND status IN ('completed', 'in_progress')
     ORDER BY started_at DESC`,
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

/**
 * Check if device has ANY audit session (regardless of status)
 */
export async function getExistingSessionForDevice(
  deviceId: string
): Promise<AuditSession | null> {
  const db = await getDatabase();
  
  console.log(`[DB getExistingSessionForDevice] Looking for device: ${deviceId}`);
  
  const row = await db.getFirstAsync<AuditSessionRow>(
    `SELECT * FROM audit_sessions 
     WHERE device_id = ? 
     ORDER BY started_at DESC LIMIT 1`,
    [deviceId]
  );
  
  console.log(`[DB getExistingSessionForDevice] Found: ${row ? `session ${row.local_id}` : 'none'}`);

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
 * Get ALL audit sessions for a project (for full sync)
 */
export async function getAllAuditSessions(projectId: string): Promise<AuditSession[]> {
  const db = await getDatabase();
  
  const rows = await db.getAllAsync<AuditSessionRow>(
    `SELECT * FROM audit_sessions 
     WHERE project_id = ?
     ORDER BY started_at DESC`,
    [projectId]
  );

  return rows.map(mapRowToAuditSession);
}

/**
 * Get all completed/synced audit sessions for browsing (wszystkie zrobione audyty)
 */
export async function getCompletedAuditSessions(projectId: string): Promise<AuditSession[]> {
  const db = await getDatabase();
  
  const rows = await db.getAllAsync<AuditSessionRow>(
    `SELECT * FROM audit_sessions 
     WHERE project_id = ? AND status = 'completed'
     ORDER BY completed_at DESC, started_at DESC`,
    [projectId]
  );

  return rows.map(mapRowToAuditSession);
}

/**
 * Get audit session with full details including device info
 */
export async function getAuditSessionWithDetails(localId: string): Promise<{
  session: AuditSession;
  answers: AuditAnswer[];
  deviceName?: string;
  deviceElementId?: string;
} | null> {
  const db = await getDatabase();
  
  const sessionRow = await db.getFirstAsync<AuditSessionRow>(
    'SELECT * FROM audit_sessions WHERE local_id = ?',
    [localId]
  );
  
  if (!sessionRow) return null;
  
  const session = mapRowToAuditSession(sessionRow);
  
  // Get answers
  const answerRows = await db.getAllAsync<AuditAnswerRow>(
    'SELECT * FROM audit_answers WHERE audit_session_local_id = ? ORDER BY answered_at',
    [localId]
  );
  const answers = answerRows.map(mapRowToAuditAnswer);
  
  // Get device info
  const device = await db.getFirstAsync<{ name: string; element_id: string }>(
    'SELECT name, element_id FROM devices WHERE id = ?',
    [session.deviceId]
  );
  
  return {
    session,
    answers,
    deviceName: device?.name,
    deviceElementId: device?.element_id,
  };
}

/**
 * Mark all synced sessions as pending upload (for force resync)
 */
export async function markAllSessionsForResync(projectId: string): Promise<number> {
  const db = await getDatabase();
  
  // Mark sessions that are currently 'synced' as 'pending_upload'
  const sessionResult = await db.runAsync(
    `UPDATE audit_sessions 
     SET sync_status = 'pending_upload'
     WHERE project_id = ? AND sync_status = 'synced'`,
    [projectId]
  );
  
  // Also mark their answers
  await db.runAsync(
    `UPDATE audit_answers 
     SET sync_status = 'pending_upload'
     WHERE audit_session_local_id IN (
       SELECT local_id FROM audit_sessions WHERE project_id = ?
     ) AND sync_status = 'synced'`,
    [projectId]
  );
  
  console.log(`[DB] Marked ${sessionResult.changes} sessions for resync`);
  return sessionResult.changes;
}

/**
 * Fix stuck audit sessions that have 'uploading' status
 * These are sessions where upload was interrupted and status wasn't reverted
 */
export async function fixStuckUploadingSessions(projectId: string): Promise<number> {
  const db = await getDatabase();
  
  // Fix both 'uploading' (stuck) and 'upload_error' (failed) sessions
  const result = await db.runAsync(
    `UPDATE audit_sessions 
     SET sync_status = 'pending_upload'
     WHERE project_id = ? AND sync_status IN ('uploading', 'upload_error')`,
    [projectId]
  );
  
  if (result.changes > 0) {
    console.log(`[DB] Fixed ${result.changes} stuck/failed sessions`);
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
  
  console.log(`[DB upsertAnswer] sessionLocalId=${auditSessionLocalId}, fieldId=${formFieldId}, value=${value}`);
  
  const existing = await db.getFirstAsync<AuditAnswerRow>(
    `SELECT * FROM audit_answers 
     WHERE audit_session_local_id = ? AND form_field_id = ?`,
    [auditSessionLocalId, formFieldId]
  );
  
  console.log(`[DB upsertAnswer] existing=${existing ? 'found' : 'not found'}`);

  const now = Date.now();

  if (existing) {
    await db.runAsync(
      `UPDATE audit_answers 
       SET value_text = ?, comment = ?, answered_at = ?, sync_status = 'pending_upload'
       WHERE local_id = ?`,
      [value, comment ?? null, now, existing.local_id]
    );
    
    // Mark the session as needing re-sync (always mark as pending when answer changes)
    const sessionResult = await db.runAsync(
      `UPDATE audit_sessions 
       SET sync_status = 'pending_upload'
       WHERE local_id = ? AND sync_status NOT IN ('local_only', 'pending_upload', 'uploading')`,
      [auditSessionLocalId]
    );
    
    console.log(`[DB upsertAnswer] Session ${auditSessionLocalId} marked for re-sync: ${sessionResult.changes > 0}`);

    return {
      ...mapRowToAuditAnswer(existing),
      valueText: value ?? undefined,
      comment,
      answeredAt: now,
      syncStatus: 'pending_upload',
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
    syncStatus: 'pending_upload',
  };

  await saveAuditAnswer(answer);
  
  // Mark the session as needing sync when new answer is added
  const sessionResult = await db.runAsync(
    `UPDATE audit_sessions 
     SET sync_status = 'pending_upload'
     WHERE local_id = ? AND sync_status NOT IN ('local_only', 'pending_upload', 'uploading')`,
    [auditSessionLocalId]
  );
  
  console.log(`[DB upsertAnswer] New answer - Session ${auditSessionLocalId} marked for sync: ${sessionResult.changes > 0}`);
  
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
// Server Sync - Update local DB from server data
// -----------------------------------------------------------------------------

/**
 * Sync audit sessions from server - updates local DB with server state
 * This handles: status updates, new sessions from server, deleted sessions
 */
/**
 * Sync audit sessions from server - NEVER deletes local data
 * Only creates new records or updates existing synced ones
 */
export async function syncAuditSessionsFromServer(
  projectId: string,
  serverSessions: Array<{
    id: string;
    mobileLocalId: string;
    deviceId: string;
    auditorId: string;
    status: string;
    startedAt: string;
    completedAt?: string;
    notes?: string;
    updatedAt?: string;
    answerCount?: number;
    answers: Array<{
      id: string;
      mobileLocalId: string;
      formFieldId: string;
      logicalDataColumnNumber?: number;
      valueText?: string;
      valueJson?: string;
      comment?: string;
      answeredAt: string;
    }>;
  }>,
  _deletedSessionIds: string[] // Ignored - we never delete locally
): Promise<{ updated: number; deleted: number; created: number; markedForResend: number }> {
  const db = await getDatabase();
  let updated = 0;
  let created = 0;

  // Map server status to local status
  const mapServerStatus = (status: string): AuditStatus => {
    switch (status) {
      case 'Draft': return 'draft';
      case 'InProgress': return 'in_progress';
      case 'Completed': return 'completed';
      case 'Cancelled': return 'cancelled';
      default: return 'in_progress';
    }
  };

  // Process ALL server sessions - create or update locally
  for (const serverSession of serverSessions) {
    const localSession = await db.getFirstAsync<{ 
      local_id: string; 
      status: string; 
      sync_status: string;
      completed_at: number | null;
    }>(
      'SELECT local_id, status, sync_status, completed_at FROM audit_sessions WHERE local_id = ?',
      [serverSession.mobileLocalId]
    );

    if (localSession) {
      // Session exists locally
      const serverStatus = mapServerStatus(serverSession.status);
      const serverCompletedAt = serverSession.completedAt ? new Date(serverSession.completedAt).getTime() : null;
      
      // Only update if local is already synced (don't overwrite pending changes)
      if (localSession.sync_status === 'synced') {
        const needsUpdate = localSession.status !== serverStatus || 
                          localSession.completed_at !== serverCompletedAt;
        
        if (needsUpdate) {
          await db.runAsync(
            `UPDATE audit_sessions 
             SET status = ?, completed_at = ?, notes = ?, server_id = ?
             WHERE local_id = ?`,
            [
              serverStatus,
              serverCompletedAt,
              serverSession.notes ?? null,
              serverSession.id,
              serverSession.mobileLocalId
            ]
          );
          updated++;
          console.log(`[DB Sync] Updated session ${serverSession.mobileLocalId}: status=${serverStatus}`);
        }
        
        // Also sync answers for this session
        for (const serverAnswer of serverSession.answers) {
          const existingAnswer = await db.getFirstAsync<{ local_id: string; sync_status: string }>(
            'SELECT local_id, sync_status FROM audit_answers WHERE local_id = ?',
            [serverAnswer.mobileLocalId]
          );
          
          if (!existingAnswer) {
            // Create answer from server
            const answeredAt = new Date(serverAnswer.answeredAt).getTime();
            await db.runAsync(
              `INSERT INTO audit_answers 
               (id, local_id, server_id, audit_session_id, audit_session_local_id, device_id,
                form_field_id, logical_data_column_number, value_text, value_json, comment,
                auditor_id, answered_at, sync_status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')`,
              [
                serverAnswer.id,
                serverAnswer.mobileLocalId,
                serverAnswer.id,
                serverSession.id,
                serverSession.mobileLocalId,
                serverSession.deviceId,
                serverAnswer.formFieldId,
                serverAnswer.logicalDataColumnNumber ?? null,
                serverAnswer.valueText ?? null,
                serverAnswer.valueJson ?? null,
                serverAnswer.comment ?? null,
                serverSession.auditorId,
                answeredAt
              ]
            );
          } else if (existingAnswer.sync_status === 'synced') {
            // Update existing synced answer
            const answeredAt = new Date(serverAnswer.answeredAt).getTime();
            await db.runAsync(
              `UPDATE audit_answers 
               SET value_text = ?, value_json = ?, comment = ?, answered_at = ?, server_id = ?
               WHERE local_id = ?`,
              [
                serverAnswer.valueText ?? null,
                serverAnswer.valueJson ?? null,
                serverAnswer.comment ?? null,
                answeredAt,
                serverAnswer.id,
                serverAnswer.mobileLocalId
              ]
            );
          }
        }
      }
    } else {
      // Session doesn't exist locally - create from server
      const serverStatus = mapServerStatus(serverSession.status);
      const serverStartedAt = new Date(serverSession.startedAt).getTime();
      const serverCompletedAt = serverSession.completedAt ? new Date(serverSession.completedAt).getTime() : null;
      const now = Date.now();
      
      await db.runAsync(
        `INSERT INTO audit_sessions 
         (id, local_id, server_id, project_id, device_id, auditor_id, 
          status, started_at, completed_at, created_at, notes, sync_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')`,
        [
          serverSession.id,
          serverSession.mobileLocalId,
          serverSession.id,
          projectId,
          serverSession.deviceId,
          serverSession.auditorId,
          serverStatus,
          serverStartedAt,
          serverCompletedAt,
          now,
          serverSession.notes ?? null
        ]
      );
      
      // Create answers
      for (const serverAnswer of serverSession.answers) {
        const answeredAt = new Date(serverAnswer.answeredAt).getTime();
        await db.runAsync(
          `INSERT OR REPLACE INTO audit_answers 
           (id, local_id, server_id, audit_session_id, audit_session_local_id, device_id,
            form_field_id, logical_data_column_number, value_text, value_json, comment,
            auditor_id, answered_at, sync_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')`,
          [
            serverAnswer.id,
            serverAnswer.mobileLocalId,
            serverAnswer.id,
            serverSession.id,
            serverSession.mobileLocalId,
            serverSession.deviceId,
            serverAnswer.formFieldId,
            serverAnswer.logicalDataColumnNumber ?? null,
            serverAnswer.valueText ?? null,
            serverAnswer.valueJson ?? null,
            serverAnswer.comment ?? null,
            serverSession.auditorId,
            answeredAt
          ]
        );
      }
      
      created++;
      console.log(`[DB Sync] Created session ${serverSession.mobileLocalId} from server with ${serverSession.answers.length} answers`);
    }
  }

  console.log(`[DB Sync] Sync complete: ${created} created, ${updated} updated (NO deletions)`);
  return { updated, deleted: 0, created, markedForResend: 0 };
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
