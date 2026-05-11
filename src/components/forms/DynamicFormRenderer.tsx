// =============================================================================
// Dynamic Form Renderer - Renders forms from configuration
// Premium enterprise design for tablet usage
// =============================================================================

import React, { useCallback, useMemo } from 'react';
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { Text, Divider, ProgressBar } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { FormField, FormTab, OptionValue, AuditAnswer } from '../../types';
import { colors, spacing, typography, borderRadius, shadows, screen } from '../../theme';
import { FormFieldRenderer } from './FormFieldRenderer';
import { Card } from '../ui/Card';

interface DynamicFormRendererProps {
  tab: FormTab;
  fields: FormField[];
  optionValues: Map<string, OptionValue[]>;
  answers: Map<string, AuditAnswer>;
  onAnswerChange: (
    fieldId: string, 
    value: string | null,
    logicalDataColumnNumber?: number
  ) => void;
  onCommentChange?: (fieldId: string, comment: string) => void;
  showValidation?: boolean;
  // Batch audit props
  isBatchAudit?: boolean;
  hasVariedAnswers?: (fieldId: string) => boolean;
  onOpenPerDeviceEditor?: (fieldId: string) => void;
  // Preview mode
  readonly?: boolean;
}

export function DynamicFormRenderer({
  tab,
  fields,
  optionValues,
  answers,
  onAnswerChange,
  onCommentChange,
  showValidation = false,
  isBatchAudit = false,
  hasVariedAnswers,
  onOpenPerDeviceEditor,
  readonly = false,
}: DynamicFormRendererProps) {
  // Sort fields by display order
  const sortedFields = useMemo(() => {
    return [...fields]
      .filter(f => f.isVisible)
      .sort((a, b) => a.displayOrder - b.displayOrder);
  }, [fields]);

  // Calculate progress
  const progress = useMemo(() => {
    const total = sortedFields.length;
    const answered = sortedFields.filter(f => {
      const answer = answers.get(f.id);
      return answer?.valueText !== undefined && answer.valueText !== null && answer.valueText !== '';
    }).length;
    const required = sortedFields.filter(f => f.isRequired).length;
    const requiredAnswered = sortedFields.filter(f => {
      if (!f.isRequired) return false;
      const answer = answers.get(f.id);
      return answer?.valueText !== undefined && answer.valueText !== null && answer.valueText !== '';
    }).length;

    return {
      total,
      answered,
      required,
      requiredAnswered,
      percentage: total > 0 ? answered / total : 0,
      requiredPercentage: required > 0 ? requiredAnswered / required : 1,
    };
  }, [sortedFields, answers]);

  const handleCommentChange = useCallback((fieldId: string, comment: string) => {
    if (onCommentChange) {
      onCommentChange(fieldId, comment);
    }
  }, [onCommentChange]);

  return (
    <KeyboardAvoidingView
      style={styles.keyboardAvoid}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={100}
    >
      <ScrollView 
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Tab header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.tabInfo}>
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{tab.tabNumber}</Text>
              </View>
              <Text style={styles.title}>{tab.title}</Text>
            </View>
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Icon name="format-list-checks" size={18} color={colors.textSecondary} />
                <Text style={styles.statText}>
                  {progress.answered}/{progress.total}
                </Text>
              </View>
              {progress.required > 0 && (
                <View style={[
                  styles.statItem,
                  progress.requiredAnswered < progress.required && styles.statItemWarning
                ]}>
                  <Icon 
                    name="asterisk" 
                    size={14} 
                    color={progress.requiredAnswered < progress.required ? colors.warning : colors.success} 
                  />
                  <Text style={[
                    styles.statText,
                    progress.requiredAnswered < progress.required && styles.statTextWarning
                  ]}>
                    {progress.requiredAnswered}/{progress.required}
                  </Text>
                </View>
              )}
            </View>
          </View>
          
          {/* Progress bar */}
          <View style={styles.progressContainer}>
            <ProgressBar 
              progress={progress.percentage} 
              color={colors.primary}
              style={styles.progressBar}
            />
          </View>
        </View>
        
        <Divider style={styles.divider} />
        
        {/* Fields */}
        {sortedFields.map((field, index) => {
          const answer = answers.get(field.id);
          const options = field.optionSetId 
            ? optionValues.get(field.optionSetId) || []
            : [];
          const isVaried = isBatchAudit && hasVariedAnswers?.(field.id);
          
          return (
            <Card key={field.id} variant="outlined" style={styles.fieldCard}>
              <View style={styles.fieldRow}>
                {/* Main field content */}
                <View style={styles.fieldContent}>
                  <FormFieldRenderer
                    field={field}
                    options={options}
                    value={answer?.valueText ?? null}
                    comment={answer?.comment}
                    onChange={readonly ? () => {} : (value) => onAnswerChange(
                      field.id, 
                      value,
                      field.logicalDataColumnNumber
                    )}
                    onCommentChange={readonly ? undefined : (onCommentChange 
                      ? (comment) => handleCommentChange(field.id, comment)
                      : undefined
                    )}
                    showValidation={showValidation}
                    readonly={readonly}
                  />
                </View>
                
                {/* Batch mode: Per-device icon button */}
                {isBatchAudit && onOpenPerDeviceEditor && (
                  <TouchableOpacity 
                    style={[
                      styles.perDeviceIcon,
                      isVaried && styles.perDeviceIconVaried
                    ]}
                    onPress={() => onOpenPerDeviceEditor(field.id)}
                  >
                    <Icon 
                      name={isVaried ? "account-multiple-check" : "account-multiple"} 
                      size={22} 
                      color={isVaried ? colors.warning : colors.primary} 
                    />
                    {isVaried && (
                      <View style={styles.perDeviceIconBadge}>
                        <Text style={styles.perDeviceIconBadgeText}>!</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            </Card>
          );
        })}
        
        {sortedFields.length === 0 && (
          <View style={styles.empty}>
            <Icon name="file-document-outline" size={48} color={colors.textDisabled} />
            <Text style={styles.emptyText}>
              Brak pól w tej zakładce
            </Text>
          </View>
        )}

        {/* Bottom spacing for keyboard */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Helper function for Polish grammar
function getFieldsLabel(count: number): string {
  if (count === 1) return 'pole';
  if (count >= 2 && count <= 4) return 'pola';
  return 'pól';
}

const styles = StyleSheet.create({
  keyboardAvoid: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingHorizontal: screen.isTablet ? spacing.xl : spacing.lg,
    maxWidth: screen.isTablet ? 900 : undefined,
    alignSelf: screen.isTablet ? 'center' : undefined,
    width: '100%',
  },
  header: {
    marginBottom: spacing.md,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  tabInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  tabBadge: {
    width: screen.isTablet ? 40 : 32,
    height: screen.isTablet ? 40 : 32,
    borderRadius: screen.isTablet ? 20 : 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadgeText: {
    ...typography.titleMedium,
    fontSize: screen.isTablet ? 18 : 16,
    color: colors.primaryForeground,
    fontWeight: '700',
  },
  title: {
    ...typography.headlineMedium,
    fontSize: screen.isTablet ? 24 : 20,
    color: colors.textPrimary,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surfaceVariant,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  statItemWarning: {
    backgroundColor: colors.warningLight,
  },
  statText: {
    ...typography.labelLarge,
    color: colors.textSecondary,
  },
  statTextWarning: {
    color: colors.warningDark,
  },
  progressContainer: {
    marginTop: spacing.sm,
  },
  progressBar: {
    height: 6,
    borderRadius: borderRadius.full,
    backgroundColor: colors.outlineVariant,
  },
  divider: {
    marginBottom: spacing.lg,
  },
  fieldCard: {
    marginBottom: spacing.md,
    overflow: 'visible',
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  fieldContent: {
    flex: 1,
  },
  perDeviceIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.xs,
    marginTop: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primaryLight,
  },
  perDeviceIconVaried: {
    backgroundColor: colors.warning + '25',
  },
  perDeviceIconBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.warning,
    alignItems: 'center',
    justifyContent: 'center',
  },
  perDeviceIconBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.background,
  },
  empty: {
    padding: spacing.xxxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    ...typography.bodyLarge,
    color: colors.textDisabled,
    marginTop: spacing.md,
  },
  bottomSpacer: {
    height: 100,
  },
});
