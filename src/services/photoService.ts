import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import api from './api';
import {
  createAuditPhoto,
  createAuditPhotosForDevices,
  getPhotosPendingUploadForProject,
  markPhotoAsSynced,
  markPhotoUploadError,
  AuditPhoto
} from '../database';

export interface PhotoPickerResult {
  uri: string;
  fileName: string;
  contentType: string;
  fileSize: number;
}

/**
 * Request camera permissions
 */
export async function requestCameraPermissions(): Promise<boolean> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  return status === 'granted';
}

/**
 * Request media library permissions
 */
export async function requestMediaLibraryPermissions(): Promise<boolean> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return status === 'granted';
}

/**
 * Take a photo with the camera
 */
export async function takePhoto(): Promise<PhotoPickerResult | null> {
  const hasPermission = await requestCameraPermissions();
  if (!hasPermission) {
    throw new Error('Camera permission denied');
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 0.8,
    exif: false,
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return null;
  }

  const asset = result.assets[0];
  const fileName = asset.fileName || `photo_${Date.now()}.jpg`;
  const contentType = asset.mimeType || 'image/jpeg';

  // Get file size
  let fileSize = asset.fileSize || 0;
  if (!fileSize && asset.uri) {
    try {
      const fileInfo = await FileSystem.getInfoAsync(asset.uri);
      if (fileInfo.exists && 'size' in fileInfo) {
        fileSize = fileInfo.size;
      }
    } catch (e) {
      console.warn('[PhotoService] Could not get file size:', e);
    }
  }

  return {
    uri: asset.uri,
    fileName,
    contentType,
    fileSize,
  };
}

/**
 * Pick a photo from the gallery
 */
export async function pickFromGallery(): Promise<PhotoPickerResult | null> {
  const hasPermission = await requestMediaLibraryPermissions();
  if (!hasPermission) {
    throw new Error('Media library permission denied');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 0.8,
    exif: false,
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return null;
  }

  const asset = result.assets[0];
  const fileName = asset.fileName || `photo_${Date.now()}.jpg`;
  const contentType = asset.mimeType || 'image/jpeg';

  let fileSize = asset.fileSize || 0;
  if (!fileSize && asset.uri) {
    try {
      const fileInfo = await FileSystem.getInfoAsync(asset.uri);
      if (fileInfo.exists && 'size' in fileInfo) {
        fileSize = fileInfo.size;
      }
    } catch (e) {
      console.warn('[PhotoService] Could not get file size:', e);
    }
  }

  return {
    uri: asset.uri,
    fileName,
    contentType,
    fileSize,
  };
}

/**
 * Save photo to local database and optionally create copies for batch audit devices
 */
export async function savePhotoLocally(
  photo: PhotoPickerResult,
  auditSessionId: string,
  auditSessionLocalId: string,
  deviceId: string,
  uploadedByUserId: string,
  allDeviceIds?: string[], // For batch audit
  description?: string
): Promise<AuditPhoto[]> {
  // Copy photo to app's document directory for persistence
  const persistentUri = await copyToDocuments(photo.uri, photo.fileName);
  
  if (allDeviceIds && allDeviceIds.length > 1) {
    // Batch audit - create photo records for all devices
    return createAuditPhotosForDevices(
      auditSessionId,
      auditSessionLocalId,
      allDeviceIds,
      persistentUri,
      photo.fileName,
      photo.contentType,
      photo.fileSize,
      uploadedByUserId,
      description
    );
  } else {
    // Single device
    const savedPhoto = await createAuditPhoto(
      auditSessionId,
      auditSessionLocalId,
      deviceId,
      persistentUri,
      photo.fileName,
      photo.contentType,
      photo.fileSize,
      uploadedByUserId,
      description
    );
    return [savedPhoto];
  }
}

/**
 * Copy photo to app's document directory for persistence
 */
async function copyToDocuments(uri: string, fileName: string): Promise<string> {
  const documentsDir = FileSystem.documentDirectory;
  if (!documentsDir) {
    throw new Error('Documents directory not available');
  }
  
  const photosDir = `${documentsDir}photos/`;
  
  // Ensure photos directory exists
  const dirInfo = await FileSystem.getInfoAsync(photosDir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(photosDir, { intermediates: true });
  }
  
  // Generate unique filename
  const timestamp = Date.now();
  const ext = fileName.split('.').pop() || 'jpg';
  const newFileName = `${timestamp}_${Math.random().toString(36).substring(7)}.${ext}`;
  const newUri = `${photosDir}${newFileName}`;
  
  await FileSystem.copyAsync({
    from: uri,
    to: newUri,
  });
  
  console.log(`[PhotoService] Copied photo to ${newUri}`);
  return newUri;
}

/**
 * Check if photo already exists on server
 */
async function checkPhotoExistsOnServer(
  projectId: string,
  sessionServerId: string,
  mobileLocalId: string
): Promise<string | null> {
  try {
    const response = await api.get(`/mobile/projects/${projectId}/photos/session/${sessionServerId}`);
    if (response.data.success && response.data.data) {
      const serverPhotos = response.data.data as Array<{ id: string; mobileLocalId?: string }>;
      // Check if any server photo has matching mobileLocalId
      for (const serverPhoto of serverPhotos) {
        if (serverPhoto.mobileLocalId?.startsWith(mobileLocalId)) {
          console.log(`[PhotoService] Photo ${mobileLocalId} already exists on server as ${serverPhoto.id}`);
          return serverPhoto.id;
        }
      }
    }
  } catch (e) {
    console.log(`[PhotoService] Could not check server photos:`, e);
  }
  return null;
}

