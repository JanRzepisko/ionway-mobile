// =============================================================================
// Settings Store - App configuration
// =============================================================================

import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

const SETTINGS_KEY = 'audix_settings';

interface Settings {
  developerMode: boolean;
  localApiUrl: string;
  backgroundSyncEnabled: boolean;
}

interface SettingsState {
  settings: Settings;
  isLoaded: boolean;
  loadSettings: () => Promise<void>;
  setDeveloperMode: (enabled: boolean) => Promise<void>;
  setLocalApiUrl: (url: string) => Promise<void>;
  setBackgroundSyncEnabled: (enabled: boolean) => Promise<void>;
}

const defaultSettings: Settings = {
  developerMode: false,
  localApiUrl: 'http://localhost:5004/api',
  backgroundSyncEnabled: true, // Enabled by default
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: defaultSettings,
  isLoaded: false,

  loadSettings: async () => {
    try {
      const stored = await SecureStore.getItemAsync(SETTINGS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        set({ settings: { ...defaultSettings, ...parsed }, isLoaded: true });
      } else {
        set({ isLoaded: true });
      }
    } catch (error) {
      console.error('[SettingsStore] Failed to load settings:', error);
      set({ isLoaded: true });
    }
  },

  setDeveloperMode: async (enabled: boolean) => {
    const newSettings = { ...get().settings, developerMode: enabled };
    set({ settings: newSettings });
    await SecureStore.setItemAsync(SETTINGS_KEY, JSON.stringify(newSettings));
  },

  setLocalApiUrl: async (url: string) => {
    const newSettings = { ...get().settings, localApiUrl: url };
    set({ settings: newSettings });
    await SecureStore.setItemAsync(SETTINGS_KEY, JSON.stringify(newSettings));
  },

  setBackgroundSyncEnabled: async (enabled: boolean) => {
    const newSettings = { ...get().settings, backgroundSyncEnabled: enabled };
    set({ settings: newSettings });
    await SecureStore.setItemAsync(SETTINGS_KEY, JSON.stringify(newSettings));
  },
}));

// Helper to get current API URL
export function getApiBaseUrl(): string {
  const { settings } = useSettingsStore.getState();
  
  if (__DEV__ && settings.developerMode) {
    return settings.localApiUrl;
  }
  
  return 'https://audixapi.bmscope.com/api';
}
