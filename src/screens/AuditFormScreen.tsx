// =============================================================================
// Audit Form Screen - Dynamic form with batch audit support
// Supports auditing multiple elements with same form (parallel mode)
// =============================================================================

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Alert, BackHandler, TouchableOpacity, Animated, Modal as RNModal, FlatList, TextInput, Image, Dimensions } from 'react-native';
import { Text, ActivityIndicator, Snackbar, Searchbar } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, typography, borderRadius, shadows, screen } from '../theme';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { SyncStatusBadge } from '../components/ui/SyncStatusBadge';
import { DynamicFormRenderer } from '../components/forms/DynamicFormRenderer';
import { FormFieldRenderer } from '../components/forms/FormFieldRenderer';
import { useAuditStore } from '../stores/auditStore';
import { useProjectStore } from '../stores/projectStore';
import { useAuthStore } from '../stores/authStore';
import { FormTab, AuditAnswer, Device } from '../types';
import { getExistingSessionForDevice, upsertAnswer, getPhotosBySession, AuditPhoto } from '../database';
import { takePhoto, pickFromGallery, savePhotoLocally, deleteLocalPhotoFile } from '../services/photoService';
import { deletePhoto as deletePhotoFromDb } from '../database/photos';

type RootStackParamList = {
  Devices: undefined;
  AuditForm: { deviceId: string; deviceIds?: string[]; sessionId?: string; preview?: boolean };
};

type AuditFormRouteProp = RouteProp<RootStackParamList, 'AuditForm'>;

interface TabProgress {
  total: number;
  answered: number;
  required: number;
  requiredAnswered: number;
  percentage: number;
  isComplete: boolean;
}

