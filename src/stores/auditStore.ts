// =============================================================================
// Audit Store - Current Audit Session State
// =============================================================================

import { create } from 'zustand';
import { 
  AuditSession, 
  AuditAnswer, 
  FormField, 
  FormTab, 
  OptionValue,
  Device 
} from '../types';
import { 
  createAuditSession, 
  getAuditSession,
  getInProgressSession,
  getExistingSessionForDevice,
  completeAuditSession,
  getAnswersMap,
  upsertAnswer,
  getAuditSessionsByProject
} from '../database/audits';
import { 
  getFullFormConfig, 
  FormConfig,
  getOptionValues 
} from '../database/formConfig';
import { getDevice } from '../database/devices';
import { uploadProject, isOnline } from '../services/syncService';

// =============================================================================
// Debounce utility for DB writes - prevents UI blocking
// =============================================================================
const DEBOUNCE_DELAY = 500; // ms
const pendingWrites = new Map<string, NodeJS.Timeout>();

function debouncedDbWrite(
  key: string,
  writeFunction: () => Promise<void>
): void {
  // Clear any existing timeout for this key
  const existingTimeout = pendingWrites.get(key);
  if (existingTimeout) {
    clearTimeout(existingTimeout);
  }
  
  // Set new timeout
  const timeout = setTimeout(async () => {
    pendingWrites.delete(key);
    try {
      await writeFunction();
    } catch (error) {
      console.error('Debounced DB write error:', error);
    }
  }, DEBOUNCE_DELAY);
  
  pendingWrites.set(key, timeout);
}

// Flush all pending writes immediately (call before upload/complete)
export async function flushPendingWrites(): Promise<void> {
  const promises: Promise<void>[] = [];
  
  for (const [key, timeout] of pendingWrites.entries()) {
    clearTimeout(timeout);
    pendingWrites.delete(key);
  }
  
  // Small delay to ensure all writes complete
  await new Promise(resolve => setTimeout(resolve, 100));
}

interface AuditState {
  // Current audit
  currentSession: AuditSession | null;
  currentDevice: Device | null;
  
  // All local sessions
  localSessions: AuditSession[];
  
  // Form config
  formConfig: FormConfig | null;
  currentTabIndex: number;
  
  // Answers
  answers: Map<string, AuditAnswer>;
  
  // UI State
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  
  // Internal flag - sync session to server on first answer
  _sessionNeedsSyncOnFirstAnswer: boolean;
  
  // Actions
  loadLocalSessions: (projectId: string) => Promise<void>;
  startAudit: (deviceId: string, projectId: string, userId: string) => Promise<boolean>;
  startBatchAudit: (deviceIds: string[], projectId: string, userId: string) => Promise<boolean>;
  resumeAudit: (sessionId: string) => Promise<boolean>;
  loadFormConfig: (projectId: string) => Promise<void>;
  
  // Tab navigation
  setCurrentTab: (index: number) => void;
  nextTab: () => void;
  previousTab: () => void;
  
  // Answer management
  saveAnswer: (
    formFieldId: string, 
    value: string | null, 
    logicalDataColumnNumber?: number,
    comment?: string
  ) => Promise<void>;
  getAnswer: (formFieldId: string) => AuditAnswer | undefined;
  getFieldOptions: (optionSetId: string) => Promise<OptionValue[]>;
  
  // Complete audit
  completeAudit: (notes?: string) => Promise<boolean>;
  
  // Complete multiple devices with same answers (batch mode)
  completeAuditForMultipleDevices: (
    deviceIds: string[],
    projectId: string,
    userId: string,
    answers: Map<string, AuditAnswer>
  ) => Promise<boolean>;
  
  // Complete multiple devices with per-device answers (batch mode with varied answers)
  completeAuditForMultipleDevicesWithVariedAnswers: (
    deviceIds: string[],
    projectId: string,
    userId: string,
    defaultAnswers: Map<string, AuditAnswer>,
    perDeviceAnswers: Map<string, Map<string, string | null>>
  ) => Promise<boolean>;
  
  // Clear
  clearAudit: () => void;
  clearError: () => void;
}

