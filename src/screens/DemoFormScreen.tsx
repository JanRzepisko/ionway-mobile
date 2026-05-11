// =============================================================================
// Demo Form Screen - For testing dynamic form renderer without backend
// Uses mock data to demonstrate form functionality
// =============================================================================

import React, { useState, useMemo, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, ActivityIndicator, Snackbar, Portal, Modal, TextInput } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { SyncStatusBadge } from '../components/ui/SyncStatusBadge';
import { DynamicFormRenderer } from '../components/forms/DynamicFormRenderer';
import { 
  mockDevices, 
  mockFormTabs, 
  mockFormFields, 
  getMockOptionValuesMap,
  getMockFormConfig 
} from '../data/mockFormData';
import { AuditAnswer, FormTab, Device } from '../types';

interface TabProgress {
  total: number;
  answered: number;
  required: number;
  requiredAnswered: number;
  percentage: number;
  isComplete: boolean;
}

export function DemoFormScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const insets = useSafeAreaInsets();
  
  // Mock state
  const [currentDevice] = useState<Device>(mockDevices[0]);
  const [currentTabIndex, setCurrentTab] = useState(0);
  const [answers, setAnswers] = useState<Map<string, AuditAnswer>>(new Map());
  const [isSaving, setIsSaving] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [notes, setNotes] = useState('');
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [showValidation, setShowValidation] = useState(false);

  // Get form config
  const formConfig = useMemo(() => getMockFormConfig(), []);

  // Calculate tab progress
  const tabsProgress = useMemo((): Map<string, TabProgress> => {
    const progressMap = new Map<string, TabProgress>();
    
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

  const handleSaveAnswer = useCallback(async (
    fieldId: string,
    value: string | null,
    logicalDataColumnNumber?: number
  ) => {
    setIsSaving(true);
    
    // Simulate save delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const newAnswers = new Map(answers);
    
    if (value === null) {
      newAnswers.delete(fieldId);
    } else {
      const existingAnswer = answers.get(fieldId);
      newAnswers.set(fieldId, {
        id: existingAnswer?.id || `answer-${Date.now()}`,
        localId: existingAnswer?.localId || `answer-${Date.now()}`,
        auditSessionId: 'demo-session',
        auditSessionLocalId: 'demo-session',
        deviceId: currentDevice.id,
        formFieldId: fieldId,
        logicalDataColumnNumber,
        valueText: value,
        auditorId: 'demo-user',
        answeredAt: Date.now(),
        syncStatus: 'pending_upload',
      });
    }
    
    setAnswers(newAnswers);
    setIsSaving(false);
    
    setSnackbarMessage('Zapisano lokalnie');
    setSnackbarVisible(true);
  }, [answers, currentDevice.id]);

  const handleComplete = async () => {
    if (overallProgress.requiredAnswered < overallProgress.required) {
      setShowValidation(true);
      Alert.alert(
        'Brakujące wymagane pola',
        'Nie wszystkie wymagane pola zostały wypełnione.',
        [
          { text: 'Wróć do formularza', style: 'cancel' },
          { 
            text: 'Zakończ mimo to', 
            style: 'destructive',
            onPress: () => {
              setShowCompleteModal(false);
              Alert.alert(
                'Demo: Audyt zakończony',
                `Zapisano ${overallProgress.answered} odpowiedzi. W prawdziwej aplikacji dane zostaną wysłane do serwera.`
              );
            }
          }
        ]
      );
      return;
    }

    setShowCompleteModal(false);
    Alert.alert(
      'Demo: Audyt zakończony',
      `Zapisano ${overallProgress.answered} odpowiedzi. W prawdziwej aplikacji dane zostaną wysłane do serwera.`
    );
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const currentTab = formConfig.tabs[currentTabIndex];
  const currentFields = formConfig.fields.filter(
    f => f.formTabId === currentTab?.id || f.tabNumber === currentTab?.tabNumber
  );

  return (
    <View style={styles.container}>
      {/* Demo Banner */}
      <View style={styles.demoBanner}>
        <Icon name="flask" size={18} color={colors.info} />
        <Text style={styles.demoBannerText}>
          Tryb demonstracyjny - dane nie są zapisywane na serwerze
        </Text>
      </View>

      {/* Sticky Header with Device Info */}
      <View style={styles.stickyHeader}>
        <View style={styles.headerTop}>
          <Button mode="text" onPress={handleBack} icon="arrow-left" size="small">
            Wróć
          </Button>
          
          <View style={styles.headerRight}>
            <SyncStatusBadge status="pending_upload" />
            {isSaving && (
              <View style={styles.savingIndicator}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.savingText}>Zapisywanie...</Text>
              </View>
            )}
          </View>
        </View>

        {/* Device info card */}
        <View style={styles.deviceCard}>
          <View style={styles.deviceRow}>
            <View style={styles.deviceIcon}>
              <Icon name="devices" size={28} color={colors.primary} />
            </View>
            <View style={styles.deviceInfo}>
              <Text style={styles.deviceName} numberOfLines={1}>{currentDevice.name}</Text>
              <Text style={styles.deviceId}>{currentDevice.elementId}</Text>
            </View>
            <View style={styles.deviceMeta}>
              {currentDevice.building && (
                <View style={styles.metaItem}>
                  <Icon name="office-building" size={14} color={colors.textSecondary} />
                  <Text style={styles.metaText}>{currentDevice.building}</Text>
                </View>
              )}
              {currentDevice.level && (
                <View style={styles.metaItem}>
                  <Icon name="layers" size={14} color={colors.textSecondary} />
                  <Text style={styles.metaText}>{currentDevice.level}</Text>
                </View>
              )}
            </View>
          </View>
          
          {/* Overall progress */}
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
        </View>

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
                    mode={isActive ? 'contained' : 'outlined'}
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

      {/* Form */}
      {currentTab && (
        <DynamicFormRenderer
          tab={currentTab}
          fields={currentFields}
          optionValues={formConfig.optionValues}
          answers={answers}
          onAnswerChange={handleSaveAnswer}
          showValidation={showValidation}
        />
      )}

      {/* Bottom actions */}
      <View style={[styles.bottomActions, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
        {currentTabIndex > 0 && (
          <Button
            mode="outlined"
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
        ) : (
          <Button
            onPress={() => setShowCompleteModal(true)}
            icon="check-circle"
            color="success"
            size="medium"
          >
            Zakończ audyt
          </Button>
        )}
      </View>

      {/* Complete modal */}
      <Portal>
        <Modal
          visible={showCompleteModal}
          onDismiss={() => setShowCompleteModal(false)}
          contentContainerStyle={styles.modal}
        >
          <View style={styles.modalHeader}>
            <Icon name="clipboard-check" size={32} color={colors.primary} />
            <Text style={styles.modalTitle}>Zakończ audyt</Text>
          </View>
          
          <View style={styles.modalSummary}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryIcon}>
                <Icon name="format-list-checks" size={20} color={colors.textSecondary} />
              </View>
              <Text style={styles.summaryLabel}>Odpowiedzi:</Text>
              <Text style={styles.summaryValue}>
                {overallProgress.answered}/{overallProgress.total}
              </Text>
            </View>
            {overallProgress.required > 0 && (
              <View style={styles.summaryRow}>
                <View style={styles.summaryIcon}>
                  <Icon 
                    name="asterisk" 
                    size={16} 
                    color={overallProgress.requiredAnswered < overallProgress.required 
                      ? colors.warning 
                      : colors.success
                    } 
                  />
                </View>
                <Text style={styles.summaryLabel}>Wymagane:</Text>
                <Text style={[
                  styles.summaryValue,
                  overallProgress.requiredAnswered < overallProgress.required && styles.summaryValueWarning
                ]}>
                  {overallProgress.requiredAnswered}/{overallProgress.required}
                </Text>
              </View>
            )}
          </View>

          {overallProgress.requiredAnswered < overallProgress.required && (
            <View style={styles.warningBox}>
              <Icon name="alert" size={20} color={colors.warning} />
              <Text style={styles.warningText}>
                Nie wszystkie wymagane pola zostały wypełnione
              </Text>
            </View>
          )}

          <TextInput
            mode="outlined"
            label="Dodatkowe uwagi (opcjonalnie)"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            style={styles.notesInput}
            outlineColor={colors.outline}
            activeOutlineColor={colors.primary}
          />

          <View style={styles.modalActions}>
            <Button
              mode="outlined"
              onPress={() => setShowCompleteModal(false)}
            >
              Kontynuuj audyt
            </Button>
            <Button
              onPress={handleComplete}
              color="success"
            >
              Zakończ
            </Button>
          </View>
        </Modal>
      </Portal>

      {/* Snackbar */}
      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={1500}
        style={styles.snackbar}
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
  
  // Demo Banner
  demoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.infoLight,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  demoBannerText: {
    ...typography.labelMedium,
    color: colors.infoDark,
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
  
  // Device Card
  deviceCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.lg,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deviceIcon: {
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
  
  // Modal
  modal: {
    backgroundColor: colors.surface,
    margin: spacing.xl,
    padding: spacing.xl,
    borderRadius: borderRadius.xl,
    maxWidth: 500,
    alignSelf: 'center',
    width: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  modalTitle: {
    ...typography.headlineMedium,
    color: colors.textPrimary,
  },
  modalSummary: {
    backgroundColor: colors.surfaceVariant,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryIcon: {
    width: 24,
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  summaryLabel: {
    ...typography.bodyLarge,
    color: colors.textSecondary,
    flex: 1,
  },
  summaryValue: {
    ...typography.titleMedium,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  summaryValueWarning: {
    color: colors.warning,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warningLight,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  warningText: {
    ...typography.bodyMedium,
    color: colors.warningDark,
    flex: 1,
  },
  notesInput: {
    backgroundColor: colors.surface,
    marginBottom: spacing.lg,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
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