export function AuditFormScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<AuditFormRouteProp>();
  const insets = useSafeAreaInsets();
  const { deviceId, deviceIds, sessionId, preview: isPreviewMode = false } = route.params;
  
  // Batch audit state - elements can have same or different answers per field
  const allDeviceIds = deviceIds && deviceIds.length > 0 ? deviceIds : [deviceId];
  const isBatchAudit = allDeviceIds.length > 1;
  const [showElementsModal, setShowElementsModal] = useState(false);
  
  // Per-device answers for batch audit: Map<fieldId, Map<deviceId, value>>
  const [perDeviceAnswers, setPerDeviceAnswers] = useState<Map<string, Map<string, string | null>>>(new Map());
  const [showPerDeviceModal, setShowPerDeviceModal] = useState(false);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  
  // Copy from another audit state
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copySearchQuery, setCopySearchQuery] = useState('');
  const [copyFilterBuilding, setCopyFilterBuilding] = useState<string>('');
  const [copyFilterLevel, setCopyFilterLevel] = useState<string>('');
  const [copyFilterZone, setCopyFilterZone] = useState<string>('');
  const [copyFilterType, setCopyFilterType] = useState<string>('');
  const [activeCopyFilterModal, setActiveCopyFilterModal] = useState<'building' | 'level' | 'zone' | 'type' | null>(null);
  const [copyFilterSearch, setCopyFilterSearch] = useState('');
  const [completedSessions, setCompletedSessions] = useState<Array<{
    session: import('../types').AuditSession;
    device: Device | null;
    answersCount: number;
  }>>([]);
  const [isCopying, setIsCopying] = useState(false);
  
  const { user } = useAuthStore();
  const { currentProject, devices } = useProjectStore();
  
  const {
    currentSession,
    currentDevice,
    formConfig,
    currentTabIndex,
    answers,
    isLoading,
    isSaving,
    error,
    startAudit,
    startBatchAudit,
    resumeAudit,
    setCurrentTab,
    saveAnswer,
    completeAudit,
    clearError,
  } = useAuditStore();
  
  const { uploadProjectData, isOnline, isUploading } = useProjectStore();

  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [showValidation, setShowValidation] = useState(false);
  const [locationExpanded, setLocationExpanded] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  
  // Photo state
  const [photos, setPhotos] = useState<AuditPhoto[]>([]);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [isAddingPhoto, setIsAddingPhoto] = useState(false);
  const [showPhotosTab, setShowPhotosTab] = useState(false);

  // Safe navigation helper - checks if we can go back, otherwise resets to Devices screen
  const safeGoBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.reset({
        index: 0,
        routes: [{ name: 'Devices' }],
      });
    }
  }, [navigation]);

  // Handle back button
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (currentSession?.status === 'in_progress') {
          Alert.alert(
            'Audyt w toku',
            'Dane są zapisane lokalnie. Możesz wrócić i kontynuować później.',
            [
              { text: 'Kontynuuj audyt', style: 'cancel' },
              { text: 'Wyjdź', onPress: safeGoBack }
            ]
          );
          return true;
        }
        return false;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [currentSession?.status, safeGoBack])
  );

  // Start or resume audit
  // If sessionId is provided (viewing existing audit), resume it
  // For batch audit: start sessions for ALL devices immediately
  // For single audit: start session for that device
  useEffect(() => {
    if (sessionId) {
      // Resume existing audit session (e.g., viewing completed audit)
      resumeAudit(sessionId);
    } else if (currentProject && user && allDeviceIds.length > 0) {
      if (isBatchAudit) {
        // Batch audit - create sessions for ALL devices
        startBatchAudit(allDeviceIds, currentProject.id, user.id);
      } else {
        // Single device audit
        startAudit(allDeviceIds[0], currentProject.id, user.id);
      }
    }
  }, [currentProject?.id, user?.id, allDeviceIds.length, sessionId, isBatchAudit]);

  // For batch audit: Load existing answers from in-progress sessions and detect differences
  useEffect(() => {
    if (!isBatchAudit || !formConfig || !currentProject || !user) return;
    
    const loadExistingAnswers = async () => {
      const { getAnswersForDevice } = await import('../database/audits');
      const newPerDeviceAnswers = new Map<string, Map<string, string | null>>();
      
      // Load answers for each device
      for (const devId of allDeviceIds) {
        try {
          const deviceAnswers = await getAnswersForDevice(devId);
          if (deviceAnswers && deviceAnswers.size > 0) {
            for (const [fieldId, answer] of deviceAnswers) {
              if (!newPerDeviceAnswers.has(fieldId)) {
                newPerDeviceAnswers.set(fieldId, new Map());
              }
              newPerDeviceAnswers.get(fieldId)!.set(devId, answer.valueText ?? null);
            }
          }
        } catch (e) {
          console.log(`[AuditForm] No existing answers for device ${devId}`);
        }
      }
      
      // For each field that has answers, fill missing devices with the main form's answer
      // This ensures proper comparison when checking for varied answers
      for (const [fieldId, deviceMap] of newPerDeviceAnswers) {
        // Find a non-null value to use as default, or use first device's value
        const existingValues = Array.from(deviceMap.values()).filter(v => v !== null);
        const defaultValue = existingValues[0] ?? null;
        
        for (const devId of allDeviceIds) {
          if (!deviceMap.has(devId)) {
            deviceMap.set(devId, defaultValue);
          }
        }
      }
      
      if (newPerDeviceAnswers.size > 0) {
        setPerDeviceAnswers(newPerDeviceAnswers);
        console.log(`[AuditForm] Loaded existing answers for ${newPerDeviceAnswers.size} fields`);
      }
    };
    
    loadExistingAnswers();
  }, [isBatchAudit, formConfig, currentProject?.id, user?.id, allDeviceIds]);

  // Load photos for current session
  useEffect(() => {
    if (currentSession?.id) {
      loadPhotos();
    }
  }, [currentSession?.id]);

  const loadPhotos = async () => {
    if (!currentSession?.id) return;
    try {
      const sessionPhotos = await getPhotosBySession(currentSession.id);
      setPhotos(sessionPhotos);
    } catch (e) {
      console.error('[AuditForm] Error loading photos:', e);
    }
  };

  // Handle adding photo (camera or gallery)
  const handleAddPhoto = useCallback(async (source: 'camera' | 'gallery') => {
    if (!currentSession || !currentDevice || !user || isPreviewMode) return;
    
    setIsAddingPhoto(true);
    try {
      const photo = source === 'camera' ? await takePhoto() : await pickFromGallery();
      
      if (photo) {
        const savedPhotos = await savePhotoLocally(
          photo,
          currentSession.id,
          currentSession.localId,
          currentDevice.id,
          user.id,
          isBatchAudit ? allDeviceIds : undefined
        );
        
        setPhotos(prev => [...savedPhotos, ...prev]);
        setSnackbarMessage(`Dodano ${savedPhotos.length} zdjęć`);
        setSnackbarVisible(true);
      }
    } catch (error: any) {
      Alert.alert('Błąd', error.message || 'Nie udało się dodać zdjęcia');
    } finally {
      setIsAddingPhoto(false);
    }
  }, [currentSession, currentDevice, user, isBatchAudit, allDeviceIds, isPreviewMode]);

  // Handle deleting photo
  const handleDeletePhoto = useCallback(async (photo: AuditPhoto) => {
    Alert.alert(
      'Usuń zdjęcie',
      'Czy na pewno chcesz usunąć to zdjęcie?',
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'Usuń',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePhotoFromDb(photo.localId);
              await deleteLocalPhotoFile(photo.localUri);
              setPhotos(prev => prev.filter(p => p.localId !== photo.localId));
              setSnackbarMessage('Zdjęcie usunięte');
              setSnackbarVisible(true);
              if (photos.length <= 1) {
                setShowPhotoModal(false);
              }
            } catch (e) {
              console.error('[AuditForm] Error deleting photo:', e);
            }
          }
        }
      ]
    );
  }, [photos.length]);

  // Show photo action sheet
  const showPhotoOptions = useCallback(() => {
    if (isPreviewMode) {
      if (photos.length > 0) {
        setSelectedPhotoIndex(0);
        setShowPhotoModal(true);
      }
      return;
    }
    
    Alert.alert(
      'Dodaj zdjęcie',
      'Wybierz źródło zdjęcia',
      [
        { text: 'Aparat', onPress: () => handleAddPhoto('camera') },
        { text: 'Galeria', onPress: () => handleAddPhoto('gallery') },
        ...(photos.length > 0 ? [{ text: 'Przeglądaj zdjęcia', onPress: () => { setSelectedPhotoIndex(0); setShowPhotoModal(true); } }] : []),
        { text: 'Anuluj', style: 'cancel' as const }
      ]
    );
  }, [isPreviewMode, photos.length, handleAddPhoto]);

  // Calculate tab progress
  const tabsProgress = useMemo((): Map<string, TabProgress> => {
    const progressMap = new Map<string, TabProgress>();
    
    if (!formConfig) return progressMap;

    for (const tab of formConfig.tabs) {
      const tabFields = formConfig.fields.filter(
        f => f.formTabId === tab.id || f.tabNumber === tab.tabNumber
      );
      
      const total = tabFields.length;
      const answered = tabFields.filter(f => {
        const answer = answers.get(f.id);
        return answer?.valueText !== undefined && answer.valueText !== null && answer.valueText !== '';
      }).length;
      const required = tabFields.filter(f => f.isRequired).length;
      const requiredAnswered = tabFields.filter(f => {
        if (!f.isRequired) return false;
        const answer = answers.get(f.id);
        return answer?.valueText !== undefined && answer.valueText !== null && answer.valueText !== '';
      }).length;

      progressMap.set(tab.id, {
        total,
        answered,
        required,
        requiredAnswered,
        percentage: total > 0 ? answered / total : 0,
        isComplete: answered === total && requiredAnswered === required,
      });
    }

    return progressMap;
  }, [formConfig, answers]);

  // Overall progress
  const overallProgress = useMemo(() => {
    if (!formConfig) return { answered: 0, total: 0, required: 0, requiredAnswered: 0 };
    
    const total = formConfig.fields.length;
    const answered = formConfig.fields.filter(f => {
      const answer = answers.get(f.id);
      return answer?.valueText !== undefined && answer.valueText !== null && answer.valueText !== '';
    }).length;
    const required = formConfig.fields.filter(f => f.isRequired).length;
    const requiredAnswered = formConfig.fields.filter(f => {
      if (!f.isRequired) return false;
      const answer = answers.get(f.id);
      return answer?.valueText !== undefined && answer.valueText !== null && answer.valueText !== '';
    }).length;

    return { answered, total, required, requiredAnswered };
  }, [formConfig, answers]);

  // Save answer - for batch audit, track if answers differ per device
  const handleSaveAnswer = useCallback(async (
    fieldId: string,
    value: string | null,
    logicalDataColumnNumber?: number
  ) => {
    // Save to main answers (first device / default)
    await saveAnswer(fieldId, value, logicalDataColumnNumber);
    
    // For batch audit: always update per-device answers AND save to all device sessions
    if (isBatchAudit && value !== null && user?.id) {
      console.log(`[AuditForm] handleSaveAnswer batch: fieldId=${fieldId}, value=${value}, allDeviceIds=`, allDeviceIds);
      
      // Determine which devices should get this value
      const devicesToUpdate: string[] = [];
      
      setPerDeviceAnswers(prev => {
        const newMap = new Map(prev);
        const existingDeviceMap = newMap.get(fieldId);
        
        if (!existingDeviceMap) {
          // First time setting this field - set same value for all devices
          const deviceMap = new Map<string, string | null>();
          allDeviceIds.forEach(devId => {
            console.log(`[AuditForm] Init perDevice: devId=${devId}, value=${value}`);
            deviceMap.set(devId, value);
            devicesToUpdate.push(devId);
          });
          newMap.set(fieldId, deviceMap);
        } else {
          // Field already exists - check if all values are the same (not customized)
          const values = Array.from(existingDeviceMap.values());
          const allSame = values.every(v => v === values[0]);
          
          if (allSame) {
            // All devices have same value - update all to new value
            allDeviceIds.forEach(devId => {
              existingDeviceMap.set(devId, value);
              devicesToUpdate.push(devId);
            });
            console.log(`[AuditForm] Updated all devices to ${value}`);
          } else {
            console.log(`[AuditForm] Not updating - values are different (customized)`);
          }
        }
        return newMap;
      });
      
      // Save to ALL device sessions (not just the first one)
      // Skip first device since saveAnswer already saved it
      for (let i = 1; i < allDeviceIds.length; i++) {
        const devId = allDeviceIds[i];
        try {
          const session = await getExistingSessionForDevice(devId);
          if (session) {
            console.log(`[AuditForm] Saving to device ${i+1}/${allDeviceIds.length}: session=${session.localId}`);
            await upsertAnswer(
              session.id,
              session.localId,
              devId,
              fieldId,
              user.id,
              value,
              logicalDataColumnNumber,
              undefined
            );
          }
        } catch (error) {
          console.error(`[AuditForm] Error saving to device ${devId}:`, error);
        }
      }
    }
  }, [saveAnswer, isBatchAudit, allDeviceIds, user?.id]);

  // Check if a field has different answers across devices
  const hasVariedAnswers = useCallback((fieldId: string): boolean => {
    if (!isBatchAudit) return false;
    const deviceMap = perDeviceAnswers.get(fieldId);
    if (!deviceMap || deviceMap.size === 0) return false;
    
    const values = Array.from(deviceMap.values());
    const firstValue = values[0];
    return values.some(v => v !== firstValue);
  }, [isBatchAudit, perDeviceAnswers]);

  // Get per-device answer for a field
  const getPerDeviceAnswer = useCallback((fieldId: string, deviceId: string): string | null => {
    const deviceMap = perDeviceAnswers.get(fieldId);
    if (!deviceMap) {
      // Return main answer as default
      return answers.get(fieldId)?.valueText ?? null;
    }
    return deviceMap.get(deviceId) ?? answers.get(fieldId)?.valueText ?? null;
  }, [perDeviceAnswers, answers]);

  // Set answer for specific device (called from per-device modal)
  // Now also saves immediately to the database!
  const setDeviceAnswer = useCallback(async (fieldId: string, deviceId: string, value: string | null) => {
    console.log(`[AuditForm] setDeviceAnswer: fieldId=${fieldId}, deviceId=${deviceId}, value=${value}`);
    console.log(`[AuditForm] allDeviceIds:`, allDeviceIds);
    
    // Update React state
    setPerDeviceAnswers(prev => {
      const newMap = new Map(prev);
      let deviceMap = newMap.get(fieldId);
      
      if (!deviceMap) {
        // Initialize all devices with current main answer first
        deviceMap = new Map<string, string | null>();
        const mainValue = answers.get(fieldId)?.valueText ?? null;
        console.log(`[AuditForm] Initializing deviceMap for field ${fieldId}, mainValue=${mainValue}`);
        allDeviceIds.forEach(devId => {
          console.log(`[AuditForm] Setting devId=${devId} to mainValue=${mainValue}`);
          deviceMap!.set(devId, mainValue);
        });
        newMap.set(fieldId, deviceMap);
      }
      
      // Now set the specific device's value
      const updatedDeviceMap = new Map(deviceMap);
      updatedDeviceMap.set(deviceId, value);
      newMap.set(fieldId, updatedDeviceMap);
      
      console.log(`[AuditForm] Updated deviceMap for field ${fieldId}:`, Object.fromEntries(updatedDeviceMap));
      
      return newMap;
    });
    
    // IMMEDIATELY save to database for this specific device's session
    // Save even if value is null (user cleared the answer) - use empty string
    if (user?.id) {
      try {
        const session = await getExistingSessionForDevice(deviceId);
        if (session) {
          const field = formConfig?.fields.find(f => f.id === fieldId);
          const valueToSave = value ?? ''; // Convert null to empty string for DB
          console.log(`[AuditForm] Saving per-device answer to DB: session=${session.localId}, value=${valueToSave}`);
          await upsertAnswer(
            session.id,
            session.localId,
            deviceId,
            fieldId,
            user.id,
            valueToSave,
            field?.logicalDataColumnNumber,
            undefined
          );
          console.log(`[AuditForm] Per-device answer saved to DB successfully`);
        } else {
          console.warn(`[AuditForm] No session found for device ${deviceId}, answer not saved to DB yet`);
        }
      } catch (error) {
        console.error(`[AuditForm] Error saving per-device answer to DB:`, error);
      }
    }
  }, [answers, allDeviceIds, user?.id, formConfig?.fields]);

  // Open per-device editor for a field
  const openPerDeviceEditor = useCallback((fieldId: string) => {
    // Always ensure the field is initialized with current values
    setPerDeviceAnswers(prev => {
      if (prev.has(fieldId)) {
        // Field exists - ensure all devices are present
        const existingMap = prev.get(fieldId)!;
        const mainValue = answers.get(fieldId)?.valueText ?? null;
        let hasNewDevices = false;
        
        allDeviceIds.forEach(devId => {
          if (!existingMap.has(devId)) {
            existingMap.set(devId, mainValue);
            hasNewDevices = true;
          }
        });
        
        if (hasNewDevices) {
          return new Map(prev).set(fieldId, new Map(existingMap));
        }
        return prev;
      } else {
        // Field doesn't exist - initialize all devices with main answer
        const deviceMap = new Map<string, string | null>();
        const mainValue = answers.get(fieldId)?.valueText ?? null;
        allDeviceIds.forEach(devId => deviceMap.set(devId, mainValue));
        return new Map(prev).set(fieldId, deviceMap);
      }
    });
    
    setEditingFieldId(fieldId);
    setShowPerDeviceModal(true);
  }, [answers, allDeviceIds]);

  // Load sessions for copy modal (includes batch audit devices)
  const loadCompletedSessions = useCallback(async () => {
    if (!currentProject) return;
    
    try {
      const { getAllSessionsForProject, getDevice, getAnswersMap } = await import('../database');
      const sessions = await getAllSessionsForProject(currentProject.id);
      
      // Load device info and answer count for each session
      const sessionsWithDevices = await Promise.all(
        sessions.map(async (session) => {
          const device = await getDevice(session.deviceId);
          const answersMap = await getAnswersMap(session.localId);
          return { session, device, answersCount: answersMap.size };
        })
      );
      
      // Filter out ONLY the current device (not all batch devices)
      // This allows copying between devices in the same batch audit
      const currentDeviceId = currentDevice?.id;
      const filtered = sessionsWithDevices.filter(
        ({ session }) => session.deviceId !== currentDeviceId
      );
      
      setCompletedSessions(filtered);
    } catch (error) {
      console.error('Error loading sessions:', error);
    }
  }, [currentProject, currentDevice?.id]);

  // Clear all copy filters
  const clearCopyFilters = useCallback(() => {
    setCopySearchQuery('');
    setCopyFilterBuilding('');
    setCopyFilterLevel('');
    setCopyFilterZone('');
    setCopyFilterType('');
  }, []);

  // Open copy modal
  const openCopyModal = useCallback(() => {
    clearCopyFilters();
    loadCompletedSessions();
    setShowCopyModal(true);
  }, [loadCompletedSessions, clearCopyFilters]);

  // Get filter options from completed sessions
  const copyFilterOptions = useMemo(() => {
    const buildings = new Set<string>();
    const levels = new Set<string>();
    const zones = new Set<string>();
    const types = new Set<string>();
    
    completedSessions.forEach(({ device }) => {
      if (device?.building) buildings.add(device.building);
      if (device?.level) levels.add(device.level);
      if (device?.zone) zones.add(device.zone);
      if (device?.type) types.add(device.type);
    });
    
    return {
      buildings: Array.from(buildings).sort(),
      levels: Array.from(levels).sort(),
      zones: Array.from(zones).sort(),
      types: Array.from(types).sort(),
    };
  }, [completedSessions]);

  // Check if any copy filter is active
  const hasCopyFilters = copySearchQuery || copyFilterBuilding || copyFilterLevel || copyFilterZone || copyFilterType;

  // Copy answers from selected session
  const copyFromSession = useCallback(async (sessionLocalId: string) => {
    setIsCopying(true);
    try {
      const { getAnswersMap: getSessionAnswers } = await import('../database');
      const sourceAnswers = await getSessionAnswers(sessionLocalId);
      
      if (!sourceAnswers || sourceAnswers.size === 0) {
        Alert.alert('Błąd', 'Brak odpowiedzi do skopiowania.');
        return;
      }

      // Copy each answer to current session
      let copiedCount = 0;
      for (const [fieldId, answer] of sourceAnswers) {
        if (answer.valueText !== null && answer.valueText !== undefined) {
          await saveAnswer(fieldId, answer.valueText, answer.logicalDataColumnNumber);
          copiedCount++;
          
          // For batch audit, also update perDeviceAnswers
          if (isBatchAudit) {
            setPerDeviceAnswers(prev => {
              const newMap = new Map(prev);
              const deviceMap = new Map<string, string | null>();
              allDeviceIds.forEach(devId => deviceMap.set(devId, answer.valueText ?? null));
              newMap.set(fieldId, deviceMap);
              return newMap;
            });
          }
        }
      }

      setShowCopyModal(false);
      Alert.alert(
        'Skopiowano',
        `Skopiowano ${copiedCount} odpowiedzi z wybranego audytu.`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error copying answers:', error);
      Alert.alert('Błąd', 'Nie udało się skopiować odpowiedzi.');
    } finally {
      setIsCopying(false);
    }
  }, [saveAnswer, isBatchAudit, allDeviceIds]);

  // Filter sessions by search query and filters
  const filteredSessions = useMemo(() => {
    return completedSessions.filter(({ device }) => {
      if (!device) return false;
      
      // Text search
      if (copySearchQuery.trim()) {
        const query = copySearchQuery.toLowerCase();
        const matchesSearch = (
          device.name?.toLowerCase().includes(query) ||
          device.elementId?.toLowerCase().includes(query) ||
          device.building?.toLowerCase().includes(query) ||
          device.level?.toLowerCase().includes(query) ||
          device.zone?.toLowerCase().includes(query) ||
          device.type?.toLowerCase().includes(query)
        );
        if (!matchesSearch) return false;
      }
      
      // Building filter
      if (copyFilterBuilding && device.building !== copyFilterBuilding) return false;
      
      // Level filter
      if (copyFilterLevel && device.level !== copyFilterLevel) return false;
      
      // Zone filter
      if (copyFilterZone && device.zone !== copyFilterZone) return false;
      
      // Type filter
      if (copyFilterType && device.type !== copyFilterType) return false;
      
      return true;
    });
  }, [completedSessions, copySearchQuery, copyFilterBuilding, copyFilterLevel, copyFilterZone, copyFilterType]);

  const handleBack = () => {
    if (currentSession?.status === 'in_progress') {
      Alert.alert(
        'Audyt w toku',
        'Dane są zapisane lokalnie. Możesz wrócić i kontynuować później.',
        [
          { text: 'Kontynuuj audyt', style: 'cancel' },
          { text: 'Wyjdź', onPress: safeGoBack }
        ]
      );
    } else {
      safeGoBack();
    }
  };

  // Get devices info for display
  const selectedDevicesInfo = useMemo(() => {
    return allDeviceIds.map(id => devices.find(d => d.id === id)).filter(Boolean) as Device[];
  }, [allDeviceIds, devices]);

  // Count fields with varied answers
  const variedAnswersCount = useMemo(() => {
    if (!isBatchAudit) return 0;
    let count = 0;
    for (const [fieldId] of perDeviceAnswers) {
      if (hasVariedAnswers(fieldId)) count++;
    }
    return count;
  }, [isBatchAudit, perDeviceAnswers, hasVariedAnswers]);

  // Complete ALL devices with their respective answers (batch mode)
  const handleCompleteAllDevices = async () => {
    // Check if required fields are filled
    const missingRequired = formConfig?.fields.filter(f => {
      if (!f.isRequired) return false;
      const answer = answers.get(f.id);
      return !answer || !answer.valueText;
    });

    if (missingRequired && missingRequired.length > 0) {
      setShowValidation(true);
      Alert.alert(
        'Brakujące pola',
        `Wypełnij wymagane pola przed zakończeniem (${missingRequired.length} pozostało).`,
        [{ text: 'OK' }]
      );
      return;
    }

    const hasVaried = variedAnswersCount > 0;
    const confirmMessage = isBatchAudit
      ? hasVaried
        ? `Zakończyć audyt dla ${allDeviceIds.length} elementów?\n\n${variedAnswersCount} ${variedAnswersCount === 1 ? 'pytanie ma' : 'pytań ma'} różne odpowiedzi dla poszczególnych elementów.`
        : `Zakończyć audyt dla ${allDeviceIds.length} elementów? Te same odpowiedzi zostaną zapisane dla każdego z nich.`
      : 'Czy na pewno chcesz zakończyć audyt?';

    Alert.alert(
      'Zakończ audyt',
      confirmMessage,
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'Zakończ',
          onPress: async () => {
            setIsCompleting(true);
            try {
              if (isBatchAudit) {
                // For batch audit, complete with per-device answers
                console.log('[AuditForm] Completing batch audit');
                console.log('[AuditForm] allDeviceIds:', allDeviceIds);
                console.log('[AuditForm] answers size:', answers.size);
                console.log('[AuditForm] perDeviceAnswers size:', perDeviceAnswers.size);
                
                // Log per-device answers content
                perDeviceAnswers.forEach((deviceMap, fieldId) => {
                  console.log(`[AuditForm] perDeviceAnswers[${fieldId}]:`, Object.fromEntries(deviceMap));
                });
                
                const { completeAuditForMultipleDevicesWithVariedAnswers } = useAuditStore.getState();
                const completed = await completeAuditForMultipleDevicesWithVariedAnswers(
                  allDeviceIds,
                  currentProject!.id,
                  user!.id,
                  answers,
                  perDeviceAnswers
                );
                
                if (!completed) {
                  throw new Error('Nie udało się zakończyć audytów');
                }
              } else {
                // Single device - complete normally
                const completed = await completeAudit();
                if (!completed) {
                  throw new Error('Nie udało się zakończyć audytu');
                }
              }

              // Upload if online
              if (isOnline) {
                const uploaded = await uploadProjectData();
                if (uploaded) {
                  setSnackbarMessage(
                    isBatchAudit 
                      ? `Zakończono ${allDeviceIds.length} audytów. Synchronizacja zakończona.`
                      : 'Audyt zakończony. Synchronizacja zakończona.'
                  );
                } else {
                  setSnackbarMessage('Audyt zakończony. Synchronizacja nie powiodła się - spróbuj później.');
                }
              } else {
                setSnackbarMessage('Audyt zakończony. Wyślij gdy będziesz online.');
              }
              setSnackbarVisible(true);

              setTimeout(safeGoBack, 1500);
            } catch (error) {
              Alert.alert('Błąd', error instanceof Error ? error.message : 'Wystąpił błąd');
            } finally {
              setIsCompleting(false);
            }
          }
        }
      ]
    );
  };

  // Get device info for display
  const getDeviceInfo = (id: string) => {
    return devices.find(d => d.id === id);
  };

  if (isLoading || !formConfig || !currentDevice || !currentSession) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Ładowanie formularza...</Text>
      </View>
    );
  }

  const currentTab = formConfig.tabs[currentTabIndex];
  const currentFields = formConfig.fields.filter(
    f => f.formTabId === currentTab?.id || f.tabNumber === currentTab?.tabNumber
  );
  const currentTabProgress = currentTab ? tabsProgress.get(currentTab.id) : null;

  return (
    <View style={styles.container}>
      {/* Elements Modal for batch audit */}
      <RNModal
        visible={showElementsModal}
        onRequestClose={() => setShowElementsModal(false)}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={[styles.elementsModal, { paddingTop: insets.top }]}>
          <View style={styles.elementsModalHeader}>
            <View style={styles.elementsModalHeaderLeft}>
              <Icon name="checkbox-multiple-marked" size={28} color={colors.primary} />
              <Text style={styles.elementsModalTitle}>
                {allDeviceIds.length} {allDeviceIds.length === 1 ? 'element' : allDeviceIds.length < 5 ? 'elementy' : 'elementów'}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setShowElementsModal(false)} style={styles.elementsModalClose}>
              <Icon name="close" size={28} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.elementsModalSubtitle}>
            {variedAnswersCount > 0 
              ? `${variedAnswersCount} ${variedAnswersCount === 1 ? 'pytanie ma' : 'pytań ma'} różne odpowiedzi`
              : 'Te same odpowiedzi zostaną zapisane dla każdego elementu'
            }
          </Text>

          <FlatList
            data={selectedDevicesInfo}
            keyExtractor={(item) => item.id}
            style={styles.elementsModalList}
            contentContainerStyle={styles.elementsModalListContent}
            renderItem={({ item, index }) => (
              <View style={styles.elementsModalItem}>
                <View style={styles.elementsModalItemNumber}>
                  <Text style={styles.elementsModalItemNumberText}>{index + 1}</Text>
                </View>
                <View style={styles.elementsModalItemContent}>
                  <Text style={styles.elementsModalItemName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.elementsModalItemMeta}>
                    {item.elementId} • {item.building || '-'} • {item.level || '-'}
                  </Text>
                </View>
              </View>
            )}
          />

          <View style={[styles.elementsModalFooter, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
            <TouchableOpacity style={styles.elementsModalDone} onPress={() => setShowElementsModal(false)}>
              <Text style={styles.elementsModalDoneText}>Zamknij</Text>
            </TouchableOpacity>
          </View>
        </View>
      </RNModal>

      {/* Per-Device Answers Modal */}
      {isBatchAudit && editingFieldId && (
        <RNModal
          visible={showPerDeviceModal}
          onRequestClose={() => setShowPerDeviceModal(false)}
          animationType="slide"
          presentationStyle="pageSheet"
        >
          <View style={[styles.perDeviceModal, { paddingTop: insets.top }]}>
            <View style={styles.perDeviceModalHeader}>
              <View style={styles.perDeviceModalHeaderLeft}>
                <Icon name="tune-variant" size={28} color={colors.primary} />
                <Text style={styles.perDeviceModalTitle}>Odpowiedzi per element</Text>
              </View>
              <TouchableOpacity onPress={() => setShowPerDeviceModal(false)} style={styles.perDeviceModalClose}>
                <Icon name="close" size={28} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.perDeviceModalSubtitle}>
              {formConfig?.fields.find(f => f.id === editingFieldId)?.label || 'Pytanie'}
            </Text>

            <ScrollView style={styles.perDeviceModalList} contentContainerStyle={styles.perDeviceModalListContent}>
              {(() => {
                const field = formConfig?.fields.find(f => f.id === editingFieldId);
                const options = field?.optionSetId 
                  ? formConfig?.optionValues.get(field.optionSetId) || []
                  : [];
                
                return selectedDevicesInfo.map((device, index) => {
                  const currentValue = getPerDeviceAnswer(editingFieldId, device.id);
                  
                  return (
                    <View key={device.id} style={styles.perDeviceModalItem}>
                      {/* Device header */}
                      <View style={styles.perDeviceModalItemHeader}>
                        <View style={styles.perDeviceModalItemNumber}>
                          <Text style={styles.perDeviceModalItemNumberText}>{index + 1}</Text>
                        </View>
                        <View style={styles.perDeviceModalItemInfo}>
                          <Text style={styles.perDeviceModalItemName} numberOfLines={1}>{device.name}</Text>
                          <Text style={styles.perDeviceModalItemMeta}>{device.elementId}</Text>
                        </View>
                      </View>
                      
                      {/* Full form field - same as main form */}
                      {field && (
                        <View style={styles.perDeviceModalItemField}>
                          <FormFieldRenderer
                            field={field}
                            options={options}
                            value={currentValue}
                            onChange={(value) => setDeviceAnswer(editingFieldId, device.id, value)}
                            showValidation={false}
                          />
                        </View>
                      )}
                    </View>
                  );
                });
              })()}
            </ScrollView>

            <View style={[styles.perDeviceModalFooter, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
              <TouchableOpacity 
                style={styles.perDeviceModalSetAll}
                onPress={() => {
                  // Set all to first device's value and update main form
                  const firstValue = getPerDeviceAnswer(editingFieldId, allDeviceIds[0]);
                  setPerDeviceAnswers(prev => {
                    const newMap = new Map(prev);
                    const deviceMap = new Map<string, string | null>();
                    allDeviceIds.forEach(devId => deviceMap.set(devId, firstValue));
                    newMap.set(editingFieldId, deviceMap);
                    return newMap;
                  });
                  // Also update main answers store
                  const field = formConfig?.fields.find(f => f.id === editingFieldId);
                  saveAnswer(editingFieldId, firstValue, field?.logicalDataColumnNumber);
                }}
              >
                <Icon name="content-copy" size={20} color={colors.primary} />
                <Text style={styles.perDeviceModalSetAllText}>Ustaw wszystkie takie same</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.perDeviceModalDone} 
                onPress={() => {
                  // When closing modal, if all values are same, sync to main answer
                  if (editingFieldId) {
                    const deviceMap = perDeviceAnswers.get(editingFieldId);
                    if (deviceMap) {
                      const values = Array.from(deviceMap.values());
                      const allSame = values.every(v => v === values[0]);
                      if (allSame && values[0] !== undefined) {
                        const field = formConfig?.fields.find(f => f.id === editingFieldId);
                        saveAnswer(editingFieldId, values[0], field?.logicalDataColumnNumber);
                      }
                    }
                  }
                  setShowPerDeviceModal(false);
                }}
              >
                <Text style={styles.perDeviceModalDoneText}>Gotowe</Text>
              </TouchableOpacity>
            </View>
          </View>
        </RNModal>
      )}

      {/* Copy from another audit Modal */}
      <RNModal
        visible={showCopyModal}
        onRequestClose={() => setShowCopyModal(false)}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={[styles.copyModal, { paddingTop: insets.top }]}>
          {/* Header */}
          <View style={styles.copyModalHeader}>
            <View style={styles.copyModalHeaderLeft}>
              <Icon name="content-copy" size={28} color={colors.primary} />
              <Text style={styles.copyModalTitle}>Kopiuj z audytu</Text>
            </View>
            <TouchableOpacity onPress={() => setShowCopyModal(false)} style={styles.copyModalClose}>
              <Icon name="close" size={28} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Search bar - styled like DevicesScreen */}
          <View style={styles.copySearchContainer}>
            <View style={styles.copySearchIconContainer}>
              <Icon name="magnify" size={24} color={colors.primary} />
            </View>
            <TextInput
              style={styles.copySearchInput}
              placeholder="Szukaj po nazwie, ID lub znaczniku..."
              placeholderTextColor={colors.textDisabled}
              value={copySearchQuery}
              onChangeText={setCopySearchQuery}
            />
            {copySearchQuery.length > 0 && (
              <TouchableOpacity style={styles.copySearchClear} onPress={() => setCopySearchQuery('')}>
                <Icon name="close-circle" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Filters - full-width rows like DevicesScreen */}
          <View style={styles.copyFiltersContainer}>
            {/* Building filter */}
            {copyFilterOptions.buildings.length > 0 && (
              <TouchableOpacity 
                style={[styles.copyFilterRow, copyFilterBuilding && styles.copyFilterRowActive]}
                onPress={() => setActiveCopyFilterModal('building')}
                activeOpacity={0.7}
              >
                <View style={[styles.copyFilterIcon, copyFilterBuilding && styles.copyFilterIconActive]}>
                  <Icon name="office-building" size={22} color={copyFilterBuilding ? colors.primary : colors.textSecondary} />
                </View>
                <View style={styles.copyFilterContent}>
                  <Text style={styles.copyFilterLabel}>BUDYNEK</Text>
                  <Text style={[styles.copyFilterValue, copyFilterBuilding && styles.copyFilterValueActive]} numberOfLines={1}>
                    {copyFilterBuilding || 'Wszystkie'}
                  </Text>
                </View>
                <Icon name="chevron-right" size={20} color={colors.textDisabled} />
              </TouchableOpacity>
            )}

            {/* Level filter */}
            {copyFilterOptions.levels.length > 0 && (
              <TouchableOpacity 
                style={[styles.copyFilterRow, copyFilterLevel && styles.copyFilterRowActive]}
                onPress={() => setActiveCopyFilterModal('level')}
                activeOpacity={0.7}
              >
                <View style={[styles.copyFilterIcon, copyFilterLevel && styles.copyFilterIconActive]}>
                  <Icon name="layers" size={22} color={copyFilterLevel ? colors.primary : colors.textSecondary} />
                </View>
                <View style={styles.copyFilterContent}>
                  <Text style={styles.copyFilterLabel}>PIĘTRO</Text>
                  <Text style={[styles.copyFilterValue, copyFilterLevel && styles.copyFilterValueActive]} numberOfLines={1}>
                    {copyFilterLevel || 'Wszystkie'}
                  </Text>
                </View>
                <Icon name="chevron-right" size={20} color={colors.textDisabled} />
              </TouchableOpacity>
            )}

            {/* Zone filter */}
            {copyFilterOptions.zones.length > 0 && (
              <TouchableOpacity 
                style={[styles.copyFilterRow, copyFilterZone && styles.copyFilterRowActive]}
                onPress={() => setActiveCopyFilterModal('zone')}
                activeOpacity={0.7}
              >
                <View style={[styles.copyFilterIcon, copyFilterZone && styles.copyFilterIconActive]}>
                  <Icon name="map-marker-radius" size={22} color={copyFilterZone ? colors.primary : colors.textSecondary} />
                </View>
                <View style={styles.copyFilterContent}>
                  <Text style={styles.copyFilterLabel}>STREFA</Text>
                  <Text style={[styles.copyFilterValue, copyFilterZone && styles.copyFilterValueActive]} numberOfLines={1}>
                    {copyFilterZone || 'Wszystkie'}
                  </Text>
                </View>
                <Icon name="chevron-right" size={20} color={colors.textDisabled} />
              </TouchableOpacity>
            )}

            {/* Type filter */}
            {copyFilterOptions.types.length > 0 && (
              <TouchableOpacity 
                style={[styles.copyFilterRow, copyFilterType && styles.copyFilterRowActive]}
                onPress={() => setActiveCopyFilterModal('type')}
                activeOpacity={0.7}
              >
                <View style={[styles.copyFilterIcon, copyFilterType && styles.copyFilterIconActive]}>
                  <Icon name="tag" size={22} color={copyFilterType ? colors.primary : colors.textSecondary} />
                </View>
                <View style={styles.copyFilterContent}>
                  <Text style={styles.copyFilterLabel}>TYP</Text>
                  <Text style={[styles.copyFilterValue, copyFilterType && styles.copyFilterValueActive]} numberOfLines={1}>
                    {copyFilterType || 'Wszystkie'}
                  </Text>
                </View>
                <Icon name="chevron-right" size={20} color={colors.textDisabled} />
              </TouchableOpacity>
            )}
          </View>

          {/* Results count with clear filters */}
          <View style={styles.copyResultsRow}>
            <Text style={styles.copyResultsText}>
              {filteredSessions.length} z {completedSessions.length} elementów
            </Text>
            {hasCopyFilters && (
              <TouchableOpacity onPress={clearCopyFilters} style={styles.copyClearFiltersBtn}>
                <Icon name="filter-remove" size={18} color={colors.error} />
                <Text style={styles.copyClearFiltersText}>Wyczyść filtry</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* List */}
          {isCopying ? (
            <View style={styles.copyModalLoading}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.copyModalLoadingText}>Kopiowanie odpowiedzi...</Text>
            </View>
          ) : filteredSessions.length === 0 ? (
            <View style={styles.copyModalEmpty}>
              <Icon name="package-variant" size={64} color={colors.textDisabled} />
              <Text style={styles.copyModalEmptyTitle}>Brak elementów</Text>
              <Text style={styles.copyModalEmptyText}>
                {hasCopyFilters ? 'Zmień filtry aby zobaczyć wyniki' : 'Brak audytów z odpowiedziami'}
              </Text>
              {hasCopyFilters && (
                <TouchableOpacity onPress={clearCopyFilters} style={styles.copyModalEmptyClear}>
                  <Icon name="filter-remove" size={20} color={colors.primary} />
                  <Text style={styles.copyModalEmptyClearText}>Wyczyść filtry</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <FlatList
              data={filteredSessions}
              keyExtractor={(item) => item.session.localId}
              style={styles.copyModalList}
              contentContainerStyle={styles.copyModalListContent}
              renderItem={({ item }) => {
                const hasAnswers = item.answersCount > 0;
                return (
                  <TouchableOpacity 
                    style={[
                      styles.copyDeviceItem,
                      item.session.status === 'completed' && styles.copyDeviceItemCompleted,
                      !hasAnswers && styles.copyDeviceItemDisabled
                    ]}
                    onPress={() => {
                      if (!hasAnswers) {
                        Alert.alert('Brak odpowiedzi', 'To urządzenie nie ma jeszcze żadnych odpowiedzi do skopiowania.');
                        return;
                      }
                      Alert.alert(
                        'Kopiuj odpowiedzi',
                        `Skopiować ${item.answersCount} odpowiedzi z "${item.device?.name || 'Nieznane urządzenie'}"?\n\nIstniejące odpowiedzi zostaną nadpisane.`,
                        [
                          { text: 'Anuluj', style: 'cancel' },
                          { text: 'Kopiuj', onPress: () => copyFromSession(item.session.localId) }
                        ]
                      );
                    }}
                    activeOpacity={hasAnswers ? 0.7 : 1}
                  >
                    {/* Status indicator */}
                    <View style={[
                      styles.copyDeviceStatus,
                      item.session.status === 'completed' ? styles.copyDeviceStatusCompleted : styles.copyDeviceStatusInProgress,
                      !hasAnswers && styles.copyDeviceStatusEmpty
                    ]}>
                      <Icon 
                        name={!hasAnswers ? 'file-document-outline' : item.session.status === 'completed' ? 'check' : 'clock-outline'} 
                        size={16} 
                        color={!hasAnswers ? colors.textDisabled : item.session.status === 'completed' ? colors.success : colors.warning} 
                      />
                    </View>

                    {/* Device info */}
                    <View style={styles.copyDeviceInfo}>
                      <Text style={[styles.copyDeviceName, !hasAnswers && styles.copyDeviceNameDisabled]} numberOfLines={1}>
                        {item.device?.name || 'Nieznane'}
                      </Text>
                      <View style={styles.copyDeviceIdRow}>
                        <Text style={[styles.copyDeviceId, !hasAnswers && styles.copyDeviceIdDisabled]}>
                          {item.device?.elementId || '-'}
                        </Text>
                        {hasAnswers ? (
                          item.session.status === 'completed' ? (
                            <View style={styles.copyDeviceBadgeCompleted}>
                              <Text style={styles.copyDeviceBadgeText}>Zakończony</Text>
                            </View>
                          ) : (
                            <View style={styles.copyDeviceBadgeInProgress}>
                              <Text style={styles.copyDeviceBadgeTextInProgress}>W trakcie</Text>
                            </View>
                          )
                        ) : (
                          <View style={styles.copyDeviceBadgeEmpty}>
                            <Text style={styles.copyDeviceBadgeEmptyText}>Brak odpowiedzi</Text>
                          </View>
                        )}
                        {hasAnswers && (
                          <View style={styles.copyDeviceAnswersBadge}>
                            <Text style={styles.copyDeviceAnswersText}>{item.answersCount} odp.</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.copyDeviceTags}>
                        {item.device?.building && (
                          <View style={[styles.copyDeviceTag, !hasAnswers && styles.copyDeviceTagDisabled]}>
                            <Text style={[styles.copyDeviceTagText, !hasAnswers && styles.copyDeviceTagTextDisabled]}>{item.device.building}</Text>
                          </View>
                        )}
                        {item.device?.level && (
                          <View style={[styles.copyDeviceTag, !hasAnswers && styles.copyDeviceTagDisabled]}>
                            <Text style={[styles.copyDeviceTagText, !hasAnswers && styles.copyDeviceTagTextDisabled]}>{item.device.level}</Text>
                          </View>
                        )}
                        {item.device?.zone && (
                          <View style={[styles.copyDeviceTag, !hasAnswers && styles.copyDeviceTagDisabled]}>
                            <Text style={[styles.copyDeviceTagText, !hasAnswers && styles.copyDeviceTagTextDisabled]}>{item.device.zone}</Text>
                          </View>
                        )}
                        {item.device?.type && (
                          <View style={[styles.copyDeviceTag, !hasAnswers && styles.copyDeviceTagDisabled]}>
                            <Text style={[styles.copyDeviceTagText, !hasAnswers && styles.copyDeviceTagTextDisabled]}>{item.device.type}</Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Copy icon */}
                    <View style={styles.copyDeviceAction}>
                      <Icon name={hasAnswers ? "content-copy" : "file-hidden"} size={22} color={hasAnswers ? colors.primary : colors.textDisabled} />
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}

          {/* Footer */}
          <View style={[styles.copyModalFooter, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
            <TouchableOpacity style={styles.copyModalCancel} onPress={() => setShowCopyModal(false)}>
              <Text style={styles.copyModalCancelText}>Zamknij</Text>
            </TouchableOpacity>
          </View>

          {/* Copy Filter Modal - pageSheet like DevicesScreen */}
          <RNModal
            visible={activeCopyFilterModal !== null}
            onRequestClose={() => { setActiveCopyFilterModal(null); setCopyFilterSearch(''); }}
            animationType="slide"
            presentationStyle="pageSheet"
          >
            <View style={[styles.filterModalContainer, { paddingTop: insets.top }]}>
              {/* Header */}
              <View style={styles.filterModalHeader}>
                <View style={styles.filterModalHeaderLeft}>
                  <Icon 
                    name={
                      activeCopyFilterModal === 'building' ? 'office-building' :
                      activeCopyFilterModal === 'level' ? 'layers' :
                      activeCopyFilterModal === 'zone' ? 'map-marker-radius' : 'tag'
                    } 
                    size={28} 
                    color={colors.primary} 
                  />
                  <Text style={styles.filterModalTitle}>
                    {activeCopyFilterModal === 'building' ? 'Budynek' :
                     activeCopyFilterModal === 'level' ? 'Piętro' :
                     activeCopyFilterModal === 'zone' ? 'Strefa' : 'Typ'}
                  </Text>
                </View>
                <TouchableOpacity 
                  onPress={() => { setActiveCopyFilterModal(null); setCopyFilterSearch(''); }} 
                  style={styles.filterModalCloseBtn}
                >
                  <Icon name="close" size={28} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Search */}
              <View style={styles.filterModalSearchContainer}>
                <Icon name="magnify" size={24} color={colors.textSecondary} />
                <TextInput
                  style={styles.filterModalSearchInput}
                  placeholder={`Szukaj w ${
                    activeCopyFilterModal === 'building' ? 'budynek' :
                    activeCopyFilterModal === 'level' ? 'piętro' :
                    activeCopyFilterModal === 'zone' ? 'strefa' : 'typ'
                  }...`}
                  placeholderTextColor={colors.textDisabled}
                  value={copyFilterSearch}
                  onChangeText={setCopyFilterSearch}
                />
                {copyFilterSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setCopyFilterSearch('')}>
                    <Icon name="close-circle" size={24} color={colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Current selection and clear */}
              {((activeCopyFilterModal === 'building' && copyFilterBuilding) ||
                (activeCopyFilterModal === 'level' && copyFilterLevel) ||
                (activeCopyFilterModal === 'zone' && copyFilterZone) ||
                (activeCopyFilterModal === 'type' && copyFilterType)) && (
                <View style={styles.filterModalSelectedRow}>
                  <Text style={styles.filterModalSelectedText}>
                    Wybrano: {
                      activeCopyFilterModal === 'building' ? copyFilterBuilding :
                      activeCopyFilterModal === 'level' ? copyFilterLevel :
                      activeCopyFilterModal === 'zone' ? copyFilterZone : copyFilterType
                    }
                  </Text>
                  <TouchableOpacity onPress={() => {
                    if (activeCopyFilterModal === 'building') setCopyFilterBuilding('');
                    if (activeCopyFilterModal === 'level') setCopyFilterLevel('');
                    if (activeCopyFilterModal === 'zone') setCopyFilterZone('');
                    if (activeCopyFilterModal === 'type') setCopyFilterType('');
                  }}>
                    <Text style={styles.filterModalClearText}>Wyczyść</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Options list */}
              <FlatList
                data={(activeCopyFilterModal === 'building' ? copyFilterOptions.buildings :
                       activeCopyFilterModal === 'level' ? copyFilterOptions.levels :
                       activeCopyFilterModal === 'zone' ? copyFilterOptions.zones :
                       copyFilterOptions.types
                      ).filter(opt => !copyFilterSearch || opt.toLowerCase().includes(copyFilterSearch.toLowerCase()))}
                keyExtractor={(item) => item}
                style={styles.filterModalList}
                contentContainerStyle={styles.filterModalListContent}
                renderItem={({ item }) => {
                  const isSelected = 
                    (activeCopyFilterModal === 'building' && copyFilterBuilding === item) ||
                    (activeCopyFilterModal === 'level' && copyFilterLevel === item) ||
                    (activeCopyFilterModal === 'zone' && copyFilterZone === item) ||
                    (activeCopyFilterModal === 'type' && copyFilterType === item);
                  
                  return (
                    <TouchableOpacity 
                      style={[styles.filterModalOption, isSelected && styles.filterModalOptionSelected]}
                      onPress={() => {
                        if (activeCopyFilterModal === 'building') {
                          setCopyFilterBuilding(isSelected ? '' : item);
                        } else if (activeCopyFilterModal === 'level') {
                          setCopyFilterLevel(isSelected ? '' : item);
                        } else if (activeCopyFilterModal === 'zone') {
                          setCopyFilterZone(isSelected ? '' : item);
                        } else if (activeCopyFilterModal === 'type') {
                          setCopyFilterType(isSelected ? '' : item);
                        }
                        setActiveCopyFilterModal(null);
                        setCopyFilterSearch('');
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.filterModalCheckbox, isSelected && styles.filterModalCheckboxSelected]}>
                        {isSelected && <Icon name="check" size={18} color={colors.primaryForeground} />}
                      </View>
                      <Text style={[styles.filterModalOptionText, isSelected && styles.filterModalOptionTextSelected]}>
                        {item}
                      </Text>
                    </TouchableOpacity>
                  );
                }}
                ListEmptyComponent={
                  <View style={styles.filterModalEmptyContainer}>
                    <Icon name="magnify-close" size={48} color={colors.textDisabled} />
                    <Text style={styles.filterModalEmptyText}>
                      {copyFilterSearch ? 'Brak wyników wyszukiwania' : 'Brak dostępnych opcji'}
                    </Text>
                  </View>
                }
              />

              {/* Done button */}
              <View style={[styles.filterModalFooter, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
                <TouchableOpacity 
                  style={styles.filterModalDoneBtn} 
                  onPress={() => { setActiveCopyFilterModal(null); setCopyFilterSearch(''); }}
                >
                  <Text style={styles.filterModalDoneBtnText}>Gotowe</Text>
                </TouchableOpacity>
              </View>
            </View>
          </RNModal>
        </View>
      </RNModal>

      {/* Photo Gallery Modal */}
      <RNModal
        visible={showPhotoModal}
        onRequestClose={() => setShowPhotoModal(false)}
        animationType="fade"
        transparent={true}
      >
        <View style={styles.photoModalOverlay}>
          <View style={[styles.photoModalContent, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
            {/* Header */}
            <View style={styles.photoModalHeader}>
              <Text style={styles.photoModalTitle}>
                Zdjęcia ({selectedPhotoIndex + 1}/{photos.length})
              </Text>
              <TouchableOpacity 
                onPress={() => setShowPhotoModal(false)}
                style={styles.photoModalClose}
              >
                <Icon name="close" size={28} color={colors.white} />
              </TouchableOpacity>
            </View>

            {/* Photo viewer */}
            {photos.length > 0 && (
              <View style={styles.photoViewerContainer}>
                <FlatList
                  data={photos}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  initialScrollIndex={selectedPhotoIndex}
                  getItemLayout={(_, index) => ({
                    length: Dimensions.get('window').width,
                    offset: Dimensions.get('window').width * index,
                    index,
                  })}
                  onMomentumScrollEnd={(e) => {
                    const index = Math.round(e.nativeEvent.contentOffset.x / Dimensions.get('window').width);
                    setSelectedPhotoIndex(index);
                  }}
                  keyExtractor={(item) => item.localId}
                  renderItem={({ item }) => (
                    <View style={styles.photoSlide}>
                      <Image
                        source={{ uri: item.localUri }}
                        style={styles.photoImage}
                        resizeMode="contain"
                      />
                      <View style={styles.photoInfo}>
                        <Text style={styles.photoInfoText}>{item.fileName}</Text>
                        <Text style={styles.photoInfoDate}>
                          {new Date(item.createdAt).toLocaleString('pl-PL')}
                        </Text>
                      </View>
                    </View>
                  )}
                />
              </View>
            )}

            {/* Thumbnail strip */}
            {photos.length > 1 && (
              <ScrollView 
                horizontal 
                style={styles.thumbnailStrip}
                contentContainerStyle={styles.thumbnailStripContent}
                showsHorizontalScrollIndicator={false}
              >
                {photos.map((photo, index) => (
                  <TouchableOpacity
                    key={photo.localId}
                    onPress={() => setSelectedPhotoIndex(index)}
                    style={[
                      styles.thumbnail,
                      index === selectedPhotoIndex && styles.thumbnailActive
                    ]}
                  >
                    <Image
                      source={{ uri: photo.localUri }}
                      style={styles.thumbnailImage}
                    />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {/* Actions */}
            <View style={styles.photoModalActions}>
              {!isPreviewMode && (
                <>
                  <TouchableOpacity
                    style={styles.photoActionButton}
                    onPress={() => handleAddPhoto('camera')}
                    disabled={isAddingPhoto}
                  >
                    <Icon name="camera-plus" size={24} color={colors.white} />
                    <Text style={styles.photoActionText}>Aparat</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.photoActionButton}
                    onPress={() => handleAddPhoto('gallery')}
                    disabled={isAddingPhoto}
                  >
                    <Icon name="image-plus" size={24} color={colors.white} />
                    <Text style={styles.photoActionText}>Galeria</Text>
                  </TouchableOpacity>
                  {photos.length > 0 && (
                    <TouchableOpacity
                      style={[styles.photoActionButton, styles.photoActionDelete]}
                      onPress={() => photos[selectedPhotoIndex] && handleDeletePhoto(photos[selectedPhotoIndex])}
                    >
                      <Icon name="delete" size={24} color={colors.error} />
                      <Text style={[styles.photoActionText, { color: colors.error }]}>Usuń</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
          </View>
        </View>
      </RNModal>

      {/* Sticky Header with Device Info */}
      <View style={[styles.stickyHeader, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.headerTop}>
          <Button variant="ghost" onPress={handleBack} icon="arrow-left" size="small">
            Wróć
          </Button>
          
          <View style={styles.headerRight}>
            {!isPreviewMode && (
              <TouchableOpacity 
                style={styles.copyButton}
                onPress={openCopyModal}
              >
                <Icon name="content-copy" size={20} color={colors.primary} />
              </TouchableOpacity>
            )}
            {isBatchAudit && (
              <TouchableOpacity 
                style={styles.batchBadge}
                onPress={() => setShowElementsModal(true)}
              >
                <Icon name="format-list-bulleted" size={20} color={colors.primaryForeground} />
                <Text style={styles.batchBadgeText}>{allDeviceIds.length}</Text>
              </TouchableOpacity>
            )}
            <SyncStatusBadge status={currentSession.syncStatus} />
            {isSaving && (
              <View style={styles.savingIndicator}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.savingText}>Zapisywanie...</Text>
              </View>
            )}
          </View>
        </View>

        {/* Preview mode banner */}
        {isPreviewMode && (
          <View style={styles.previewBanner}>
            <Icon name="eye" size={20} color={colors.success} />
            <Text style={styles.previewBannerText}>
              Podgląd zakończonego audytu (tylko do odczytu)
            </Text>
          </View>
        )}

        {/* Collapsible Device info card - show first device as reference */}
        <TouchableOpacity 
          style={styles.deviceCard}
          onPress={() => setLocationExpanded(!locationExpanded)}
          activeOpacity={0.7}
        >
          <View style={styles.deviceHeader}>
            <View style={styles.deviceIcon}>
              <Icon name={isBatchAudit ? "checkbox-multiple-marked" : "map-marker"} size={18} color={colors.primary} />
            </View>
            <View style={styles.deviceHeaderInfo}>
              <Text style={styles.deviceHeaderTitle}>
                {isBatchAudit ? `${allDeviceIds.length} ELEMENTÓW` : 'ELEMENT'}
              </Text>
              <Text style={styles.deviceHeaderSubtitle} numberOfLines={1}>
                {isBatchAudit 
                  ? `${currentDevice.building || '-'} • ${currentDevice.type || 'różne typy'}`
                  : `${currentDevice.elementId} • ${currentDevice.building || 'Brak'} • ${currentDevice.level || 'Brak'}`
                }
              </Text>
            </View>
            <Icon 
              name={locationExpanded ? "chevron-up" : "chevron-down"} 
              size={20} 
              color={colors.textSecondary} 
            />
          </View>

          {locationExpanded && (
            <>
              <View style={styles.deviceDivider} />
              <View style={styles.deviceRow}>
                <View style={styles.deviceIconLarge}>
                  <Icon name="devices" size={28} color={colors.primary} />
                </View>
                <View style={styles.deviceInfo}>
                  <Text style={styles.deviceName} numberOfLines={1}>{currentDevice.name}</Text>
                  <Text style={styles.deviceId}>{currentDevice.elementId}</Text>
                </View>
              </View>
              
              <View style={styles.locationGrid}>
                {currentDevice.building && (
                  <View style={styles.locationItem}>
                    <Icon name="office-building" size={18} color={colors.primary} />
                    <View>
                      <Text style={styles.locationLabel}>Budynek</Text>
                      <Text style={styles.locationValue}>{currentDevice.building}</Text>
                    </View>
                  </View>
                )}
                {currentDevice.level && (
                  <View style={styles.locationItem}>
                    <Icon name="layers" size={18} color={colors.primary} />
                    <View>
                      <Text style={styles.locationLabel}>Poziom</Text>
                      <Text style={styles.locationValue}>{currentDevice.level}</Text>
                    </View>
                  </View>
                )}
                {currentDevice.zone && (
                  <View style={styles.locationItem}>
                    <Icon name="map-marker-radius" size={18} color={colors.primary} />
                    <View>
                      <Text style={styles.locationLabel}>Strefa</Text>
                      <Text style={styles.locationValue}>{currentDevice.zone}</Text>
                    </View>
                  </View>
                )}
                {currentDevice.type && (
                  <View style={styles.locationItem}>
                    <Icon name="cog" size={18} color={colors.primary} />
                    <View>
                      <Text style={styles.locationLabel}>Typ</Text>
                      <Text style={styles.locationValue}>{currentDevice.type}</Text>
                    </View>
                  </View>
                )}
              </View>
            </>
          )}
          
          {/* Overall progress - always visible */}
          <View style={styles.progressRow}>
            <View style={styles.progressInfo}>
              <View style={styles.progressStat}>
                <Icon name="format-list-checks" size={16} color={colors.textSecondary} />
                <Text style={styles.progressLabel}>
                  {overallProgress.answered}/{overallProgress.total}
                </Text>
              </View>
              {overallProgress.required > 0 && (
                <View style={[
                  styles.progressStat,
                  overallProgress.requiredAnswered < overallProgress.required && styles.progressStatWarning
                ]}>
                  <Icon 
                    name="asterisk" 
                    size={12} 
                    color={overallProgress.requiredAnswered >= overallProgress.required ? colors.success : colors.warning} 
                  />
                  <Text style={[
                    styles.progressLabel,
                    overallProgress.requiredAnswered < overallProgress.required && styles.progressLabelWarning
                  ]}>
                    {overallProgress.requiredAnswered}/{overallProgress.required} wymaganych
                  </Text>
                </View>
              )}
            </View>
            
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { width: `${(overallProgress.answered / Math.max(overallProgress.total, 1)) * 100}%` }
                ]} 
              />
            </View>
          </View>
        </TouchableOpacity>

        {/* Tab selector - always show to allow access to photos tab */}
        {formConfig.tabs.length >= 1 && (
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.tabsScroll}
            contentContainerStyle={styles.tabsContent}
          >
            {/* Photos tab - first */}
            <View style={styles.tabButtonContainer}>
              <TouchableOpacity
                style={[
                  styles.photoTabButton,
                  showPhotosTab && styles.photoTabButtonActive
                ]}
                onPress={() => setShowPhotosTab(true)}
              >
                <Icon name="camera" size={18} color={showPhotosTab ? colors.white : colors.primary} />
                {photos.length > 0 && (
                  <Text style={[styles.photoTabBadgeText, showPhotosTab && styles.photoTabBadgeTextActive]}>
                    {photos.length}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
            
            {/* Form tabs */}
            {formConfig.tabs.map((tab, index) => {
              const isActive = index === currentTabIndex && !showPhotosTab;
              const progress = tabsProgress.get(tab.id);
              const hasAnswers = progress && progress.answered > 0;
              const isComplete = progress?.isComplete;
              const hasRequiredMissing = progress && progress.requiredAnswered < progress.required;
              
              const iconName = isComplete 
                ? 'check-circle' 
                : hasAnswers 
                  ? 'circle-half-full' 
                  : undefined;
              
              return (
                <View key={tab.id} style={styles.tabButtonContainer}>
                  <Button
                    variant={isActive ? 'primary' : 'outline'}
                    onPress={() => {
                      setShowPhotosTab(false);
                      setCurrentTab(index);
                    }}
                    size="small"
                    icon={iconName}
                    style={hasRequiredMissing && showValidation ? styles.tabButtonWarning : styles.tabButton}
                  >
                    {`${tab.tabNumber}. ${tab.title}`}
                  </Button>
                  {progress && (
                    <View style={styles.tabProgress}>
                      <View 
                        style={[
                          styles.tabProgressFill,
                          { width: `${progress.percentage * 100}%` }
                        ]} 
                      />
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* Error banner */}
      {error && (
        <View style={styles.errorBanner}>
          <Icon name="alert-circle" size={20} color={colors.error} />
          <Text style={styles.errorText}>{error}</Text>
          <Button variant="ghost" onPress={clearError} size="small">
            Zamknij
          </Button>
        </View>
      )}

      {/* Photos tab content */}
      {showPhotosTab && (
        <ScrollView style={styles.photosTabContent} contentContainerStyle={styles.photosTabContentContainer}>
          <View style={styles.photosGrid}>
            {photos.map((photo, index) => (
              <TouchableOpacity
                key={photo.localId}
                style={styles.photoGridItem}
                onPress={() => {
                  setSelectedPhotoIndex(index);
                  setShowPhotoModal(true);
                }}
              >
                <Image 
                  source={{ uri: photo.localUri }} 
                  style={styles.photoGridImage}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            ))}
            {/* Add photo button */}
            <TouchableOpacity
              style={styles.photoGridAddButton}
              onPress={showPhotoOptions}
              disabled={isAddingPhoto}
            >
              <Icon name="camera-plus" size={32} color={colors.primary} />
              <Text style={styles.photoGridAddText}>Dodaj zdjęcie</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* Form */}
      {!showPhotosTab && currentTab && (
        <DynamicFormRenderer
          key={`tab-${currentTabIndex}`}
          tab={currentTab}
          fields={currentFields}
          optionValues={formConfig.optionValues}
          answers={answers}
          onAnswerChange={isPreviewMode ? () => {} : handleSaveAnswer}
          showValidation={showValidation}
          isBatchAudit={isBatchAudit && !isPreviewMode}
          hasVariedAnswers={hasVariedAnswers}
          onOpenPerDeviceEditor={isPreviewMode ? undefined : openPerDeviceEditor}
          readonly={isPreviewMode}
        />
      )}

      {/* Bottom actions */}
      <View style={[styles.bottomActions, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
        {/* Previous button */}
        {showPhotosTab ? null : (
          currentTabIndex > 0 ? (
            <Button
              variant="outline"
              onPress={() => {
                if (currentTabIndex === 0) {
                  setShowPhotosTab(true);
                } else {
                  setCurrentTab(currentTabIndex - 1);
                }
              }}
              icon="chevron-left"
              size="medium"
            >
              Poprzednia
            </Button>
          ) : (
            <Button
              variant="outline"
              onPress={() => setShowPhotosTab(true)}
              icon="camera"
              size="medium"
            >
              Zdjęcia
            </Button>
          )
        )}
        
        <View style={styles.spacer} />
        
        {showPhotosTab ? (
          <Button
            onPress={() => {
              setShowPhotosTab(false);
              setCurrentTab(0);
            }}
            icon="chevron-right"
            size="medium"
          >
            Formularz
          </Button>
        ) : currentTabIndex < formConfig.tabs.length - 1 ? (
          <Button
            onPress={() => setCurrentTab(currentTabIndex + 1)}
            icon="chevron-right"
            size="medium"
          >
            Następna
          </Button>
        ) : isPreviewMode ? (
          <Button
            onPress={safeGoBack}
            icon="close"
            size="medium"
          >
            Zamknij podgląd
          </Button>
        ) : (
          <Button
            onPress={handleCompleteAllDevices}
            icon="check-circle"
            size="medium"
            loading={isCompleting || isUploading}
            disabled={isCompleting || isUploading}
            style={styles.completeButton}
          >
            {isCompleting 
              ? 'Kończenie...' 
              : isUploading 
                ? 'Wysyłanie...' 
                : isBatchAudit
                  ? `Zakończ (${allDeviceIds.length})`
                  : 'Zakończ audyt'
            }
          </Button>
        )}
      </View>

      {/* Snackbar */}
      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={1500}
        style={styles.snackbar}
        action={{
          label: 'OK',
          onPress: () => setSnackbarVisible(false),
        }}
      >
        <View style={styles.snackbarContent}>
          <Icon name="check-circle" size={18} color={colors.success} />
          <Text style={styles.snackbarText}>{snackbarMessage}</Text>
        </View>
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    ...typography.bodyLarge,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  
  // Sticky Header
  stickyHeader: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
    ...shadows.sm,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    paddingHorizontal: screen.isTablet ? spacing.xl : spacing.md,
    paddingBottom: spacing.sm,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  savingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  savingText: {
    ...typography.labelSmall,
    color: colors.textSecondary,
  },
  
  // Batch badge
  batchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
  },
  batchBadgeText: {
    fontSize: 16,
    color: colors.primaryForeground,
    fontWeight: '700',
  },
  previewBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.success + '15',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.success + '40',
  },
  previewBannerText: {
    flex: 1,
    fontSize: 14,
    color: colors.success,
    fontWeight: '600',
  },
  batchInfoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.primary + '40',
  },
  batchInfoText: {
    flex: 1,
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  
  // Elements modal
  elementsModal: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  elementsModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  elementsModalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  elementsModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  elementsModalClose: {
    padding: spacing.sm,
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.full,
  },
  elementsModalSubtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: colors.surfaceVariant,
  },
  elementsModalList: {
    flex: 1,
  },
  elementsModalListContent: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  elementsModalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    gap: spacing.md,
  },
  elementsModalItemNumber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  elementsModalItemNumberText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primaryForeground,
  },
  elementsModalItemContent: {
    flex: 1,
  },
  elementsModalItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  elementsModalItemMeta: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  elementsModalFooter: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
  },
  elementsModalDone: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  elementsModalDoneText: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.primaryForeground,
  },
  
  // Per-device answers modal
  perDeviceModal: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  perDeviceModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  perDeviceModalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  perDeviceModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  perDeviceModalClose: {
    padding: spacing.sm,
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.full,
  },
  perDeviceModalSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: colors.primaryLight,
  },
  perDeviceModalList: {
    flex: 1,
  },
  perDeviceModalListContent: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  perDeviceModalItem: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  perDeviceModalItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.surfaceVariant,
    gap: spacing.md,
  },
  perDeviceModalItemNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  perDeviceModalItemNumberText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primaryForeground,
  },
  perDeviceModalItemInfo: {
    flex: 1,
  },
  perDeviceModalItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  perDeviceModalItemMeta: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  perDeviceModalItemField: {
    padding: spacing.md,
    paddingTop: 0,
  },
  perDeviceModalFooter: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
    gap: spacing.md,
  },
  perDeviceModalSetAll: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  perDeviceModalSetAllText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },
  perDeviceModalDone: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  perDeviceModalDoneText: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.primaryForeground,
  },
  
  // Copy button in header
  copyButton: {
    padding: spacing.sm,
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.md,
    marginRight: spacing.sm,
  },
  
  // Copy modal - styled like DevicesScreen
  copyModal: {
    flex: 1,
    backgroundColor: colors.background,
  },
  copyModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  copyModalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  copyModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  copyModalClose: {
    padding: spacing.sm,
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.full,
  },
  // Search - styled like DevicesScreen
  copySearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.md,
    paddingRight: spacing.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    height: 52,
  },
  copySearchIconContainer: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
    borderTopLeftRadius: borderRadius.xl,
    borderBottomLeftRadius: borderRadius.xl,
  },
  copySearchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
  },
  copySearchClear: {
    padding: spacing.sm,
  },
  // Filters container - full-width rows like DevicesScreen
  copyFiltersContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  copyFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.outlineVariant,
    gap: spacing.md,
    minHeight: 60,
  },
  copyFilterRowActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
    borderWidth: 2,
  },
  copyFilterIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyFilterIconActive: {
    backgroundColor: colors.primary + '25',
  },
  copyFilterContent: {
    flex: 1,
  },
  copyFilterLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 2,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  copyFilterValue: {
    fontSize: 15,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  copyFilterValueActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  // Results row
  copyResultsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceVariant,
  },
  copyResultsText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  copyClearFiltersBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  copyClearFiltersText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.error,
  },
  // List
  copyModalList: {
    flex: 1,
  },
  copyModalListContent: {
    paddingVertical: spacing.sm,
  },
  // Device item - styled like DevicesScreen
  copyDeviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  copyDeviceItemCompleted: {
    borderLeftWidth: 3,
    borderLeftColor: colors.success,
  },
  copyDeviceItemDisabled: {
    opacity: 0.6,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceVariant,
  },
  copyDeviceStatus: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  copyDeviceStatusCompleted: {
    backgroundColor: colors.successLight,
  },
  copyDeviceStatusInProgress: {
    backgroundColor: colors.warningLight,
  },
  copyDeviceStatusEmpty: {
    backgroundColor: colors.surfaceVariant,
  },
  copyDeviceInfo: {
    flex: 1,
  },
  copyDeviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  copyDeviceNameDisabled: {
    color: colors.textDisabled,
  },
  copyDeviceIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 2,
  },
  copyDeviceId: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  copyDeviceIdDisabled: {
    color: colors.textDisabled,
  },
  copyDeviceBadgeCompleted: {
    backgroundColor: colors.successLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  copyDeviceBadgeInProgress: {
    backgroundColor: colors.warningLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  copyDeviceBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.success,
  },
  copyDeviceBadgeTextInProgress: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.warning,
  },
  copyDeviceBadgeEmpty: {
    backgroundColor: colors.outlineVariant,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  copyDeviceBadgeEmptyText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textDisabled,
  },
  copyDeviceAnswersBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  copyDeviceAnswersText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
  },
  copyDeviceTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  copyDeviceTag: {
    backgroundColor: colors.surfaceVariant,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  copyDeviceTagText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  copyDeviceTagDisabled: {
    backgroundColor: colors.outlineVariant,
  },
  copyDeviceTagTextDisabled: {
    color: colors.textDisabled,
  },
  copyDeviceAction: {
    padding: spacing.sm,
  },
  // Loading and empty states
  copyModalLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  copyModalLoadingText: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  copyModalEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  copyModalEmptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  copyModalEmptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  copyModalEmptyClear: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.lg,
    marginTop: spacing.md,
  },
  copyModalEmptyClearText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },
  // Footer
  copyModalFooter: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
  },
  copyModalCancel: {
    backgroundColor: colors.surfaceVariant,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  copyModalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  
  // Filter Modal styles - same as DevicesScreen
  filterModalContainer: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  filterModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
    backgroundColor: colors.surface,
  },
  filterModalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  filterModalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  filterModalCloseBtn: {
    padding: spacing.sm,
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.full,
  },
  filterModalSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginHorizontal: spacing.xl,
    marginVertical: spacing.lg,
    gap: spacing.md,
    height: 56,
  },
  filterModalSearchInput: {
    flex: 1,
    fontSize: 18,
    color: colors.textPrimary,
    padding: 0,
  },
  filterModalSelectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  filterModalSelectedText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
  },
  filterModalClearText: {
    fontSize: 16,
    color: colors.error,
    fontWeight: '500',
  },
  filterModalList: {
    flex: 1,
  },
  filterModalListContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  filterModalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.background,
    gap: spacing.lg,
    minHeight: 64,
  },
  filterModalOptionSelected: {
    backgroundColor: colors.primaryLight,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  filterModalCheckbox: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    borderColor: colors.outline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterModalCheckboxSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterModalOptionText: {
    fontSize: 18,
    color: colors.textPrimary,
    flex: 1,
  },
  filterModalOptionTextSelected: {
    fontWeight: '600',
    color: colors.primary,
  },
  filterModalEmptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl * 3,
    gap: spacing.lg,
  },
  filterModalEmptyText: {
    fontSize: 16,
    color: colors.textDisabled,
    textAlign: 'center',
  },
  filterModalFooter: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
    backgroundColor: colors.surface,
  },
  filterModalDoneBtn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    minHeight: 56,
    justifyContent: 'center',
  },
  filterModalDoneBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primaryForeground,
  },
  
  // Device Card
  deviceCard: {
    marginBottom: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceVariant,
  },
  deviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deviceHeaderInfo: {
    flex: 1,
    marginLeft: spacing.xs,
  },
  deviceHeaderTitle: {
    ...typography.labelSmall,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  deviceHeaderSubtitle: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  deviceDivider: {
    height: 1,
    backgroundColor: colors.outline,
    marginVertical: spacing.sm,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deviceIcon: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceIconLarge: {
    width: 52,
    height: 52,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    ...typography.titleLarge,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  deviceId: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginTop: 2,
  },
  locationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.md,
    gap: spacing.md,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    minWidth: 140,
  },
  locationLabel: {
    ...typography.labelSmall,
    color: colors.textSecondary,
  },
  locationValue: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  deviceMeta: {
    gap: spacing.xs,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metaText: {
    ...typography.labelSmall,
    color: colors.textSecondary,
  },
  progressRow: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.outline,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  progressStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  progressStatWarning: {
    backgroundColor: colors.warningLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  progressLabel: {
    ...typography.labelMedium,
    color: colors.textSecondary,
  },
  progressLabelWarning: {
    color: colors.warningDark,
  },
  progressBar: {
    height: 6,
    backgroundColor: colors.outline,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
  },
  
  // Tabs
  tabsScroll: {
    maxHeight: 72,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
    backgroundColor: colors.surface,
  },
  tabsContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  tabButtonContainer: {
    marginRight: spacing.sm,
  },
  tabButton: {
    minWidth: 120,
  },
  tabButtonWarning: {
    minWidth: 120,
    borderColor: colors.warning,
  },
  tabProgress: {
    height: 3,
    backgroundColor: colors.outlineVariant,
    borderRadius: borderRadius.full,
    marginTop: spacing.xs,
    overflow: 'hidden',
  },
  tabProgressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
  },
  
  // Photo tab button - same size as form tabs
  photoTabButton: {
    minWidth: 120,
    height: 48,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  photoTabButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  photoTabBadgeText: {
    ...typography.labelMedium,
    color: colors.primary,
    fontWeight: '600',
  },
  photoTabBadgeTextActive: {
    color: colors.white,
  },
  
  // Photos tab content
  photosTabContent: {
    flex: 1,
  },
  photosTabContentContainer: {
    padding: spacing.md,
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  photoGridItem: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    backgroundColor: colors.surfaceVariant,
  },
  photoGridImage: {
    width: '100%',
    height: '100%',
  },
  photoGridAddButton: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  photoGridAddText: {
    ...typography.labelSmall,
    color: colors.primary,
    textAlign: 'center',
  },
  
  // Error
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.errorLight,
    padding: spacing.md,
    margin: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  errorText: {
    ...typography.bodyMedium,
    color: colors.error,
    flex: 1,
  },
  
  // Bottom Actions
  bottomActions: {
    flexDirection: 'row',
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg, // Will be overridden by inline style with insets
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
    ...shadows.md,
  },
  spacer: {
    flex: 1,
  },
  completeButton: {
    backgroundColor: colors.success,
  },
  
  // Snackbar
  snackbar: {
    marginBottom: 80,
    backgroundColor: colors.surface,
  },
  snackbarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  snackbarText: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  
  // Photo button
  photoButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoButtonWithBadge: {
    position: 'relative',
  },
  photoBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  photoBadgeText: {
    ...typography.labelSmall,
    color: colors.primaryForeground,
    fontWeight: '600',
  },
  
  // Photo Modal
  photoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  photoModalContent: {
    flex: 1,
  },
  photoModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  photoModalTitle: {
    ...typography.titleMedium,
    color: colors.white,
  },
  photoModalClose: {
    padding: spacing.sm,
  },
  photoViewerContainer: {
    flex: 1,
  },
  photoSlide: {
    width: Dimensions.get('window').width,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoImage: {
    width: Dimensions.get('window').width - spacing.lg * 2,
    height: '80%',
    borderRadius: borderRadius.lg,
  },
  photoInfo: {
    position: 'absolute',
    bottom: spacing.lg,
    left: spacing.lg,
    right: spacing.lg,
    alignItems: 'center',
  },
  photoInfoText: {
    ...typography.bodyMedium,
    color: colors.white,
    opacity: 0.8,
  },
  photoInfoDate: {
    ...typography.bodySmall,
    color: colors.white,
    opacity: 0.6,
  },
  thumbnailStrip: {
    maxHeight: 80,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  thumbnailStripContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbnailActive: {
    borderColor: colors.primary,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  photoModalActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xl,
    paddingVertical: spacing.lg,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  photoActionButton: {
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.md,
  },
  photoActionDelete: {
    marginLeft: spacing.xl,
  },
  photoActionText: {
    ...typography.labelSmall,
    color: colors.white,
  },
});
