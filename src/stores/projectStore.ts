// =============================================================================
// Project Store - Current Project & Sync State
// =============================================================================

import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { Project, Device, DeviceFilters, SyncStatus } from '../types';
import { 
  getAllProjects as dbGetProjects, 
  getProject as dbGetProject,
  saveProject,
  deleteProject as dbDeleteProject
} from '../database/projects';

const SELECTED_PROJECT_KEY = 'audix_selected_project';
import { 
  getFilteredDevices, 
  getDistinctBuildings,
  getDistinctLevels,
  getDistinctZones,
  getDistinctSystems,
  getDistinctGroups,
  getDistinctTypes,
  createDeviceOffline,
  getDeviceCount
} from '../database/devices';
import { 
  downloadProject, 
  uploadProject, 
  isOnline,
  getSyncStatus,
  comprehensiveSync
} from '../services/syncService';
import { 
  startBackgroundSync, 
  stopBackgroundSync,
  setBackgroundSyncProject,
  forceSync 
} from '../services/backgroundSync';
import { fixStuckUploadingSessions } from '../database/audits';
import { fixStuckUploadingDevices } from '../database/devices';
import { getProjects as apiGetProjects } from '../services/api';
import { getPendingAuditSessions } from '../database/audits';
import { getPhotosPendingUploadForProject } from '../database/photos';
import { flushPendingWrites } from './auditStore';

interface ProjectState {
  // Projects
  projects: Project[];
  currentProject: Project | null;
  
  // Devices
  devices: Device[];
  selectedDevice: Device | null;
  filters: DeviceFilters;
  filterOptions: {
    buildings: string[];
    levels: string[];
    zones: string[];
    systems: string[];
    groups: string[];
    types: string[];
  };
  
  // Sync state
  isOnline: boolean;
  isDownloading: boolean;
  isUploading: boolean;
  syncProgress: string;
  pendingUploads: number;
  lastSyncAt?: number;
  syncError: string | null;
  
  // Loading
  isLoading: boolean;
  error: string | null;
  
  // Flag indicating current project was removed from server
  currentProjectRemoved: boolean;
  
  // Actions
  loadProjects: () => Promise<void>;
  fetchProjectsFromApi: () => Promise<boolean>; // returns true if current project was removed
  clearCurrentProject: () => Promise<void>;
  selectProject: (projectId: string) => Promise<void>;
  loadStoredProject: () => Promise<void>;
  
  // Device actions
  loadDevices: () => Promise<void>;
  selectDevice: (device: Device | null) => void;
  setFilter: (key: keyof DeviceFilters, value: string | undefined) => Promise<void>;
  clearFilters: () => Promise<void>;
  createDevice: (data: {
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
  }, userId: string, userFirstName: string, userLastName: string) => Promise<Device>;
  
  // Sync actions
  downloadProjectData: () => Promise<boolean>;
  uploadProjectData: () => Promise<boolean>;
  syncAll: () => Promise<{ success: boolean; message: string }>;
  checkOnlineStatus: () => Promise<void>;
  updateSyncStatus: () => Promise<void>;
  
  // Helpers
  clearError: () => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  // Initial state
  projects: [],
  currentProject: null,
  devices: [],
  selectedDevice: null,
  filters: {},
  filterOptions: {
    buildings: [],
    levels: [],
    zones: [],
    systems: [],
    groups: [],
    types: [],
  },
  isOnline: false,
  isDownloading: false,
  isUploading: false,
  syncProgress: '',
  pendingUploads: 0,
  lastSyncAt: undefined,
  syncError: null,
  isLoading: false,
  error: null,
  currentProjectRemoved: false,

  // Load projects from local database
  loadProjects: async () => {
    set({ isLoading: true, error: null });
    
    try {
      const projects = await dbGetProjects();
      set({ projects, isLoading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Błąd ładowania projektów',
        isLoading: false 
      });
    }
  },

