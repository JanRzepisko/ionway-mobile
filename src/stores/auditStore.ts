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
      // Check for existing in-progress session
      let session = await getInProgressSession(deviceId);
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

  resumeAudit: async (sessionId: string) => {
    set({ isLoading: true, error: null });
    
    try {
      const session = await getAuditSession(sessionId);
      if (!session) {
        throw new Error('Sesja audytu nie znaleziona');
      }
      
      const device = await getDevice(session.deviceId);
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
          // First device - use existing session
          const existingSession = get().currentSession;
          if (existingSession) {
            session = existingSession;
          } else {
            session = await createAuditSession(projectId, device.id, device.localId, userId);
          }
        } else {
          // Other devices - create new session
          session = await createAuditSession(projectId, device.id, device.localId, userId);
        }
        
        // Save answers - use per-device answer if available, otherwise use default
        for (const [fieldId, answer] of defaultAnswers.entries()) {
          let valueToSave = answer.valueText || null;
          
          // Check if there's a per-device answer for this field
          const deviceAnswersMap = perDeviceAnswers.get(fieldId);
          if (deviceAnswersMap && deviceAnswersMap.has(deviceId)) {
            valueToSave = deviceAnswersMap.get(deviceId) ?? null;
          }
          
          await upsertAnswer(
            session.id,
            session.localId.toString(),
            device.id,
            fieldId,
            userId,
            valueToSave,
            answer.logicalDataColumnNumber,
            undefined
          );
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
