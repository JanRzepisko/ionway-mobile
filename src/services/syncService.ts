// =============================================================================
// Sync Service - Download & Upload Data
// =============================================================================

import * as Crypto from 'expo-crypto';
import * as Network from 'expo-network';
import { 
  downloadProjectData, 
  uploadProjectData, 
  getErrorMessage,
  getCurrentApiUrl 
} from './api';
import { saveProject, updateProjectSyncState } from '../database/projects';
import { 
  saveDevices, 
  deleteDevicesByProject, 
  getPendingDevices,
  updateDeviceSyncStatus,
  getDeviceCount,
  getDevice
} from '../database/devices';
import { syncAuditSessionsFromServer } from '../database/audits';
import { 
  saveFormTabs, 
  saveFormFields, 
  saveOptionSets, 
  saveOptionValues,
  clearFormConfigByProject 
} from '../database/formConfig';
import { 
  getPendingAuditSessions, 
  getAnswersBySession,
  updateAuditSessionSyncStatus,
  updateAnswerSyncStatus 
} from '../database/audits';
import { uploadPendingPhotos } from './photoService';
import { 
  Device, 
  FormTab, 
  FormField, 
  OptionSet, 
  OptionValue,
  MobileUploadRequest,
  MobileNewDevice,
  MobileAuditSession,
  MobileAuditAnswer,
  SyncStatus,
  TabType,
  FieldType,
  AuditStatus
} from '../types';

// Map mobile status string to server enum name (C# enum: Draft, InProgress, Completed, Cancelled)
function mapAuditStatusToServer(status: AuditStatus): string {
  switch (status) {
    case 'draft': return 'Draft';
    case 'in_progress': return 'InProgress';
    case 'completed': return 'Completed';
    case 'cancelled': return 'Cancelled';
    default: return 'InProgress';
  }
}

// Mobile device ID (unique per installation)
let mobileDeviceId: string | null = null;

export async function getMobileDeviceId(): Promise<string> {
  if (mobileDeviceId) return mobileDeviceId;
  
  // Generate UUID using expo-crypto
  mobileDeviceId = Crypto.randomUUID();
  return mobileDeviceId;
}

// Map numeric field type from backend to string field type for frontend
function mapFieldType(fieldType: string | number): FieldType {
  // If it's already a string, convert to lowercase
  if (typeof fieldType === 'string') {
    const lower = fieldType.toLowerCase();
    // Handle both "text" and "Text" formats
    switch (lower) {
      case 'text': return 'text';
      case 'textarea': return 'textArea';
      case 'number': return 'number';
      case 'select': return 'select';
      case 'radio': return 'radio';
      case 'checkbox': return 'checkbox';
      case 'slider': return 'slider';
      case 'extendedlist': return 'extendedList';
      case 'readonlyinfo': return 'readonlyInfo';
      case 'date': return 'date';
      case 'photo': return 'photo';
      case 'signature': return 'signature';
      default: return 'text';
    }
  }
  
  // Numeric field type mapping (from backend enum)
  const numericType = Number(fieldType);
  switch (numericType) {
    case 1: return 'text';
    case 2: return 'select';
    case 3: return 'radio';
    case 4: return 'checkbox';
    case 5: return 'slider';
    case 6: return 'extendedList';
    case 7: return 'readonlyInfo';
    case 8: return 'number';
    case 9: return 'date';
    case 10: return 'photo';
    case 11: return 'signature';
    case 12: return 'textArea';
    default: return 'text';
  }
}

// -----------------------------------------------------------------------------
// Network Check
// -----------------------------------------------------------------------------

export async function isOnline(): Promise<boolean> {
  try {
    const networkState = await Network.getNetworkStateAsync();
    return networkState.isConnected === true && networkState.isInternetReachable === true;
  } catch {
    return false;
  }
}

// -----------------------------------------------------------------------------
// Download Sync
// -----------------------------------------------------------------------------

export interface DownloadResult {
  success: boolean;
  message: string;
  stats?: {
    devices: number;
    tabs: number;
    fields: number;
    optionSets: number;
    auditsDeleted?: number;
    auditsUpdated?: number;
    auditsCreated?: number;
    auditsMarkedForResend?: number;
  };
}