  // Fetch projects from API (when online) - returns true if current project was removed
  fetchProjectsFromApi: async () => {
    const online = await isOnline();
    if (!online) return false;
    
    set({ isLoading: true, error: null, currentProjectRemoved: false });
    
    try {
      const apiProjects = await apiGetProjects();
      const apiProjectIds = new Set(apiProjects.map(p => p.id));
      
      // Get current local projects
      const localProjects = await dbGetProjects();
      
      // Delete local projects that don't exist on server anymore
      for (const localProject of localProjects) {
        if (!apiProjectIds.has(localProject.id)) {
          await dbDeleteProject(localProject.id);
        }
      }
      
      // Save/update projects from API
      for (const project of apiProjects) {
        await saveProject(project);
      }
      
      // Reload from database
      const projects = await dbGetProjects();
      
      // Check if current project still exists
      const { currentProject } = get();
      let projectRemoved = false;
      
      if (currentProject && !apiProjectIds.has(currentProject.id)) {
        // Current project was deleted on server - clear it
        await SecureStore.deleteItemAsync(SELECTED_PROJECT_KEY);
        set({ 
          currentProject: null, 
          devices: [], 
          currentProjectRemoved: true 
        });
        projectRemoved = true;
      }
      
      set({ projects, isLoading: false });
      return projectRemoved;
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Błąd pobierania projektów',
        isLoading: false 
      });
      return false;
    }
  },
  
  // Clear current project selection
  clearCurrentProject: async () => {
    // Stop background sync
    stopBackgroundSync();
    
    await SecureStore.deleteItemAsync(SELECTED_PROJECT_KEY);
    set({ 
      currentProject: null, 
      devices: [], 
      selectedDevice: null,
      filters: {},
      currentProjectRemoved: false
    });
  },

  // Select and load a project
  selectProject: async (projectId: string) => {
    set({ isLoading: true, error: null });
    
    try {
      const project = await dbGetProject(projectId);
      
      if (project) {
        // Save selection to local storage
        await SecureStore.setItemAsync(SELECTED_PROJECT_KEY, projectId);
        
        set({ 
          currentProject: project,
          filters: {},
          isLoading: false 
        });
        
        // Load devices and filters
        await get().loadDevices();
        await get().updateSyncStatus();
        
        // Start background sync for this project
        startBackgroundSync(projectId);
      } else {
        set({ 
          error: 'Projekt nie znaleziony',
          isLoading: false 
        });
      }
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Błąd wyboru projektu',
        isLoading: false 
      });
    }
  },

  // Load stored project from local storage
  loadStoredProject: async () => {
    try {
      const projectId = await SecureStore.getItemAsync(SELECTED_PROJECT_KEY);
      if (projectId) {
        const project = await dbGetProject(projectId);
        if (project) {
          set({ currentProject: project, filters: {} });
          await get().loadDevices();
          await get().updateSyncStatus();
          
          // Start background sync for this project
          startBackgroundSync(projectId);
        }
      }
    } catch (error) {
      console.error('Failed to load stored project:', error);
    }
  },

  // Load devices with current filters
  loadDevices: async () => {
    const { currentProject, filters } = get();
    if (!currentProject) return;
    
    try {
      const devices = await getFilteredDevices(currentProject.id, filters);
      
      // Load filter options based on current filters
      const buildings = await getDistinctBuildings(currentProject.id);
      const levels = await getDistinctLevels(currentProject.id, filters.building);
      const zones = await getDistinctZones(currentProject.id, filters.building, filters.level);
      const systems = await getDistinctSystems(currentProject.id, filters.building, filters.level, filters.zone);
      const groups = await getDistinctGroups(currentProject.id, filters);
      const types = await getDistinctTypes(currentProject.id, filters);
      
      set({ 
        devices,
        filterOptions: { buildings, levels, zones, systems, groups, types }
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Błąd ładowania urządzeń' });
    }
  },

  selectDevice: (device: Device | null) => {
    set({ selectedDevice: device });
  },

  setFilter: async (key: keyof DeviceFilters, value: string | undefined) => {
    const { filters } = get();
    
    // Create new filters, clearing downstream filters
    const newFilters: DeviceFilters = { ...filters };
    
    const filterOrder: (keyof DeviceFilters)[] = [
      'building', 'level', 'zone', 'system', 'group', 'type'
    ];
    
    const keyIndex = filterOrder.indexOf(key);
    
    // Set the new value
    newFilters[key] = value;
    
    // Clear all filters after this one (cascade)
    for (let i = keyIndex + 1; i < filterOrder.length; i++) {
      delete newFilters[filterOrder[i]];
    }
    
    set({ filters: newFilters });
    await get().loadDevices();
  },

  clearFilters: async () => {
    set({ filters: {} });
    await get().loadDevices();
  },

  createDevice: async (data, userId, userFirstName, userLastName) => {
    const { currentProject } = get();
    if (!currentProject) {
      throw new Error('Brak wybranego projektu');
    }
    
    const device = await createDeviceOffline(
      currentProject.id, 
      userId, 
      userFirstName, 
      userLastName, 
      data
    );
    
    // Reload devices
    await get().loadDevices();
    await get().updateSyncStatus();
    
    return device;
  },

  // Download project data from server
  downloadProjectData: async () => {
    const { currentProject } = get();
    if (!currentProject) return false;
    
    set({ isDownloading: true, syncError: null, syncProgress: '' });
    
    const result = await downloadProject(
      currentProject.id,
      currentProject.lastSyncAt,
      currentProject.importVersion,
      (progress) => set({ syncProgress: progress })
    );
    
    set({ isDownloading: false, syncProgress: '' });
    
    if (result.success) {
      // Reload project and devices
      await get().selectProject(currentProject.id);
      return true;
    } else {
      set({ syncError: result.message });
      return false;
    }
  },

  // Upload local data to server
  uploadProjectData: async () => {
    const { currentProject } = get();
    if (!currentProject) return false;
    
    set({ isUploading: true, syncError: null, syncProgress: 'Finalizowanie zapisów...' });
    
    // Flush any pending debounced writes before uploading
    await flushPendingWrites();
    
    set({ syncProgress: 'Naprawianie utknętych sesji...' });
    
    // Fix any stuck sessions/devices before uploading
    try {
      await Promise.all([
        fixStuckUploadingSessions(currentProject.id),
        fixStuckUploadingDevices(currentProject.id),
      ]);
    } catch (err) {
      console.warn('[Upload] Error fixing stuck sessions:', err);
    }
    
    set({ syncProgress: 'Wysyłanie danych...' });
    
    try {
      const result = await uploadProject(
        currentProject.id,
        currentProject.importVersion,
        (progress) => set({ syncProgress: progress })
      );
      
      set({ isUploading: false, syncProgress: '' });
      
      if (result.success) {
        await get().updateSyncStatus();
        return true;
      } else {
        set({ syncError: result.message });
        return false;
      }
    } catch (error) {
      console.error('Upload error:', error);
      set({ 
        isUploading: false, 
        syncProgress: '',
        syncError: error instanceof Error ? error.message : 'Błąd wysyłania danych'
      });
      return false;
    }
  },

  // Comprehensive sync - one button to sync everything
  syncAll: async () => {
    const { currentProject } = get();
    if (!currentProject) {
      return { success: false, message: 'Brak wybranego projektu' };
    }
    
    set({ 
      isUploading: true, 
      isDownloading: true,
      syncError: null, 
      syncProgress: 'Rozpoczynanie synchronizacji...' 
    });
    
    // Flush pending writes
    await flushPendingWrites();
    
    // Fix any stuck sessions
    await fixStuckUploadingSessions(currentProject.id);
    await fixStuckUploadingDevices(currentProject.id);
    
    try {
      const result = await comprehensiveSync(
        currentProject.id,
        currentProject.importVersion,
        (progress) => set({ syncProgress: progress })
      );
      
      set({ 
        isUploading: false, 
        isDownloading: false,
        syncProgress: '' 
      });
      
      if (result.success) {
        await get().updateSyncStatus();
        // Reload devices
        await get().loadDevices();
      } else {
        set({ syncError: result.errors.join(', ') || result.message });
      }
      
      return { success: result.success, message: result.message };
    } catch (error) {
      console.error('Sync error:', error);
      const message = error instanceof Error ? error.message : 'Błąd synchronizacji';
      set({ 
        isUploading: false, 
        isDownloading: false,
        syncProgress: '',
        syncError: message
      });
      return { success: false, message };
    }
  },

  checkOnlineStatus: async () => {
    const online = await isOnline();
    set({ isOnline: online });
  },

  updateSyncStatus: async () => {
    const { currentProject } = get();
    if (!currentProject) return;
    
    const online = await isOnline();
    const pendingAudits = await getPendingAuditSessions(currentProject.id);
    const pendingPhotos = await getPhotosPendingUploadForProject(currentProject.id);
    const deviceCount = await getDeviceCount(currentProject.id);
    
    set({ 
      isOnline: online,
      pendingUploads: pendingAudits.length + pendingPhotos.length,
      lastSyncAt: currentProject.lastSyncAt,
    });
  },

  clearError: () => set({ error: null, syncError: null }),
}));
