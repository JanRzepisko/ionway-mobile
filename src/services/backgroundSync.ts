// =============================================================================
// Background Sync Service - Automatic sync when online
// =============================================================================

import { AppState, AppStateStatus } from 'react-native';
import { isOnline, uploadProject, getSyncStatus } from './syncService';
import { useSettingsStore } from '../stores/settingsStore';

const SYNC_INTERVAL_MS = 30000; // 30 seconds
const MIN_SYNC_INTERVAL_MS = 10000; // Minimum 10 seconds between syncs

let syncInterval: NodeJS.Timeout | null = null;
let lastSyncTime = 0;
let isCurrentlySyncing = false;
let currentProjectId: string | null = null;

// Listeners for sync events
type SyncListener = (event: 'start' | 'success' | 'error' | 'no_data', message?: string) => void;
const listeners: Set<SyncListener> = new Set();

export function addSyncListener(listener: SyncListener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyListeners(event: 'start' | 'success' | 'error' | 'no_data', message?: string) {
  listeners.forEach(listener => listener(event, message));
}

async function performBackgroundSync() {
  // Don't sync if already syncing
  if (isCurrentlySyncing) {
    console.log('[BackgroundSync] Already syncing, skipping');
    return;
  }

  // Don't sync too frequently
  const now = Date.now();
  if (now - lastSyncTime < MIN_SYNC_INTERVAL_MS) {
    return;
  }

  // Check if background sync is enabled
  const { settings } = useSettingsStore.getState();
  if (!settings.backgroundSyncEnabled) {
    return;
  }

  // Need a project to sync
  if (!currentProjectId) {
    return;
  }

  try {
    // Check if online
    const online = await isOnline();
    if (!online) {
      return;
    }

    // Check if there's anything to sync
    const status = await getSyncStatus(currentProjectId);
    if (status.pendingDevices === 0 && status.pendingAudits === 0) {
      return;
    }

    console.log(`[BackgroundSync] Starting sync - ${status.pendingDevices} devices, ${status.pendingAudits} audits pending`);
    isCurrentlySyncing = true;
    lastSyncTime = now;
    notifyListeners('start');

    const result = await uploadProject(currentProjectId, 0);

    if (result.success) {
      console.log('[BackgroundSync] Sync successful:', result.stats);
      notifyListeners('success', `Wysłano: ${result.stats?.auditsUploaded || 0} audytów`);
    } else {
      console.log('[BackgroundSync] Sync failed:', result.message);
      notifyListeners('error', result.message);
    }
  } catch (error) {
    console.error('[BackgroundSync] Error:', error);
    notifyListeners('error', error instanceof Error ? error.message : 'Błąd synchronizacji');
  } finally {
    isCurrentlySyncing = false;
  }
}

export function startBackgroundSync(projectId: string) {
  currentProjectId = projectId;
  
  // Stop any existing interval
  stopBackgroundSync();

  console.log('[BackgroundSync] Starting background sync service');
  
  // Start periodic sync
  syncInterval = setInterval(performBackgroundSync, SYNC_INTERVAL_MS);
  
  // Also sync immediately when starting
  performBackgroundSync();
  
  // Listen for app state changes (resume from background)
  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (nextAppState === 'active') {
      console.log('[BackgroundSync] App became active, triggering sync');
      performBackgroundSync();
    }
  };
  
  const subscription = AppState.addEventListener('change', handleAppStateChange);
  
  // Store cleanup function
  (startBackgroundSync as any)._cleanup = () => {
    subscription.remove();
  };
}

export function stopBackgroundSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
  
  // Cleanup app state listener
  if ((startBackgroundSync as any)._cleanup) {
    (startBackgroundSync as any)._cleanup();
    (startBackgroundSync as any)._cleanup = null;
  }
  
  currentProjectId = null;
  console.log('[BackgroundSync] Stopped background sync service');
}

export function triggerSync() {
  // Manually trigger a sync (e.g., when user completes an audit)
  lastSyncTime = 0; // Reset to allow immediate sync
  performBackgroundSync();
}

export function isBackgroundSyncRunning() {
  return syncInterval !== null;
}

export function setBackgroundSyncProject(projectId: string | null) {
  currentProjectId = projectId;
}
