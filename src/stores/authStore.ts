// =============================================================================
// Auth Store - User Authentication State
// Supports offline login for previously authenticated users
// =============================================================================

import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { User } from '../types';
import { login as apiLogin, logout as apiLogout, clearTokens, getAccessToken, checkApiConnection } from '../services/api';
import { clearAllData, hasLocalData } from '../database/schema';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  isOfflineMode: boolean;
  lastAuthenticatedAt: number | null;
  
  // Actions
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  loadStoredAuth: () => Promise<void>;
  clearError: () => void;
  tryOfflineAccess: () => Promise<boolean>;
}

const USER_STORAGE_KEY = 'audix_user';
const LAST_AUTH_KEY = 'audix_last_auth';
const OFFLINE_SESSION_MAX_AGE = 90 * 24 * 60 * 60 * 1000; // 90 days

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  isOfflineMode: false,
  lastAuthenticatedAt: null,

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    
    try {
      const result = await apiLogin(email, password);
      
      // Store user info and authentication timestamp
      await SecureStore.setItemAsync(USER_STORAGE_KEY, JSON.stringify(result.user));
      await SecureStore.setItemAsync(LAST_AUTH_KEY, Date.now().toString());
      
      set({ 
        user: result.user, 
        isAuthenticated: true, 
        isLoading: false,
        isOfflineMode: false,
        lastAuthenticatedAt: Date.now()
      });
      
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Błąd logowania';
      set({ 
        error: message, 
        isLoading: false,
        isAuthenticated: false,
        user: null
      });
      return false;
    }
  },

  logout: async () => {
    set({ isLoading: true });
    
    try {
      await apiLogout();
    } catch {
      // Ignore logout errors - user might be offline
    }
    
    // Clear all local data
    await SecureStore.deleteItemAsync(USER_STORAGE_KEY);
    await SecureStore.deleteItemAsync(LAST_AUTH_KEY);
    await clearTokens();
    await clearAllData();
    
    set({ 
      user: null, 
      isAuthenticated: false, 
      isLoading: false,
      isOfflineMode: false,
      lastAuthenticatedAt: null,
      error: null
    });
  },

  loadStoredAuth: async () => {
    set({ isLoading: true });
    
    try {
      const userJson = await SecureStore.getItemAsync(USER_STORAGE_KEY);
      const lastAuthStr = await SecureStore.getItemAsync(LAST_AUTH_KEY);
      const token = await getAccessToken();
      
      if (userJson && token) {
        const user = JSON.parse(userJson) as User;
        const lastAuth = lastAuthStr ? parseInt(lastAuthStr, 10) : null;
        
        // Check if we can connect to API
        const isOnline = await checkApiConnection();
        
        set({ 
          user, 
          isAuthenticated: true, 
          isLoading: false,
          isOfflineMode: !isOnline,
          lastAuthenticatedAt: lastAuth
        });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  // Allow offline access for previously authenticated users with local data
  tryOfflineAccess: async () => {
    set({ isLoading: true, error: null });
    
    try {
      const userJson = await SecureStore.getItemAsync(USER_STORAGE_KEY);
      const lastAuthStr = await SecureStore.getItemAsync(LAST_AUTH_KEY);
      
      if (!userJson) {
        set({ 
          isLoading: false, 
          error: 'Brak zapisanych danych logowania. Połącz się z internetem, aby się zalogować.' 
        });
        return false;
      }
      
      const lastAuth = lastAuthStr ? parseInt(lastAuthStr, 10) : 0;
      const sessionAge = Date.now() - lastAuth;
      
      // Check if offline session is still valid (within 7 days)
      if (sessionAge > OFFLINE_SESSION_MAX_AGE) {
        set({ 
          isLoading: false, 
          error: 'Sesja wygasła. Połącz się z internetem, aby się zalogować ponownie.' 
        });
        return false;
      }
      
      // Check if there's local data to work with
      const hasData = await hasLocalData();
      if (!hasData) {
        set({ 
          isLoading: false, 
          error: 'Brak pobranych danych. Połącz się z internetem, aby pobrać dane projektu.' 
        });
        return false;
      }
      
      const user = JSON.parse(userJson) as User;
      
      set({ 
        user, 
        isAuthenticated: true, 
        isLoading: false,
        isOfflineMode: true,
        lastAuthenticatedAt: lastAuth
      });
      
      return true;
    } catch {
      set({ 
        isLoading: false, 
        error: 'Błąd podczas próby dostępu offline.' 
      });
      return false;
    }
  },

  clearError: () => set({ error: null }),
}));

// Auditor info snapshot for audit records
export interface AuditorSnapshot {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
}

export function getAuditorSnapshot(user: User | null): AuditorSnapshot | null {
  if (!user) return null;
  
  return {
    userId: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: user.fullName || `${user.firstName} ${user.lastName}`,
  };
}
