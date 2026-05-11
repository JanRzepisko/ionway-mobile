// =============================================================================
// API Client - Communication with Backend
// =============================================================================

import axios, { AxiosInstance, AxiosError } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { 
  AuthState, 
  User, 
  Project,
  MobileDownloadResponse, 
  MobileUploadRequest, 
  MobileUploadResponse 
} from '../types';
import { useSettingsStore } from '../stores/settingsStore';

// API Configuration
const PRODUCTION_API_URL = 'https://audixapi.bmscope.com/api';

// Get current API URL based on settings
function getApiBaseUrl(): string {
  const { settings } = useSettingsStore.getState();
  
  if (__DEV__ && settings.developerMode) {
    return settings.localApiUrl;
  }
  
  return PRODUCTION_API_URL;
}

// Create axios instance with dynamic base URL
const api: AxiosInstance = axios.create({
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Create axios instance with longer timeout for uploads
const apiUpload: AxiosInstance = axios.create({
  timeout: 120000, // 2 minutes for large uploads
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to set dynamic baseURL
api.interceptors.request.use(
  async (config) => {
    config.baseURL = getApiBaseUrl();
    return config;
  },
  (error) => Promise.reject(error)
);

apiUpload.interceptors.request.use(
  async (config) => {
    config.baseURL = getApiBaseUrl();
    return config;
  },
  (error) => Promise.reject(error)
);

// Token storage keys
const TOKEN_KEY = 'audix_access_token';
const REFRESH_TOKEN_KEY = 'audix_refresh_token';

// -----------------------------------------------------------------------------
// Token Management
// -----------------------------------------------------------------------------

export async function setTokens(accessToken: string, refreshToken: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, accessToken);
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
}

export async function getAccessToken(): Promise<string | null> {
  return await SecureStore.getItemAsync(TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}

// Request interceptor - add auth header (combines with baseURL interceptor above)
api.interceptors.request.use(
  async (config) => {
    const token = await getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add auth header to upload client too
apiUpload.interceptors.request.use(
  async (config) => {
    const token = await getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && originalRequest) {
      try {
        const refreshToken = await getRefreshToken();
        if (refreshToken) {
          const baseUrl = getApiBaseUrl();
          const response = await axios.post(`${baseUrl}/auth/refresh`, {
            refreshToken,
          });
          
          const { accessToken, refreshToken: newRefreshToken } = response.data.data;
          await setTokens(accessToken, newRefreshToken);
          
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        }
      } catch {
        await clearTokens();
      }
    }
    
    return Promise.reject(error);
  }
);

// -----------------------------------------------------------------------------
// Auth API
// -----------------------------------------------------------------------------

export async function login(
  email: string, 
  password: string
): Promise<{ user: User; accessToken: string; refreshToken: string; expiresIn: number }> {
  const baseUrl = getApiBaseUrl();
  console.log('[API] Login attempt to:', baseUrl + '/auth/login');
  try {
    const response = await api.post('/auth/login', { email, password });
    console.log('[API] Login success:', response.status);
    const data = response.data.data;
  
    await setTokens(data.accessToken, data.refreshToken);
  
    return {
      user: data.user,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expiresIn: data.expiresIn,
    };
  } catch (error: unknown) {
    console.log('[API] Login error:', error);
    throw error;
  }
}

export async function logout(): Promise<void> {
  try {
    const refreshToken = await getRefreshToken();
    if (refreshToken) {
      await api.post('/auth/logout', { refreshToken });
    }
  } finally {
    await clearTokens();
  }
}

export async function refreshTokens(): Promise<{ accessToken: string; refreshToken: string }> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }
  
  const response = await api.post('/auth/refresh', { refreshToken });
  const data = response.data.data;
  
  await setTokens(data.accessToken, data.refreshToken);
  
  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
  };
}

// -----------------------------------------------------------------------------
// Projects API
// -----------------------------------------------------------------------------

export async function getProjects(): Promise<Project[]> {
  const response = await api.get('/projects');
  return response.data.data.items.map((p: any) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    status: p.status,
    importVersion: 0,
    deviceCount: 0,
  }));
}

export async function getProject(projectId: string): Promise<Project> {
  const response = await api.get(`/projects/${projectId}`);
  const p = response.data.data;
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    status: p.status,
    importVersion: 0,
    deviceCount: 0,
  };
}

// -----------------------------------------------------------------------------
// Mobile Sync API
// -----------------------------------------------------------------------------

export async function downloadProjectData(
  projectId: string,
  mobileDeviceId: string,
  lastSyncAt?: number,
  lastKnownImportVersion?: number
): Promise<MobileDownloadResponse> {
  const params = new URLSearchParams();
  params.append('mobileDeviceId', mobileDeviceId);
  if (lastSyncAt) {
    params.append('lastSyncAt', new Date(lastSyncAt).toISOString());
  }
  if (lastKnownImportVersion !== undefined) {
    params.append('lastKnownImportVersion', lastKnownImportVersion.toString());
  }
  
  const response = await api.get(`/mobile/projects/${projectId}/download?${params.toString()}`);
  return response.data.data;
}

export async function uploadProjectData(
  projectId: string,
  request: MobileUploadRequest
): Promise<MobileUploadResponse> {
  // Use longer timeout for uploads - get auth token manually
  const token = await getAccessToken();
  const response = await apiUpload.post(
    `/mobile/projects/${projectId}/upload`, 
    request,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} }
  );
  return response.data.data;
}

// -----------------------------------------------------------------------------
// Network Status
// -----------------------------------------------------------------------------

export async function checkApiConnection(): Promise<boolean> {
  try {
    const baseUrl = getApiBaseUrl();
    const response = await axios.get(`${baseUrl}/health`, { timeout: 5000 });
    return response.status === 200;
  } catch {
    return false;
  }
}

// Export for settings screen to show current URL
export function getCurrentApiUrl(): string {
  return getApiBaseUrl();
}

// -----------------------------------------------------------------------------
// Error Handling
// -----------------------------------------------------------------------------

export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ message?: string; errors?: string[] }>;
    
    if (axiosError.response?.data?.message) {
      return axiosError.response.data.message;
    }
    
    if (axiosError.response?.data?.errors?.length) {
      return axiosError.response.data.errors.join(', ');
    }
    
    if (axiosError.code === 'ECONNABORTED') {
      return 'Przekroczono limit czasu połączenia';
    }
    
    if (axiosError.code === 'ERR_NETWORK') {
      return 'Brak połączenia z serwerem';
    }
    
    return axiosError.message;
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  return 'Wystąpił nieznany błąd';
}

export default api;
