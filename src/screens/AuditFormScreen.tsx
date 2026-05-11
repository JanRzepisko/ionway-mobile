// =============================================================================
// Audit Form Screen - Dynamic form with batch audit support
// Supports auditing multiple elements with same form (parallel mode)
// =============================================================================

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Alert, BackHandler, TouchableOpacity, Animated, Modal as RNModal, FlatList } from 'react-native';
import { Text, ActivityIndicator, Snackbar } from 'react-native-paper';
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
              { text: 'Wyjdź', onPress: () => navigation.goBack() }
            ]
          );
          return true;
        }
        return false;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [currentSession?.status, navigation])
  );

  // Start or resume audit
  // If sessionId is provided (viewing existing audit), resume it
  // Otherwise start new audit for first device
  useEffect(() => {
    if (sessionId) {
      // Resume existing audit session (e.g., viewing completed audit)
      resumeAudit(sessionId);
    } else if (currentProject && user && allDeviceIds.length > 0) {
      // Start new audit for first device to get form config
      startAudit(allDeviceIds[0], currentProject.id, user.id);
    }
  }, [currentProject?.id, user?.id, allDeviceIds[0], sessionId]);

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
    
    // For batch audit: always update per-device answers
    // When field doesn't exist yet: set all devices to same value
    // When field exists: update all devices that are NOT customized (all have same value)
    if (isBatchAudit) {
      setPerDeviceAnswers(prev => {
        const newMap = new Map(prev);
        const existingDeviceMap = newMap.get(fieldId);
        
        if (!existingDeviceMap) {
          // First time setting this field - set same value for all devices
          const deviceMap = new Map<string, string | null>();
          allDeviceIds.forEach(devId => deviceMap.set(devId, value));
          newMap.set(fieldId, deviceMap);
        } else {
          // Field already exists - check if all values are the same (not customized)
          const values = Array.from(existingDeviceMap.values());
          const allSame = values.every(v => v === values[0]);
          
          if (allSame) {
            // All devices have same value - update all to new value
            allDeviceIds.forEach(devId => existingDeviceMap.set(devId, value));
          }
          // If values are different (customized), don't change them
          // User must edit per-device manually in the modal
        }
        return newMap;
      });
    }
  }, [saveAnswer, isBatchAudit, allDeviceIds]);

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
  const setDeviceAnswer = useCallback((fieldId: string, deviceId: string, value: string | null) => {
    setPerDeviceAnswers(prev => {
      const newMap = new Map(prev);
      let deviceMap = newMap.get(fieldId);
      
      if (!deviceMap) {
        // Initialize all devices with current main answer first
        deviceMap = new Map<string, string | null>();
        const mainValue = answers.get(fieldId)?.valueText ?? null;
        allDeviceIds.forEach(devId => deviceMap!.set(devId, mainValue));
        newMap.set(fieldId, deviceMap);
      }
      
      // Now set the specific device's value
      const updatedDeviceMap = new Map(deviceMap);
      updatedDeviceMap.set(deviceId, value);
      newMap.set(fieldId, updatedDeviceMap);
      
      return newMap;
    });
  }, [answers, allDeviceIds]);

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

  const handleBack = () => {
    if (currentSession?.status === 'in_progress') {
      Alert.alert(
        'Audyt w toku',
        'Dane są zapisane lokalnie. Możesz wrócić i kontynuować później.',
        [
          { text: 'Kontynuuj audyt', style: 'cancel' },
          { text: 'Wyjdź', onPress: () => navigation.goBack() }
        ]
      );
    } else {
      navigation.goBack();
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
                      ? `Zakończono ${allDeviceIds.length} audytów i wysłano na serwer`
                      : 'Audyt zakończony i wysłany na serwer'
                  );
                } else {
                  setSnackbarMessage('Audyt zakończony. Wyślij później w ustawieniach.');
                }
              } else {
                setSnackbarMessage('Audyt zakończony. Wyślij gdy będziesz online.');
              }
              setSnackbarVisible(true);

              setTimeout(() => {
                navigation.goBack();
              }, 1500);
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

      {/* Sticky Header with Device Info */}
      <View style={[styles.stickyHeader, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.headerTop}>
          <Button variant="ghost" onPress={handleBack} icon="arrow-left" size="small">
            Wróć
          </Button>
          
          <View style={styles.headerRight}>
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

        {/* Tab selector */}
        {formConfig.tabs.length > 1 && (
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.tabsScroll}
            contentContainerStyle={styles.tabsContent}
          >
            {formConfig.tabs.map((tab, index) => {
              const isActive = index === currentTabIndex;
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
                    onPress={() => setCurrentTab(index)}
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

      {/* Form */}
      {currentTab && (
        <DynamicFormRenderer
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
        {currentTabIndex > 0 && (
          <Button
            variant="outline"
            onPress={() => setCurrentTab(currentTabIndex - 1)}
            icon="chevron-left"
            size="medium"
          >
            Poprzednia
          </Button>
        )}
        
        <View style={styles.spacer} />
        
        {currentTabIndex < formConfig.tabs.length - 1 ? (
          <Button
            onPress={() => setCurrentTab(currentTabIndex + 1)}
            icon="chevron-right"
            size="medium"
          >
            Następna
          </Button>
        ) : isPreviewMode ? (
          <Button
            onPress={() => navigation.goBack()}
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
});