export async function downloadProject(
  projectId: string,
  lastSyncAt?: number,
  lastKnownImportVersion?: number,
  onProgress?: (message: string) => void
): Promise<DownloadResult> {
  try {
    console.log('[SYNC] Starting download for project:', projectId);
    
    const online = await isOnline();
    console.log('[SYNC] Online status:', online);
    
    if (!online) {
      return { 
        success: false, 
        message: 'Brak połączenia z internetem' 
      };
    }

    onProgress?.('Łączenie z serwerem...');
    
    const deviceId = await getMobileDeviceId();
    console.log('[SYNC] Device ID:', deviceId);
    console.log('[SYNC] Calling API...');
    
    const response = await downloadProjectData(
      projectId, 
      deviceId, 
      lastSyncAt, 
      lastKnownImportVersion
    );
    
    console.log('[SYNC] API response received:', response?.projectName);

    onProgress?.('Czyszczenie starych danych...');
    
    // Clear existing data if full sync
    if (response.fullSync) {
      await clearFormConfigByProject(projectId);
      await deleteDevicesByProject(projectId);
    }

    onProgress?.('Zapisywanie projektu...');
    
    // Save project
    await saveProject({
      id: projectId,
      name: response.projectName,
      status: 'active',
      importVersion: response.importVersion,
      lastSyncAt: Date.now(),
      deviceCount: response.stats.totalDevices,
    });

    onProgress?.('Zapisywanie konfiguracji formularzy...');

    // Save form config
    const { tabs, optionSets } = response.formConfig;
    
    // Map and save tabs with fields
    const formTabs: FormTab[] = [];
    const formFields: FormField[] = [];
    
    for (const apiTab of tabs) {
      formTabs.push({
        id: apiTab.id,
        projectId,
        tabNumber: apiTab.tabNumber,
        tabType: apiTab.tabType as TabType,
        title: apiTab.title,
        displayOrder: apiTab.displayOrder,
        isActive: apiTab.isActive,
      });
      
      for (const apiField of apiTab.fields) {
        formFields.push({
          id: apiField.id,
          projectId,
          formTabId: apiField.formTabId,
          sourceRowNumber: apiField.sourceRowNumber,
          logicalDataColumnNumber: apiField.logicalDataColumnNumber,
          tabNumber: apiField.tabNumber,
          tabType: apiField.tabType as TabType,
          displayOrder: apiField.displayOrder,
          fieldType: mapFieldType(apiField.fieldType),
          label: apiField.label,
          description: apiField.description,
          question: apiField.question,
          optionSetId: apiField.optionSetId,
          targetDataColumnName: apiField.targetDataColumnName,
          isRequired: apiField.isRequired,
          isVisible: apiField.isVisible,
          isActive: apiField.isActive,
          defaultValue: apiField.defaultValue,
          validationRulesJson: apiField.validationRulesJson,
        });
      }
    }
    
    await saveFormTabs(formTabs);
    await saveFormFields(formFields);

    onProgress?.('Zapisywanie zestawów opcji...');

    // Save option sets and values
    const optionSetEntities: OptionSet[] = [];
    const optionValueEntities: OptionValue[] = [];
    
    for (const apiOptionSet of optionSets) {
      optionSetEntities.push({
        id: apiOptionSet.id,
        projectId,
        code: apiOptionSet.code,
        name: apiOptionSet.name,
        source: apiOptionSet.source,
      });
      
      for (const apiValue of apiOptionSet.values) {
        optionValueEntities.push({
          id: apiValue.id,
          optionSetId: apiOptionSet.id,
          value: apiValue.value,
          label: apiValue.label,
          displayOrder: apiValue.displayOrder,
          isActive: true,
        });
      }
    }
    
    await saveOptionSets(optionSetEntities);
    await saveOptionValues(optionValueEntities);

    onProgress?.('Zapisywanie urządzeń...');

    // Save devices
    const devices: Device[] = response.devices.map(apiDevice => ({
      id: apiDevice.id,
      localId: apiDevice.id,
      serverId: apiDevice.id,
      projectId,
      elementId: apiDevice.elementId,
      name: apiDevice.name,
      znacznik: apiDevice.znacznik,
      building: apiDevice.building,
      level: apiDevice.level,
      zone: apiDevice.zone,
      system: apiDevice.system,
      group: apiDevice.group,
      type: apiDevice.type,
      drawingNumber: apiDevice.drawingNumber,
      routeNumber: apiDevice.routeNumber,
      disciplineCode: apiDevice.disciplineCode,
      isNew: apiDevice.isNew,
      createdLocally: false,
      createdAt: Date.now(),
      auditCount: apiDevice.auditCount,
      lastAuditAt: apiDevice.lastAuditAt ? new Date(apiDevice.lastAuditAt).getTime() : undefined,
      additionalDataJson: apiDevice.additionalDataJson,
      syncStatus: 'synced' as SyncStatus,
    }));
    
    await saveDevices(devices);

    // Sync audit sessions from server (two-way sync)
    let auditSyncStats = { updated: 0, deleted: 0, created: 0, markedForResend: 0 };
    if (response.auditSessions || response.deletedAuditSessionIds) {
      onProgress?.('Synchronizacja audytów...');
      console.log('[SYNC] Syncing audit sessions from server:', {
        sessions: response.auditSessions?.length ?? 0,
        deleted: response.deletedAuditSessionIds?.length ?? 0,
      });
      
      auditSyncStats = await syncAuditSessionsFromServer(
        projectId,
        response.auditSessions ?? [],
        response.deletedAuditSessionIds ?? []
      );
      
      console.log('[SYNC] Audit sync complete:', auditSyncStats);
    }

    onProgress?.('Synchronizacja zakończona');

    // Update project sync state
    await updateProjectSyncState(projectId, response.importVersion, devices.length);

    console.log('[SYNC] Download completed successfully');
    
    // Build summary message
    let message = 'Dane pobrane pomyślnie';
    if (auditSyncStats.deleted > 0) {
      message += `. Usunięto ${auditSyncStats.deleted} audytów.`;
    }
    if (auditSyncStats.updated > 0) {
      message += `. Zaktualizowano ${auditSyncStats.updated} audytów.`;
    }
    if (auditSyncStats.markedForResend > 0) {
      message += `. ${auditSyncStats.markedForResend} audytów do ponownego wysłania.`;
    }
    
    return {
      success: true,
      message,
      stats: {
        devices: devices.length,
        tabs: formTabs.length,
        fields: formFields.length,
        optionSets: optionSetEntities.length,
        auditsDeleted: auditSyncStats.deleted,
        auditsUpdated: auditSyncStats.updated,
        auditsCreated: auditSyncStats.created,
        auditsMarkedForResend: auditSyncStats.markedForResend,
      },
    };
  } catch (error) {
    console.error('[SYNC] Download error:', error);
    return {
      success: false,
      message: getErrorMessage(error),
    };
  }
}