export const useAuditStore = create<AuditState>((set, get) => ({
  currentSession: null,
  currentDevice: null,
  localSessions: [],
  formConfig: null,
  currentTabIndex: 0,
  answers: new Map(),
  isLoading: false,
  isSaving: false,
  error: null,
  _sessionNeedsSyncOnFirstAnswer: false,

  loadLocalSessions: async (projectId: string) => {
    try {
      const sessions = await getAuditSessionsByProject(projectId);
      set({ localSessions: sessions });
    } catch (error) {
      console.error('Error loading local sessions:', error);
    }
  },

  startAudit: async (deviceId: string, projectId: string, userId: string) => {
    set({ isLoading: true, error: null });
    
    try {
      // Check for ANY existing session (not just in_progress)
      let session = await getExistingSessionForDevice(deviceId);
      let isNewSession = false;
      
      if (!session) {
        // Get device to get localId
        const device = await getDevice(deviceId);
        if (!device) {
          throw new Error('Urządzenie nie znalezione');
        }
        
        // Create new session
        session = await createAuditSession(
          projectId,
          device.id,
          device.localId,
          userId
        );
        isNewSession = true;
        
        set({ currentDevice: device });
      } else {
        // Load device for existing session
        const device = await getDevice(session.deviceId);
        console.log(`[AuditStore] Using existing session (${session.status}) for device`);
        set({ currentDevice: device });
      }
      
      // Load answers for this session
      const answersMap = await getAnswersMap(session.localId);
      
      // Load form config
      const formConfig = await getFullFormConfig(projectId);
      
      set({ 
        currentSession: session,
        formConfig,
        answers: answersMap,
        currentTabIndex: 0,
        isLoading: false,
        // Track if this is a fresh session without answers
        _sessionNeedsSyncOnFirstAnswer: isNewSession && answersMap.size === 0
      });
      
      // Don't sync to server until at least one answer is saved
      // This happens in saveAnswer when first answer is provided
      
      return true;
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Błąd rozpoczęcia audytu',
        isLoading: false 
      });
      return false;
    }
  },

  // Start batch audit - creates sessions for ALL devices immediately
  startBatchAudit: async (deviceIds: string[], projectId: string, userId: string) => {
    if (deviceIds.length === 0) {
      set({ error: 'Brak urządzeń do audytu' });
      return false;
    }

    set({ isLoading: true, error: null });
    
    try {
      const firstDeviceId = deviceIds[0];
      let firstSession: AuditSession | null = null;
      let firstDevice: Device | null = null;
      
      // Create or get sessions for ALL devices
      for (let i = 0; i < deviceIds.length; i++) {
        const deviceId = deviceIds[i];
        
        // Check for ANY existing session (not just in_progress)
        let session = await getExistingSessionForDevice(deviceId);
        
        if (!session) {
          // Get device
          const device = await getDevice(deviceId);
          if (!device) {
            console.warn(`[AuditStore] Device not found: ${deviceId}`);
            continue;
          }
          
          // Create new session
          session = await createAuditSession(
            projectId,
            device.id,
            device.localId,
            userId
          );
          console.log(`[AuditStore] Created session for device ${i + 1}/${deviceIds.length}: ${device.name}`);
          
          // Store first device reference
          if (i === 0) {
            firstDevice = device;
          }
        } else {
          console.log(`[AuditStore] Using existing session (${session.status}) for device ${i + 1}/${deviceIds.length}`);
          if (i === 0) {
            firstDevice = await getDevice(session.deviceId);
          }
        }
        
        // Keep reference to first session
        if (i === 0) {
          firstSession = session;
        }
      }
      
      if (!firstSession || !firstDevice) {
        throw new Error('Nie udało się utworzyć sesji audytu');
      }
      
      // Load answers for first session
      const answersMap = await getAnswersMap(firstSession.localId);
      
      // Load form config
      const formConfig = await getFullFormConfig(projectId);
      
      set({ 
        currentSession: firstSession,
        currentDevice: firstDevice,
        formConfig,
        answers: answersMap,
        currentTabIndex: 0,
        isLoading: false,
        _sessionNeedsSyncOnFirstAnswer: answersMap.size === 0
      });
      
      return true;
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Błąd rozpoczęcia audytu zbiorowego',
        isLoading: false 
      });
      return false;
    }
  },

  resumeAudit: async (sessionId: string) => {
    set({ isLoading: true, error: null });
    
    try {
      const session = await getAuditSession(sessionId);
      if (!session) {
        throw new Error('Sesja audytu nie znaleziona');
      }
      
      // Try to get device by deviceId first, then by deviceLocalId
      let device = await getDevice(session.deviceId);
      if (!device && session.deviceLocalId) {
        device = await getDevice(session.deviceLocalId);
      }
      
      if (!device) {
        // Device not found - show clear error with sync status info
        const syncInfo = session.syncStatus === 'synced' 
          ? '' 
          : ` (status synchronizacji: ${session.syncStatus})`;
        throw new Error(`Urządzenie powiązane z tym audytem nie zostało znalezione${syncInfo}. Spróbuj zsynchronizować dane.`);
      }
      
      const formConfig = await getFullFormConfig(session.projectId);
      const answersMap = await getAnswersMap(session.localId);
      
      set({ 
        currentSession: session,
        currentDevice: device,
        formConfig,
        answers: answersMap,
        currentTabIndex: 0,
        isLoading: false 
      });
      
      return true;
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Błąd wznowienia audytu',
        isLoading: false 
      });
      return false;
    }
  },

  loadFormConfig: async (projectId: string) => {
    try {
      const formConfig = await getFullFormConfig(projectId);
      set({ formConfig });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Błąd ładowania formularza' });
    }
  },

  setCurrentTab: (index: number) => {
    const { formConfig } = get();
    if (formConfig && index >= 0 && index < formConfig.tabs.length) {
      set({ currentTabIndex: index });
    }
  },

  nextTab: () => {
    const { formConfig, currentTabIndex } = get();
    if (formConfig && currentTabIndex < formConfig.tabs.length - 1) {
      set({ currentTabIndex: currentTabIndex + 1 });
    }
  },

  previousTab: () => {
    const { currentTabIndex } = get();
    if (currentTabIndex > 0) {
      set({ currentTabIndex: currentTabIndex - 1 });
    }
  },

  saveAnswer: async (
    formFieldId: string, 
    value: string | null,
    logicalDataColumnNumber?: number,
    comment?: string
  ) => {
    const { currentSession, currentDevice, answers, _sessionNeedsSyncOnFirstAnswer } = get();
    
    if (!currentSession || !currentDevice) {
      return;
    }
    
    // Check if this is the first answer (session needs to be synced as "in_progress")
    const isFirstAnswer = _sessionNeedsSyncOnFirstAnswer && answers.size === 0;
    
    // Update local state IMMEDIATELY for responsive UI
    const tempAnswer: AuditAnswer = {
      id: `temp-${formFieldId}`,
      localId: `temp-${formFieldId}`,
      auditSessionId: currentSession.id,
      auditSessionLocalId: currentSession.localId,
      deviceId: currentDevice.id,
      formFieldId,
      auditorId: currentSession.auditorId,
      logicalDataColumnNumber,
      valueText: value ?? undefined,
      answeredAt: Date.now(),
      syncStatus: 'local_only',
    };
    
    const newAnswers = new Map(answers);
    newAnswers.set(formFieldId, tempAnswer);
    set({ 
      answers: newAnswers,
      // Clear the flag after first answer
      _sessionNeedsSyncOnFirstAnswer: false
    });
    
    // Debounce the actual DB write to prevent UI blocking
    const writeKey = `answer-${currentSession.localId}-${formFieldId}`;
    
    debouncedDbWrite(writeKey, async () => {
      set({ isSaving: true });
      try {
        const answer = await upsertAnswer(
          currentSession.id,
          currentSession.localId,
          currentDevice.id,
          formFieldId,
          currentSession.auditorId,
          value,
          logicalDataColumnNumber,
          comment
        );
        
        // Update with actual DB result
        const currentAnswers = get().answers;
        const updatedAnswers = new Map(currentAnswers);
        updatedAnswers.set(formFieldId, answer);
        set({ answers: updatedAnswers, isSaving: false });
        
        // If this was the first answer, sync session to server as "in_progress"
        if (isFirstAnswer) {
          const online = await isOnline();
          if (online) {
            console.log('[AuditStore] First answer saved - syncing in_progress session to server...');
            uploadProject(currentSession.projectId, 0).then(result => {
              if (result.success) {
                console.log('[AuditStore] In-progress session synced successfully');
              } else {
                console.log('[AuditStore] Failed to sync in-progress session:', result.message);
              }
            }).catch(err => {
              console.log('[AuditStore] Error syncing in-progress session:', err);
            });
          }
        }
      } catch (error) {
        console.error('DB write error:', error);
        set({ isSaving: false });
      }
    });
  },

  getAnswer: (formFieldId: string) => {
    const { answers } = get();
    return answers.get(formFieldId);
  },

  getFieldOptions: async (optionSetId: string) => {
    return await getOptionValues(optionSetId);
  },

  completeAudit: async (notes?: string) => {
    const { currentSession } = get();
    
    if (!currentSession) {
      set({ error: 'Brak aktywnej sesji audytu' });
      return false;
    }
    
    set({ isLoading: true });
    
    try {
      // Flush any pending debounced writes before completing
      await flushPendingWrites();
      
      await completeAuditSession(currentSession.localId, notes);
      
      const completedSession = { 
        ...currentSession, 
        status: 'completed' as const,
        completedAt: Date.now(),
        notes,
        syncStatus: 'pending_upload' as const
      };
      
      set({ 
        currentSession: completedSession,
        isLoading: false 
      });
      
      // If online, sync completed session to server immediately
      const online = await isOnline();
      if (online) {
        console.log('[AuditStore] Syncing completed session to server...');
        // Run in background, don't block UI
        uploadProject(currentSession.projectId, 0).then(result => {
          if (result.success) {
            console.log('[AuditStore] Completed session synced successfully');
          } else {
            console.log('[AuditStore] Failed to sync completed session:', result.message);
          }
        }).catch(err => {
          console.log('[AuditStore] Error syncing completed session:', err);
        });
      }
      
      return true;
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Błąd zakończenia audytu',
        isLoading: false 
      });
      return false;
    }
  },

  // Complete multiple devices with same answers (batch audit mode)
  completeAuditForMultipleDevices: async (
    deviceIds: string[],
    projectId: string,
    userId: string,
    answers: Map<string, AuditAnswer>
  ) => {
    if (deviceIds.length === 0) {
      set({ error: 'Brak urządzeń do audytu' });
      return false;
    }

    set({ isLoading: true });

    try {
      // Flush any pending debounced writes
      await flushPendingWrites();

      const completedSessions: AuditSession[] = [];

      for (let i = 0; i < deviceIds.length; i++) {
        const deviceId = deviceIds[i];
        const device = await getDevice(deviceId);
        
        if (!device) {
          console.warn(`[AuditStore] Device not found: ${deviceId}`);
          continue;
        }

        let session: AuditSession;

        if (i === 0) {
          // First device - use existing session
          const existingSession = get().currentSession;
          if (existingSession) {
            session = existingSession;
          } else {
            // Create if needed
            session = await createAuditSession(projectId, device.id, device.localId, userId);
          }
        } else {
          // Other devices - create new session
          session = await createAuditSession(projectId, device.id, device.localId, userId);
          
          // Copy all answers to this session
          for (const [fieldId, answer] of answers.entries()) {
            await upsertAnswer(
              session.id,
              session.localId.toString(),
              device.id,
              fieldId,
              userId,
              answer.valueText || null,
              answer.logicalDataColumnNumber,
              undefined
            );
          }
        }

        // Complete the session
        await completeAuditSession(session.localId, undefined);
        
        completedSessions.push({
          ...session,
          status: 'completed',
          completedAt: Date.now(),
          syncStatus: 'pending_upload',
        });

        console.log(`[AuditStore] Completed audit for device ${i + 1}/${deviceIds.length}: ${device.name}`);
      }

      set({ isLoading: false });

      // If online, sync all completed sessions
      const online = await isOnline();
      if (online) {
        console.log('[AuditStore] Syncing all completed sessions to server...');
        uploadProject(projectId, 0).then(result => {
          if (result.success) {
            console.log(`[AuditStore] All ${completedSessions.length} sessions synced successfully`);
          } else {
            console.log('[AuditStore] Failed to sync sessions:', result.message);
          }
        }).catch(err => {
          console.log('[AuditStore] Error syncing sessions:', err);
        });
      }

      return true;
    } catch (error) {
      console.error('[AuditStore] Error completing multiple audits:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Błąd zakończenia audytów',
        isLoading: false 
      });
      return false;
    }
  },

  // Complete multiple devices with per-device answers (batch audit with varied answers)
  completeAuditForMultipleDevicesWithVariedAnswers: async (
    deviceIds: string[],
    projectId: string,
    userId: string,
    defaultAnswers: Map<string, AuditAnswer>,
    perDeviceAnswers: Map<string, Map<string, string | null>>
  ) => {
    if (deviceIds.length === 0) {
      set({ error: 'Brak urządzeń do audytu' });
      return false;
    }

    set({ isLoading: true });

    try {
      // Flush any pending debounced writes
      await flushPendingWrites();

      const completedSessions: AuditSession[] = [];

      for (let i = 0; i < deviceIds.length; i++) {
        const deviceId = deviceIds[i];
        const device = await getDevice(deviceId);
        
        if (!device) {
          console.warn(`[AuditStore] Device not found: ${deviceId}`);
          continue;
        }

        let session: AuditSession;

        if (i === 0) {
          // First device - use existing session from store
          const existingSession = get().currentSession;
          if (existingSession) {
            session = existingSession;
            console.log(`[AuditStore] First device: using session from store: ${existingSession.localId}`);
          } else {
            // Fallback: check DB for existing session (use device.id!)
            console.log(`[AuditStore] First device fallback: deviceId=${deviceId}, device.id=${device.id}`);
            const dbSession = await getExistingSessionForDevice(device.id);
            session = dbSession || await createAuditSession(projectId, device.id, device.localId, userId);
          }
        } else {
          // Other devices - check for existing session first (created by startBatchAudit)
          // IMPORTANT: Use device.id (not deviceId from loop) because that's what session was created with
          console.log(`[AuditStore] Looking for session: deviceId=${deviceId}, device.id=${device.id}, device.localId=${device.localId}`);
          const existingSession = await getExistingSessionForDevice(device.id);
          if (existingSession) {
            session = existingSession;
            console.log(`[AuditStore] Using existing session for device ${device.name}: ${existingSession.localId}`);
          } else {
            session = await createAuditSession(projectId, device.id, device.localId, userId);
            console.log(`[AuditStore] Created new session for device ${device.name}`);
          }
        }
        
        // Save answers - use per-device answer if available, otherwise use default
        console.log(`[AuditStore] Saving answers for device ${device.name}, session ${session.localId}`);
        console.log(`[AuditStore] defaultAnswers size: ${defaultAnswers.size}, perDeviceAnswers size: ${perDeviceAnswers.size}`);
        
        let savedCount = 0;
        let perDeviceCount = 0;
        
        // Collect ALL field IDs that need to be saved (from both defaultAnswers and perDeviceAnswers)
        const allFieldIds = new Set<string>();
        for (const fieldId of defaultAnswers.keys()) {
          allFieldIds.add(fieldId);
        }
        for (const fieldId of perDeviceAnswers.keys()) {
          allFieldIds.add(fieldId);
        }
        
        console.log(`[AuditStore] Total fields to save: ${allFieldIds.size}`);
        
        for (const fieldId of allFieldIds) {
          const answer = defaultAnswers.get(fieldId);
          let valueToSave = answer?.valueText || null;
          
          // Check if there's a per-device answer for this field
          // Use device.id (consistent with how perDeviceAnswers was populated)
          const deviceAnswersMap = perDeviceAnswers.get(fieldId);
          if (deviceAnswersMap) {
            // Try both device.id and deviceId (from loop) in case of mismatch
            const perDeviceValue = deviceAnswersMap.get(device.id) ?? deviceAnswersMap.get(deviceId);
            if (perDeviceValue !== undefined) {
              console.log(`[AuditStore] Using per-device value for ${fieldId}: ${perDeviceValue}`);
              valueToSave = perDeviceValue;
              perDeviceCount++;
            }
          }
          
          // Only save if we have a value (don't save null unless it was explicitly set)
          if (valueToSave !== null) {
            await upsertAnswer(
              session.id,
              session.localId.toString(),
              device.id,
              fieldId,
              userId,
              valueToSave,
              answer?.logicalDataColumnNumber,
              undefined
            );
            savedCount++;
          }
        }
        
        console.log(`[AuditStore] Saved ${savedCount} answers (${perDeviceCount} with per-device values) for ${device.name}`);

        // Complete the session
        await completeAuditSession(session.localId, undefined);
        
        completedSessions.push({
          ...session,
          status: 'completed',
          completedAt: Date.now(),
          syncStatus: 'pending_upload',
        });

        console.log(`[AuditStore] Completed audit for device ${i + 1}/${deviceIds.length}: ${device.name}`);
      }

      set({ isLoading: false });

      // If online, sync all completed sessions
      const online = await isOnline();
      if (online) {
        console.log('[AuditStore] Syncing all completed sessions to server...');
        uploadProject(projectId, 0).then(result => {
          if (result.success) {
            console.log(`[AuditStore] All ${completedSessions.length} sessions synced successfully`);
          } else {
            console.log('[AuditStore] Failed to sync sessions:', result.message);
          }
        }).catch(err => {
          console.log('[AuditStore] Error syncing sessions:', err);
        });
      }

      return true;
    } catch (error) {
      console.error('[AuditStore] Error completing multiple audits with varied answers:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Błąd zakończenia audytów',
        isLoading: false 
      });
      return false;
    }
  },

  clearAudit: () => {
    set({
      currentSession: null,
      currentDevice: null,
      formConfig: null,
      currentTabIndex: 0,
      answers: new Map(),
      error: null,
      _sessionNeedsSyncOnFirstAnswer: false,
    });
  },

  clearError: () => set({ error: null }),
}));