/**
 * Upload a single photo to the server
 */
export async function uploadPhoto(
  photo: AuditPhoto,
  projectId: string,
  deviceIds?: string[]
): Promise<{ success: boolean; serverId?: string; error?: string }> {
  try {
    // Check if file exists
    const fileInfo = await FileSystem.getInfoAsync(photo.localUri);
    if (!fileInfo.exists) {
      console.error(`[PhotoService] Photo file not found: ${photo.localUri}`);
      return { success: false, error: 'File not found' };
    }

    // Get the audit session to find the server ID
    const { getAuditSessionByLocalId } = await import('../database/audits');
    const session = await getAuditSessionByLocalId(photo.auditSessionLocalId);
    
    if (!session) {
      console.error(`[PhotoService] Session not found for photo: ${photo.auditSessionLocalId}`);
      return { success: false, error: 'Audit session not found' };
    }
    
    // Need server ID of the session to upload photo
    if (!session.serverId) {
      console.error(`[PhotoService] Session ${session.localId} not synced yet, cannot upload photo`);
      return { success: false, error: 'Audit session not synced yet' };
    }
    
    // Check if photo already exists on server
    const existingServerId = await checkPhotoExistsOnServer(projectId, session.serverId, photo.localId);
    if (existingServerId) {
      console.log(`[PhotoService] Photo ${photo.localId} already on server, skipping upload`);
      return { success: true, serverId: existingServerId };
    }
    
    console.log(`[PhotoService] Uploading photo for session ${session.serverId}`);

    // Create form data
    const formData = new FormData();
    
    // Append file
    formData.append('Photo', {
      uri: Platform.OS === 'ios' ? photo.localUri.replace('file://', '') : photo.localUri,
      name: photo.fileName,
      type: photo.contentType,
    } as any);
    
    // Use server ID of the session!
    formData.append('AuditSessionId', session.serverId);
    
    if (deviceIds && deviceIds.length > 0) {
      formData.append('DeviceIds', deviceIds.join(','));
    } else {
      formData.append('DeviceIds', photo.deviceId);
    }
    
    if (photo.description) {
      formData.append('Description', photo.description);
    }
    
    formData.append('MobileLocalId', photo.localId);
    formData.append('CreatedOffline', 'true');

    const uploadUrl = `/mobile/projects/${projectId}/photos/upload`;
    console.log(`[PhotoService] Uploading to: ${uploadUrl}`);
    console.log(`[PhotoService] FormData: AuditSessionId=${session.serverId}, DeviceIds=${deviceIds?.join(',') || photo.deviceId}`);
    
    const response = await api.post(
      uploadUrl,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 60000, // 60 second timeout for uploads
      }
    );

    console.log(`[PhotoService] Response status: ${response.status}`, response.data);

    if (response.data.success && response.data.data?.photos?.length > 0) {
      const serverPhoto = response.data.data.photos[0];
      await markPhotoAsSynced(photo.localId, serverPhoto.id);
      console.log(`[PhotoService] Photo ${photo.localId} uploaded successfully`);
      return { success: true, serverId: serverPhoto.id };
    }

    return { success: false, error: response.data.message || 'Upload failed' };
  } catch (error: any) {
    // Log detailed error info
    if (error.response) {
      console.error(`[PhotoService] Server error ${error.response.status}:`, error.response.data);
      console.error(`[PhotoService] Request URL: ${error.config?.baseURL}${error.config?.url}`);
    } else if (error.request) {
      console.error(`[PhotoService] No response received:`, error.request);
    } else {
      console.error(`[PhotoService] Error setting up request:`, error.message);
    }
    
    await markPhotoUploadError(photo.localId);
    const errorMsg = error.response?.data?.message || error.message || 'Upload failed';
    return { success: false, error: errorMsg };
  }
}

/**
 * Upload all pending photos for a project
 */
export async function uploadPendingPhotos(
  projectId: string
): Promise<{ uploaded: number; failed: number; errors: string[] }> {
  const pendingPhotos = await getPhotosPendingUploadForProject(projectId);
  
  console.log(`[PhotoService] Found ${pendingPhotos.length} photos pending upload`);
  
  let uploaded = 0;
  let failed = 0;
  const errors: string[] = [];
  
  // Group photos by localUri to avoid duplicate uploads
  const photosByUri = new Map<string, AuditPhoto[]>();
  for (const photo of pendingPhotos) {
    const existing = photosByUri.get(photo.localUri) || [];
    existing.push(photo);
    photosByUri.set(photo.localUri, existing);
  }
  
  // Upload each unique photo once, with all device IDs
  for (const [localUri, photos] of photosByUri) {
    const mainPhoto = photos[0];
    const deviceIds = photos.map(p => p.deviceId);
    
    const result = await uploadPhoto(mainPhoto, projectId, deviceIds);
    
    if (result.success) {
      // Mark ALL photos with same localUri as synced (including mainPhoto)
      for (const photo of photos) {
        if (result.serverId) {
          await markPhotoAsSynced(photo.localId, result.serverId);
        }
      }
      uploaded += photos.length;
    } else {
      failed += photos.length;
      if (result.error) {
        errors.push(`${mainPhoto.fileName}: ${result.error}`);
      }
    }
  }
  
  return { uploaded, failed, errors };
}

/**
 * Delete local photo file
 */
export async function deleteLocalPhotoFile(localUri: string): Promise<void> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(localUri);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(localUri);
      console.log(`[PhotoService] Deleted local file: ${localUri}`);
    }
  } catch (e) {
    console.warn(`[PhotoService] Could not delete local file: ${localUri}`, e);
  }
}