// -----------------------------------------------------------------------------
// Upload Sync
// -----------------------------------------------------------------------------

export interface UploadResult {
  success: boolean;
  message: string;
  stats?: {
    devicesUploaded: number;
    auditsUploaded: number;
    answersUploaded: number;
    photosUploaded?: number;
  };
}

export async function uploadProject(
  projectId: string,
  importVersion: number,
  onProgress?: (message: string) => void
): Promise<UploadResult> {
  try {
    const online = await isOnline();
    if (!online) {
      return { 
        success: false, 
        message: 'Brak połączenia z internetem' 
      };
    }

    onProgress?.('Przygotowywanie danych...');

    // Get pending devices
    const pendingDevices = await getPendingDevices(projectId);
    
    // Get pending audit sessions
    const pendingSessions = await getPendingAuditSessions(projectId);
    
    // Get pending photos
    const { getPhotosPendingUploadForProject } = await import('../database/photos');
    const pendingPhotos = await getPhotosPendingUploadForProject(projectId);

    if (pendingDevices.length === 0 && pendingSessions.length === 0 && pendingPhotos.length === 0) {
      return {
        success: true,
        message: 'Brak danych do wysłania',
        stats: { devicesUploaded: 0, auditsUploaded: 0, answersUploaded: 0, photosUploaded: 0 },
      };
    }
    
    // If only photos need to be uploaded (no new devices/sessions)
    if (pendingDevices.length === 0 && pendingSessions.length === 0 && pendingPhotos.length > 0) {
      onProgress?.('Wysyłanie zdjęć...');
      const photoResult = await uploadPendingPhotos(projectId);
      return {
        success: true,
        message: photoResult.uploaded > 0 
          ? `Wysłano ${photoResult.uploaded} zdjęć` 
          : 'Brak nowych zdjęć do wysłania',
        stats: { 
          devicesUploaded: 0, 
          auditsUploaded: 0, 
          answersUploaded: 0, 
          photosUploaded: photoResult.uploaded 
        },
      };
    }

    onProgress?.('Wysyłanie danych...');

    // Build upload request
    const deviceId = await getMobileDeviceId();
    
    // Track all devices that need to be synced (from pendingDevices + any additional from sessions)
    const devicesToSync = new Map<string, Device>();
    for (const d of pendingDevices) {
      devicesToSync.set(d.localId, d);
    }

    const auditSessions: MobileAuditSession[] = [];
    const skippedSessions: string[] = [];
    
    for (const session of pendingSessions) {
      const answers = await getAnswersBySession(session.localId);
      
      console.log(`[SYNC] Session ${session.localId} has ${answers.length} answers to sync`);
      
      const mobileAnswers: MobileAuditAnswer[] = answers.map(a => {
        console.log(`[SYNC] Answer ${a.localId}: field=${a.formFieldId}, value="${a.valueText}", status=${a.syncStatus}`);
        return {
          mobileLocalId: a.localId,
          formFieldId: a.formFieldId,
          logicalDataColumnNumber: a.logicalDataColumnNumber,
          valueText: a.valueText,
          valueJson: a.valueJson,
          comment: a.comment,
          answeredAt: new Date(a.answeredAt).toISOString(),
          updatedAt: new Date(a.answeredAt).toISOString(), // Use answeredAt as updatedAt for conflict resolution
        };
      });

      // Get device - first check devices we're already syncing, then fetch from DB
      let device = devicesToSync.get(session.deviceLocalId);
      
      // If device is not in sync list, fetch it from DB
      if (!device) {
        device = await getDevice(session.deviceLocalId) ?? undefined;
      }
      
      // Skip sessions where device is missing and can't be resolved
      if (!device) {
        console.warn(`[SYNC] Skipping session ${session.localId} - device ${session.deviceLocalId} not found in local DB`);
        skippedSessions.push(session.localId);
        await updateAuditSessionSyncStatus(session.localId, 'upload_error');
        continue;
      }
      
      // Use device's serverId if available
      const deviceServerId = device.serverId;
      const isNewDevice = !device.serverId;
      
      // If device is new (no serverId) and not already in sync list, add it
      // This handles the case where device was created locally but not in pendingDevices
      if (isNewDevice && !devicesToSync.has(device.localId)) {
        console.log(`[SYNC] Adding device ${device.localId} to sync list (needed for session ${session.localId})`);
        devicesToSync.set(device.localId, device);
        // Also update device status to pending_upload so it gets properly tracked
        await updateDeviceSyncStatus(device.localId, 'pending_upload');
      }
      
      console.log('[SYNC] Processing audit session:', {
        sessionLocalId: session.localId,
        deviceLocalId: session.deviceLocalId,
        deviceFound: true,
        deviceServerId,
        isNewDevice,
        answersCount: mobileAnswers.length,
      });
      
      auditSessions.push({
        mobileLocalId: session.localId,
        deviceId: deviceServerId,
        deviceMobileLocalId: isNewDevice ? session.deviceLocalId : undefined,
        status: mapAuditStatusToServer(session.status),
        startedAt: new Date(session.startedAt).toISOString(),
        completedAt: session.completedAt ? new Date(session.completedAt).toISOString() : undefined,
        createdOffline: session.createdOffline ?? true,
        notes: session.notes,
        lastEditedByUserId: session.lastEditedById,
        lastEditedByUserName: session.lastEditedByName,
        lastEditedAt: session.lastEditedAt ? new Date(session.lastEditedAt).toISOString() : undefined,
        answers: mobileAnswers,
      });
    }
    
    if (skippedSessions.length > 0) {
      console.warn(`[SYNC] Skipped ${skippedSessions.length} sessions due to missing device data`);
    }
    
    // Build newDevices array from all devices that need syncing (those without serverId)
    const newDevices: MobileNewDevice[] = Array.from(devicesToSync.values())
      .filter(d => !d.serverId) // Only include devices without serverId (new devices)
      .map(d => ({
        mobileLocalId: d.localId,
        elementId: d.elementId,
        name: d.name,
        znacznik: d.znacznik,
        building: d.building,
        level: d.level,
        zone: d.zone,
        system: d.system,
        group: d.group,
        type: d.type,
        drawingNumber: d.drawingNumber,
        routeNumber: d.routeNumber,
        disciplineCode: d.disciplineCode,
        createdAt: new Date(d.createdAt).toISOString(),
        additionalDataJson: d.additionalDataJson,
      }));
    
    // Check if there's anything to send after processing
    if (newDevices.length === 0 && auditSessions.length === 0) {
      const skippedMessage = skippedSessions.length > 0 
        ? `Pominięto ${skippedSessions.length} audytów z powodu brakujących urządzeń.`
        : 'Brak danych do wysłania';
      return {
        success: skippedSessions.length === 0,
        message: skippedMessage,
        stats: { devicesUploaded: 0, auditsUploaded: 0, answersUploaded: 0 },
      };
    }

    console.log('[SYNC] Upload request:', {
      projectId,
      newDevicesCount: newDevices.length,
      auditSessionsCount: auditSessions.length,
      auditSessions: auditSessions.map(a => ({
        mobileLocalId: a.mobileLocalId,
        deviceId: a.deviceId,
        deviceMobileLocalId: a.deviceMobileLocalId,
        answersCount: a.answers.length,
      })),
    });

    const request: MobileUploadRequest = {
      projectId,
      mobileDeviceId: deviceId,
      importVersion,
      uploadedAt: new Date().toISOString(),
      newDevices,
      auditSessions,
    };

    // Update status to uploading for all devices and sessions being synced
    for (const device of devicesToSync.values()) {
      if (!device.serverId) { // Only for new devices
        await updateDeviceSyncStatus(device.localId, 'uploading');
      }
    }
    for (const session of pendingSessions) {
      if (!skippedSessions.includes(session.localId)) {
        await updateAuditSessionSyncStatus(session.localId, 'uploading');
      }
    }

    // Send to server
    const apiUrl = getCurrentApiUrl();
    console.log('[SYNC] Sending upload request to:', apiUrl);
    console.log('[SYNC] Request summary:', {
      projectId,
      newDevices: newDevices.length,
      auditSessions: auditSessions.length,
      totalAnswers: auditSessions.reduce((sum, s) => sum + s.answers.length, 0),
    });
    
    const response = await uploadProjectData(projectId, request);
    
    console.log('[SYNC] Upload response from', apiUrl, ':', {
      success: response.success,
      errors: response.errors,
      deviceResults: response.deviceResults?.map(r => ({ 
        mobileLocalId: r.mobileLocalId, 
        success: r.success, 
        alreadyExists: r.alreadyExists,
        serverId: r.serverId 
      })),
      auditResults: response.auditResults?.map(r => ({ 
        mobileLocalId: r.mobileLocalId, 
        success: r.success, 
        alreadyExists: r.alreadyExists,
        warning: r.warning,
        serverId: r.serverId,
        answersSynced: r.answersSynced
      })),
      stats: response.stats,
    });

    onProgress?.('Aktualizowanie statusów...');

    if (response.success) {
      // Track warnings from duplicate rejections
      const warnings: string[] = [];
      let actuallyCreatedAudits = 0;
      let skippedAsDuplicates = 0;
      
      // Update device statuses
      for (const result of response.deviceResults) {
        if (result.success) {
          await updateDeviceSyncStatus(result.mobileLocalId, 'synced', result.serverId);
        } else {
          await updateDeviceSyncStatus(result.mobileLocalId, 'upload_error');
        }
      }

      // Update audit statuses
      for (const result of response.auditResults) {
        if (result.success) {
          await updateAuditSessionSyncStatus(result.mobileLocalId, 'synced', result.serverId);
          
          // Update answer statuses
          const answers = await getAnswersBySession(result.mobileLocalId);
          for (const answer of answers) {
            await updateAnswerSyncStatus(answer.localId, 'synced');
          }
          
          // Track if this was actually created or just marked as duplicate
          if (result.alreadyExists) {
            skippedAsDuplicates++;
            if (result.warning) {
              warnings.push(result.warning);
            }
          } else {
            actuallyCreatedAudits++;
          }
        } else {
          await updateAuditSessionSyncStatus(result.mobileLocalId, 'upload_error');
        }
      }

      // Build appropriate message
      let message = '';
      if (actuallyCreatedAudits > 0) {
        message = `Wysłano ${actuallyCreatedAudits} audytów`;
      }
      if (skippedAsDuplicates > 0) {
        if (message) message += '. ';
        message += `${skippedAsDuplicates} audytów już istnieje na serwerze`;
      }
      if (!message) {
        message = response.stats.auditsCreated > 0 
          ? 'Dane wysłane pomyślnie' 
          : 'Brak nowych danych do wysłania';
      }
      
      // Log warnings for debugging
      if (warnings.length > 0) {
        console.warn('[SYNC] Warnings from server:', warnings);
      }

      // Upload photos after audit sessions are synced
      onProgress?.('Wysyłanie zdjęć...');
      let photosUploaded = 0;
      let photosFailed = 0;
      try {
        const photoResult = await uploadPendingPhotos(projectId);
        photosUploaded = photoResult.uploaded;
        photosFailed = photoResult.failed;
        if (photoResult.uploaded > 0) {
          console.log(`[SYNC] Uploaded ${photoResult.uploaded} photos`);
        }
        if (photoResult.failed > 0) {
          console.warn(`[SYNC] Failed to upload ${photoResult.failed} photos:`, photoResult.errors);
        }
      } catch (photoError) {
        console.error('[SYNC] Error uploading photos:', photoError);
      }

      // Add photo info to message
      if (photosUploaded > 0) {
        message += `. Wysłano ${photosUploaded} zdjęć`;
      }
      if (photosFailed > 0) {
        message += `. ${photosFailed} zdjęć nie wysłano`;
      }

      return {
        success: true,
        message,
        stats: {
          devicesUploaded: response.stats.devicesCreated,
          auditsUploaded: response.stats.auditsCreated,
          answersUploaded: response.stats.answersCreated,
          photosUploaded,
        },
      };
    } else {
      // Revert to error status for all devices and sessions that were being synced
      for (const device of devicesToSync.values()) {
        if (!device.serverId) {
          await updateDeviceSyncStatus(device.localId, 'upload_error');
        }
      }
      for (const session of pendingSessions) {
        if (!skippedSessions.includes(session.localId)) {
          await updateAuditSessionSyncStatus(session.localId, 'upload_error');
        }
      }

      return {
        success: false,
        message: response.errors?.join(', ') || 'Błąd wysyłania danych',
      };
    }
  } catch (error) {
    console.error('[SYNC] Upload error:', error);
    
    // Revert statuses to pending on error - otherwise they stay as 'uploading' forever
    try {
      const pendingDevices = await getPendingDevices(projectId);
      const pendingSessions = await getPendingAuditSessions(projectId);
      
      for (const device of pendingDevices) {
        if (device.syncStatus === 'uploading') {
          await updateDeviceSyncStatus(device.localId, 'pending_upload');
        }
      }
      for (const session of pendingSessions) {
        if (session.syncStatus === 'uploading') {
          await updateAuditSessionSyncStatus(session.localId, 'pending_upload');
        }
      }
    } catch (revertError) {
      console.error('[SYNC] Error reverting statuses:', revertError);
    }
    
    return {
      success: false,
      message: getErrorMessage(error),
    };
  }
}

// -----------------------------------------------------------------------------
// Sync Status
// -----------------------------------------------------------------------------

export interface SyncStatusInfo {
  isOnline: boolean;
  pendingDevices: number;
  pendingAudits: number;
  totalDevices: number;
  lastSyncAt?: number;
  importVersion: number;
}

export async function getSyncStatus(projectId: string): Promise<SyncStatusInfo> {
  const online = await isOnline();
  const pendingDevices = await getPendingDevices(projectId);
  const pendingAudits = await getPendingAuditSessions(projectId);
  const totalDevices = await getDeviceCount(projectId);

  return {
    isOnline: online,
    pendingDevices: pendingDevices.length,
    pendingAudits: pendingAudits.length,
    totalDevices,
    importVersion: 0, // Would come from sync state
  };
}

// -----------------------------------------------------------------------------
// Comprehensive Sync - One Button to Sync Everything
// -----------------------------------------------------------------------------

export interface ComprehensiveSyncResult {
  success: boolean;
  message: string;
  stats: {
    devicesUploaded: number;
    auditsUploaded: number;
    answersUploaded: number;
    photosUploaded: number;
    auditsDownloaded: number;
    auditsDeleted: number;
  };
  errors: string[];
}

/**
 * Comprehensive sync - one button that:
 * 1. Uploads all pending local data (devices, audits, answers)
 * 2. Uploads all pending photos (after sessions are synced)
 * 3. Downloads latest data from server (two-way sync)
 */
export async function comprehensiveSync(
  projectId: string,
  importVersion: number,
  onProgress?: (message: string) => void
): Promise<ComprehensiveSyncResult> {
  const errors: string[] = [];
  const stats = {
    devicesUploaded: 0,
    auditsUploaded: 0,
    answersUploaded: 0,
    photosUploaded: 0,
    auditsDownloaded: 0,
    auditsDeleted: 0,
  };

  try {
    // Check connectivity
    const online = await isOnline();
    if (!online) {
      return {
        success: false,
        message: 'Brak połączenia z internetem',
        stats,
        errors: ['Brak połączenia z internetem'],
      };
    }

    console.log('[COMPREHENSIVE_SYNC] Starting full synchronization for project:', projectId);

    // Step 1: Upload all local changes first (devices, audits, answers)
    onProgress?.('Wysyłanie lokalnych zmian...');
    console.log('[COMPREHENSIVE_SYNC] Step 1: Uploading local data');
    
    const uploadResult = await uploadProject(projectId, importVersion, onProgress);
    if (!uploadResult.success && uploadResult.message !== 'Brak danych do wysłania') {
      errors.push(`Upload: ${uploadResult.message}`);
    }
    
    if (uploadResult.stats) {
      stats.devicesUploaded = uploadResult.stats.devicesUploaded;
      stats.auditsUploaded = uploadResult.stats.auditsUploaded;
      stats.answersUploaded = uploadResult.stats.answersUploaded;
      stats.photosUploaded = uploadResult.stats.photosUploaded || 0;
    }

    // Step 2: If photos weren't uploaded in Step 1 (upload might have skipped them), try again
    onProgress?.('Sprawdzanie zdjęć...');
    const { getPhotosPendingUploadForProject } = await import('../database/photos');
    const pendingPhotos = await getPhotosPendingUploadForProject(projectId);
    
    if (pendingPhotos.length > 0) {
      console.log(`[COMPREHENSIVE_SYNC] Step 2: ${pendingPhotos.length} photos still pending`);
      onProgress?.(`Wysyłanie ${pendingPhotos.length} zdjęć...`);
      
      try {
        const photoResult = await uploadPendingPhotos(projectId);
        stats.photosUploaded += photoResult.uploaded;
        
        if (photoResult.failed > 0) {
          errors.push(`${photoResult.failed} zdjęć nie wysłano: ${photoResult.errors.slice(0, 3).join(', ')}`);
        }
      } catch (photoError: any) {
        console.error('[COMPREHENSIVE_SYNC] Photo upload error:', photoError);
        errors.push(`Błąd wysyłania zdjęć: ${photoError.message}`);
      }
    }

    // Step 3: Download latest from server (two-way sync)
    onProgress?.('Pobieranie z serwera...');
    console.log('[COMPREHENSIVE_SYNC] Step 3: Downloading from server');
    
    const downloadResult = await downloadProject(projectId, undefined, importVersion, onProgress);
    if (!downloadResult.success) {
      errors.push(`Download: ${downloadResult.message}`);
    } else if (downloadResult.stats) {
      stats.auditsDownloaded = downloadResult.stats.auditsUpdated || 0;
      stats.auditsDeleted = downloadResult.stats.auditsDeleted || 0;
    }

    // Build summary message
    const parts: string[] = [];
    
    if (stats.devicesUploaded > 0) {
      parts.push(`${stats.devicesUploaded} urządzeń`);
    }
    if (stats.auditsUploaded > 0) {
      parts.push(`${stats.auditsUploaded} audytów`);
    }
    if (stats.photosUploaded > 0) {
      parts.push(`${stats.photosUploaded} zdjęć`);
    }
    
    let message = '';
    if (parts.length > 0) {
      message = `Wysłano: ${parts.join(', ')}`;
    }
    
    if (stats.auditsDeleted > 0) {
      message += message ? `. ` : '';
      message += `Usunięto ${stats.auditsDeleted} audytów`;
    }
    
    if (errors.length > 0) {
      message += message ? '. ' : '';
      message += `Błędy: ${errors.length}`;
    }
    
    if (!message) {
      message = 'Wszystko zsynchronizowane';
    }

    console.log('[COMPREHENSIVE_SYNC] Complete:', { stats, errors });

    return {
      success: errors.length === 0,
      message,
      stats,
      errors,
    };
  } catch (error: any) {
    console.error('[COMPREHENSIVE_SYNC] Error:', error);
    errors.push(error.message || 'Nieznany błąd');
    
    return {
      success: false,
      message: 'Błąd synchronizacji',
      stats,
      errors,
    };
  }
}

/**
 * Force full sync - uploads ALL local audits and downloads entire database from server.
 * NEVER deletes local data.
 */
export async function forceFullSync(
  projectId: string,
  importVersion: number,
  onProgress?: (message: string) => void
): Promise<ComprehensiveSyncResult> {
  const errors: string[] = [];
  const stats = {
    devicesUploaded: 0,
    auditsUploaded: 0,
    answersUploaded: 0,
    photosUploaded: 0,
    auditsDownloaded: 0,
    auditsDeleted: 0,
  };

  try {
    console.log('[FULL_SYNC] Starting full sync for project:', projectId);
    
    const online = await isOnline();
    if (!online) {
      return {
        success: false,
        message: 'Brak połączenia z internetem',
        stats,
        errors: ['Brak połączenia z internetem'],
      };
    }

    // Step 1: Mark ALL sessions as pending upload (force re-send everything)
    onProgress?.('Przygotowywanie danych do wysłania...');
    const { markAllSessionsForResync, fixStuckUploadingSessions, getAllAuditSessions } = await import('../database/audits');
    
    await fixStuckUploadingSessions(projectId);
    const markedCount = await markAllSessionsForResync(projectId);
    console.log(`[FULL_SYNC] Marked ${markedCount} sessions for upload`);
    
    // Get count of all local sessions
    const allLocalSessions = await getAllAuditSessions(projectId);
    console.log(`[FULL_SYNC] Total local sessions: ${allLocalSessions.length}`);

    // Step 2: Upload all local data
    onProgress?.(`Wysyłanie ${allLocalSessions.length} audytów...`);
    console.log('[FULL_SYNC] Step 2: Uploading all local data');
    
    const uploadResult = await uploadProject(projectId, importVersion, onProgress);
    if (!uploadResult.success && uploadResult.message !== 'Brak danych do wysłania') {
      errors.push(`Upload: ${uploadResult.message}`);
    }
    
    if (uploadResult.stats) {
      stats.devicesUploaded = uploadResult.stats.devicesUploaded;
      stats.auditsUploaded = uploadResult.stats.auditsUploaded;
      stats.answersUploaded = uploadResult.stats.answersUploaded;
    }

    // Step 3: Upload photos
    onProgress?.('Wysyłanie zdjęć...');
    const { getPhotosPendingUploadForProject } = await import('../database/photos');
    const pendingPhotos = await getPhotosPendingUploadForProject(projectId);
    
    if (pendingPhotos.length > 0) {
      console.log(`[FULL_SYNC] Uploading ${pendingPhotos.length} photos`);
      try {
        const photoResult = await uploadPendingPhotos(projectId);
        stats.photosUploaded = photoResult.uploaded;
        if (photoResult.failed > 0) {
          errors.push(`${photoResult.failed} zdjęć nie wysłano`);
        }
      } catch (e: any) {
        errors.push(`Błąd wysyłania zdjęć: ${e.message}`);
      }
    }

    // Step 4: Download ENTIRE database from server
    onProgress?.('Pobieranie całej bazy z serwera...');
    console.log('[FULL_SYNC] Step 4: Downloading entire database');
    
    const downloadResult = await downloadProject(projectId, undefined, importVersion, onProgress);
    if (!downloadResult.success) {
      errors.push(`Download: ${downloadResult.message}`);
    } else if (downloadResult.stats) {
      stats.auditsDownloaded = (downloadResult.stats.auditsUpdated || 0) + (downloadResult.stats.auditsCreated || 0);
    }

    // Build summary
    let message = '';
    const parts: string[] = [];
    
    if (stats.auditsUploaded > 0) parts.push(`wysłano ${stats.auditsUploaded} audytów`);
    if (stats.photosUploaded > 0) parts.push(`${stats.photosUploaded} zdjęć`);
    if (stats.auditsDownloaded > 0) parts.push(`pobrano ${stats.auditsDownloaded} audytów`);
    
    if (parts.length > 0) {
      message = parts.join(', ');
    } else {
      message = 'Synchronizacja zakończona';
    }

    console.log('[FULL_SYNC] Complete:', { stats, errors });

    return {
      success: errors.length === 0,
      message: errors.length > 0 ? `${message}. Błędy: ${errors.length}` : message,
      stats,
      errors,
    };
  } catch (error: any) {
    console.error('[FULL_SYNC] Error:', error);
    return {
      success: false,
      message: 'Błąd synchronizacji: ' + (error.message || 'Nieznany błąd'),
      stats,
      errors: [error.message || 'Nieznany błąd'],
    };
  }
}
