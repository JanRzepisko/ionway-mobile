// =============================================================================
// Form Field Renderer - Renders individual form fields by type
// Premium enterprise design for tablet usage
// =============================================================================

import React, { useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, TextInput as RNTextInput, Platform } from 'react-native';
import { 
  Text, 
  TextInput, 
  RadioButton, 
  Checkbox, 
  HelperText,
  Chip,
  Searchbar,
  List,
  Portal,
  Modal,
} from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { FormField, OptionValue } from '../../types';
import { colors, spacing, typography, borderRadius, shadows, screen } from '../../theme';

interface FormFieldRendererProps {
  field: FormField;
  options: OptionValue[];
  value: string | null;
  comment?: string;
  onChange: (value: string | null) => void;
  onCommentChange?: (comment: string) => void;
  showValidation?: boolean;
  readonly?: boolean;
}

// Heuristics for detecting "notes/comments" fields
function isNotesField(field: FormField): boolean {
  const label = field.label.toLowerCase();
  const question = (field.question || '').toLowerCase();
  const description = (field.description || '').toLowerCase();
  
  const notesKeywords = [
    'uwagi', 'uwaga', 'komentarz', 'komentarze', 'notatka', 'notatki',
    'opis', 'dodatkowe', 'info', 'informacje', 'spostrzeżenia',
    'notes', 'comments', 'remarks', 'observations'
  ];
  
  return notesKeywords.some(keyword => 
    label.includes(keyword) || 
    question.includes(keyword) || 
    description.includes(keyword)
  );
}

export function FormFieldRenderer({
  field,
  options,
  value,
  comment,
  onChange,
  onCommentChange,
  readonly = false,
  showValidation = false,
}: FormFieldRendererProps) {
  const [showComment, setShowComment] = useState(!!comment);

  // Check if field should be multiline based on heuristics
  const shouldBeMultiline = useMemo(() => {
    if (field.fieldType === 'textArea') return true;
    if (field.fieldType === 'text' && isNotesField(field)) return true;
    return false;
  }, [field]);

  // Validation
  const hasError = showValidation && field.isRequired && !value;

  const renderField = () => {
    // In readonly mode, use a no-op onChange handler
    const effectiveOnChange = readonly ? () => {} : onChange;
    
    switch (field.fieldType) {
      case 'text':
        return shouldBeMultiline 
          ? <TextAreaField field={field} value={value} onChange={effectiveOnChange} hasError={hasError} readonly={readonly} />
          : <TextField field={field} value={value} onChange={effectiveOnChange} hasError={hasError} readonly={readonly} />;
      
      case 'textArea':
        return <TextAreaField field={field} value={value} onChange={effectiveOnChange} hasError={hasError} readonly={readonly} />;
      
      case 'number':
        return <NumberField field={field} value={value} onChange={effectiveOnChange} hasError={hasError} readonly={readonly} />;
      
      case 'select':
        return <SelectField field={field} options={options} value={value} onChange={effectiveOnChange} hasError={hasError} readonly={readonly} />;
      
      case 'radio':
        return <RadioField field={field} options={options} value={value} onChange={effectiveOnChange} hasError={hasError} readonly={readonly} />;
      
      case 'checkbox':
        return <CheckboxField field={field} options={options} value={value} onChange={effectiveOnChange} hasError={hasError} readonly={readonly} />;
      
      case 'slider':
        return <SliderField field={field} value={value} onChange={effectiveOnChange} hasError={hasError} readonly={readonly} />;
      
      case 'extendedList':
        return <SearchableSelectField field={field} options={options} value={value} onChange={effectiveOnChange} hasError={hasError} readonly={readonly} />;
      
      case 'readonlyInfo':
        return <ReadonlyInfoField field={field} />;
      
      case 'date':
        return <DateField field={field} value={value} onChange={effectiveOnChange} hasError={hasError} readonly={readonly} />;
      
      default:
        return shouldBeMultiline 
          ? <TextAreaField field={field} value={value} onChange={effectiveOnChange} hasError={hasError} readonly={readonly} />
          : <TextField field={field} value={value} onChange={effectiveOnChange} hasError={hasError} readonly={readonly} />;
    }
  };

  return (
    <View style={styles.container}>
      {/* Label */}
      <View style={styles.labelRow}>
        <View style={styles.labelContainer}>
          <Text style={styles.label}>
            {field.label}
            {field.isRequired && <Text style={styles.required}> *</Text>}
          </Text>
          {field.logicalDataColumnNumber && (
            <Text style={styles.columnNumber}>
              #{field.logicalDataColumnNumber}
            </Text>
          )}
        </View>
        
        {onCommentChange && field.fieldType !== 'readonlyInfo' && !readonly && (
          <TouchableOpacity 
            onPress={() => setShowComment(!showComment)}
            style={styles.commentToggle}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon 
              name={showComment ? 'comment-text' : 'comment-plus-outline'} 
              size={22} 
              color={showComment ? colors.primary : colors.textSecondary} 
            />
          </TouchableOpacity>
        )}
      </View>
      
      {/* Question / Description */}
      {(field.question || field.description) && (
        <Text style={styles.description}>
          {field.question || field.description}
        </Text>
      )}
      
      {/* Field */}
      <View style={styles.fieldWrapper}>
        {renderField()}
      </View>
      
      {/* Validation Error */}
      {hasError && !readonly && (
        <View style={styles.errorContainer}>
          <Icon name="alert-circle" size={14} color={colors.error} />
          <Text style={styles.errorText}>To pole jest wymagane</Text>
        </View>
      )}
      
      {/* Comment - show in readonly only if there's a comment */}
      {((showComment && onCommentChange) || (readonly && comment)) && (
        <View style={styles.commentContainer}>
          <TextInput
            mode="outlined"
            label="Komentarz / Uwagi"
            value={comment || ''}
            onChangeText={readonly ? () => {} : onCommentChange!}
            multiline
            numberOfLines={2}
            style={[styles.commentInput, readonly && styles.readonlyInput]}
            outlineColor={colors.outline}
            activeOutlineColor={colors.primary}
            placeholder={readonly ? '' : 'Dodaj komentarz do odpowiedzi...'}
            disabled={readonly}
            editable={!readonly}
          />
        </View>
      )}
    </View>
  );
}

// -----------------------------------------------------------------------------
// Field Type Components - Large tablet-friendly design
// -----------------------------------------------------------------------------

interface FieldProps {
  field: FormField;
  value: string | null;
  onChange: (v: string | null) => void;
  hasError?: boolean;
  readonly?: boolean;
}

interface OptionsFieldProps extends FieldProps {
  options: OptionValue[];
}

function TextField({ field, value, onChange, hasError, readonly }: FieldProps) {
  return (
    <TextInput
      mode="outlined"
      value={value || ''}
      onChangeText={(text) => onChange(text || null)}
      placeholder={readonly ? '' : `Wprowadź ${field.label.toLowerCase()}`}
      style={[styles.textInput, readonly && styles.readonlyInput]}
      outlineColor={hasError ? colors.error : readonly ? colors.outline : colors.outline}
      activeOutlineColor={hasError ? colors.error : colors.primary}
      error={hasError}
      disabled={readonly}
      editable={!readonly}
    />
  );
}

function TextAreaField({ field, value, onChange, hasError, readonly }: FieldProps) {
  return (
    <TextInput
      mode="outlined"
      value={value || ''}
      onChangeText={(text) => onChange(text || null)}
      placeholder={readonly ? '' : `Wprowadź ${field.label.toLowerCase()}`}
      multiline
      numberOfLines={4}
      style={[styles.textInput, styles.textArea, readonly && styles.readonlyInput]}
      outlineColor={hasError ? colors.error : colors.outline}
      activeOutlineColor={hasError ? colors.error : colors.primary}
      error={hasError}
      disabled={readonly}
      editable={!readonly}
    />
  );
}

function NumberField({ field, value, onChange, hasError, readonly }: FieldProps) {
  return (
    <TextInput
      mode="outlined"
      value={value || ''}
      onChangeText={(text) => onChange(text || null)}
      keyboardType="numeric"
      placeholder={readonly ? '' : '0'}
      style={[styles.textInput, readonly && styles.readonlyInput]}
      outlineColor={hasError ? colors.error : colors.outline}
      activeOutlineColor={hasError ? colors.error : colors.primary}
      error={hasError}
      disabled={readonly}
      editable={!readonly}
    />
  );
}

function DateField({ field, value, onChange, hasError, readonly }: FieldProps) {
  const [showPicker, setShowPicker] = useState(false);
  
  // Parse value to Date object
  const dateValue = useMemo(() => {
    if (!value) return new Date();
    try {
      const parsed = new Date(value);
      return isNaN(parsed.getTime()) ? new Date() : parsed;
    } catch {
      return new Date();
    }
  }, [value]);

  // Format date for display
  const displayValue = useMemo(() => {
    if (!value) return '';
    try {
      const date = new Date(value);
      if (isNaN(date.getTime())) return value;
      return date.toLocaleDateString('pl-PL', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
    } catch {
      return value;
    }
  }, [value]);

  const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    // On Android, picker closes automatically
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }
    
    if (event.type === 'set' && selectedDate) {
      // Format as ISO date string (YYYY-MM-DD)
      const isoDate = selectedDate.toISOString().split('T')[0];
      onChange(isoDate);
    }
    
    if (event.type === 'dismissed') {
      setShowPicker(false);
    }
  };

  const handleConfirm = () => {
    setShowPicker(false);
  };

  return (
    <View pointerEvents={readonly ? 'none' : 'auto'}>
      <TouchableOpacity
        style={[
          styles.datePickerButton,
          hasError && styles.datePickerButtonError,
          readonly && styles.readonlyField
        ]}
        onPress={() => !readonly && setShowPicker(true)}
        activeOpacity={readonly ? 1 : 0.7}
        disabled={readonly}
      >
        <Icon name="calendar" size={24} color={readonly ? colors.textDisabled : colors.primary} />
        <Text style={[
          styles.datePickerValue,
          !value && styles.datePickerPlaceholder,
          readonly && styles.readonlyFieldText
        ]}>
          {displayValue || (readonly ? '-' : 'Wybierz datę...')}
        </Text>
        {value && !readonly && (
          <TouchableOpacity
            onPress={() => onChange(null)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon name="close-circle" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      {showPicker && (
        Platform.OS === 'ios' ? (
          <Portal>
            <Modal
              visible={showPicker}
              onDismiss={() => setShowPicker(false)}
              contentContainerStyle={styles.datePickerModal}
            >
              <View style={styles.datePickerModalHeader}>
                <Text style={styles.datePickerModalTitle}>Wybierz datę</Text>
                <TouchableOpacity onPress={handleConfirm}>
                  <Text style={styles.datePickerModalDone}>Gotowe</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={dateValue}
                mode="date"
                display="spinner"
                onChange={handleDateChange}
                locale="pl-PL"
                style={styles.iosDatePicker}
              />
            </Modal>
          </Portal>
        ) : (
          <DateTimePicker
            value={dateValue}
            mode="date"
            display="default"
            onChange={handleDateChange}
          />
        )
      )}
    </View>
  );
}

function SelectField({ field, options, value, onChange, hasError, readonly }: OptionsFieldProps) {
  if (options.length <= 5) {
    return (
      <View style={[styles.selectContainer, hasError && styles.selectContainerError, readonly && styles.readonlyField]} pointerEvents={readonly ? 'none' : 'auto'}>
        {options.map((option) => (
          <TouchableOpacity
            key={option.id}
            style={[
              styles.selectChip,
              value === option.value && styles.selectChipSelected,
              readonly && value !== option.value && styles.readonlyChipUnselected
            ]}
            onPress={() => !readonly && onChange(value === option.value ? null : option.value)}
            activeOpacity={readonly ? 1 : 0.7}
            disabled={readonly}
          >
            <Text style={[
              styles.selectChipText,
              value === option.value && styles.selectChipTextSelected,
              readonly && value !== option.value && styles.readonlyChipTextUnselected
            ]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  return (
    <SearchableSelectField field={field} options={options} value={value} onChange={onChange} hasError={hasError} readonly={readonly} />
  );
}

function RadioField({ field, options, value, onChange, hasError, readonly }: OptionsFieldProps) {
  return (
    <View style={[styles.radioContainer, hasError && styles.radioContainerError, readonly && styles.readonlyField]} pointerEvents={readonly ? 'none' : 'auto'}>
      {options.map((option) => {
        const isSelected = value === option.value;
        return (
          <TouchableOpacity
            key={option.id}
            style={[
              styles.radioItem,
              isSelected && styles.radioItemSelected,
              readonly && !isSelected && styles.readonlyItemUnselected
            ]}
            onPress={() => !readonly && onChange(option.value)}
            activeOpacity={readonly ? 1 : 0.7}
            disabled={readonly}
          >
            <View style={[
              styles.radioCircle,
              isSelected && styles.radioCircleSelected,
              readonly && !isSelected && styles.readonlyCircle
            ]}>
              {isSelected && <View style={styles.radioCircleInner} />}
            </View>
            <Text style={[
              styles.radioLabel,
              isSelected && styles.radioLabelSelected,
              readonly && !isSelected && styles.readonlyLabelUnselected
            ]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function CheckboxField({ field, options, value, onChange, hasError, readonly }: OptionsFieldProps) {
  const selectedValues = useMemo(() => {
    return value ? value.split(',').filter(Boolean) : [];
  }, [value]);

  const toggleValue = useCallback((optionValue: string) => {
    if (readonly) return;
    let newValues: string[];
    if (selectedValues.includes(optionValue)) {
      newValues = selectedValues.filter(v => v !== optionValue);
    } else {
      newValues = [...selectedValues, optionValue];
    }
    onChange(newValues.length > 0 ? newValues.join(',') : null);
  }, [selectedValues, onChange, readonly]);

  // If no options, render as simple boolean checkbox
  if (options.length === 0) {
    const isChecked = value === 'true';
    return (
      <TouchableOpacity
        style={[
          styles.checkboxItem,
          isChecked && styles.checkboxItemSelected,
          hasError && styles.checkboxItemError,
          readonly && styles.readonlyField
        ]}
        onPress={() => !readonly && onChange(isChecked ? null : 'true')}
        activeOpacity={readonly ? 1 : 0.7}
        disabled={readonly}
      >
        <View style={[
          styles.checkboxBox,
          isChecked && styles.checkboxBoxSelected,
          readonly && !isChecked && styles.readonlyCheckbox
        ]}>
          {isChecked && <Icon name="check" size={16} color={colors.primaryForeground} />}
        </View>
        <Text style={[
          styles.checkboxLabel,
          isChecked && styles.checkboxLabelSelected,
          readonly && !isChecked && styles.readonlyLabelUnselected
        ]}>
          Tak
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.checkboxContainer, hasError && styles.checkboxContainerError, readonly && styles.readonlyField]} pointerEvents={readonly ? 'none' : 'auto'}>
      {options.map((option) => {
        const isChecked = selectedValues.includes(option.value);
        return (
          <TouchableOpacity
            key={option.id}
            style={[
              styles.checkboxItem,
              isChecked && styles.checkboxItemSelected,
              readonly && !isChecked && styles.readonlyItemUnselected
            ]}
            onPress={() => toggleValue(option.value)}
            activeOpacity={readonly ? 1 : 0.7}
            disabled={readonly}
          >
            <View style={[
              styles.checkboxBox,
              isChecked && styles.checkboxBoxSelected,
              readonly && !isChecked && styles.readonlyCheckbox
            ]}>
              {isChecked && <Icon name="check" size={16} color={colors.primaryForeground} />}
            </View>
            <Text style={[
              styles.checkboxLabel,
              isChecked && styles.checkboxLabelSelected,
              readonly && !isChecked && styles.readonlyLabelUnselected
            ]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function SliderField({ field, value, onChange, hasError, readonly }: FieldProps) {
  const numValue = value ? parseInt(value, 10) : 0;
  const steps = [0, 25, 50, 75, 100];
  
  return (
    <View style={[styles.sliderContainer, hasError && styles.sliderContainerError, readonly && styles.readonlyField]} pointerEvents={readonly ? 'none' : 'auto'}>
      <View style={styles.sliderValueRow}>
        <Text style={[styles.sliderValue, readonly && styles.readonlyFieldText]}>{numValue}%</Text>
      </View>
      <View style={styles.sliderButtons}>
        {steps.map((val) => {
          const isActive = numValue === val;
          return (
            <TouchableOpacity
              key={val}
              style={[
                styles.sliderButton,
                isActive && styles.sliderButtonActive,
                readonly && !isActive && styles.readonlySliderButton
              ]}
              onPress={() => !readonly && onChange(val.toString())}
              activeOpacity={readonly ? 1 : 0.7}
              disabled={readonly}
            >
              <Text style={[
                styles.sliderButtonText,
                isActive && styles.sliderButtonTextActive,
                readonly && !isActive && styles.readonlySliderButtonText
              ]}>
                {val}%
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function SearchableSelectField({ field, options, value, onChange, hasError, readonly }: OptionsFieldProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredOptions = useMemo(() => {
    if (!searchQuery) return options;
    const query = searchQuery.toLowerCase();
    return options.filter(o => 
      o.label.toLowerCase().includes(query) ||
      o.value.toLowerCase().includes(query)
    );
  }, [options, searchQuery]);

  const selectedOption = useMemo(() => {
    return options.find(o => o.value === value);
  }, [options, value]);

  const handleSelect = (optionValue: string) => {
    if (readonly) return;
    onChange(optionValue);
    setModalVisible(false);
    setSearchQuery('');
  };

  return (
    <>
      <TouchableOpacity
        style={[
          styles.searchSelectButton,
          hasError && styles.searchSelectButtonError,
          readonly && styles.readonlyField
        ]}
        onPress={() => !readonly && setModalVisible(true)}
        activeOpacity={readonly ? 1 : 0.7}
        disabled={readonly}
      >
        <View style={styles.searchSelectContent}>
          {selectedOption ? (
            <Text style={[styles.searchSelectValue, readonly && styles.readonlyFieldText]}>{selectedOption.label}</Text>
          ) : (
            <Text style={styles.searchSelectPlaceholder}>{readonly ? '-' : 'Wybierz z listy...'}</Text>
          )}
        </View>
        {!readonly && (
          <Icon 
            name="chevron-down" 
            size={24} 
            color={colors.textSecondary} 
          />
        )}
      </TouchableOpacity>

      <Portal>
        <Modal
          visible={modalVisible}
          onDismiss={() => {
            setModalVisible(false);
            setSearchQuery('');
          }}
          contentContainerStyle={styles.searchSelectModal}
        >
          <View style={styles.searchSelectModalHeader}>
            <Text style={styles.searchSelectModalTitle}>{field.label}</Text>
            <TouchableOpacity 
              onPress={() => setModalVisible(false)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Icon name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Searchbar
            placeholder="Szukaj..."
            onChangeText={setSearchQuery}
            value={searchQuery}
            style={styles.searchSelectSearchbar}
            inputStyle={styles.searchSelectSearchbarInput}
          />

          <View style={styles.searchSelectList}>
            {filteredOptions.map((option) => {
              const isSelected = value === option.value;
              return (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.searchSelectItem,
                    isSelected && styles.searchSelectItemSelected
                  ]}
                  onPress={() => handleSelect(option.value)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.searchSelectItemText,
                    isSelected && styles.searchSelectItemTextSelected
                  ]}>
                    {option.label}
                  </Text>
                  {isSelected && (
                    <Icon name="check" size={20} color={colors.primary} />
                  )}
                </TouchableOpacity>
              );
            })}

            {filteredOptions.length === 0 && (
              <View style={styles.searchSelectEmpty}>
                <Icon name="magnify-close" size={32} color={colors.textDisabled} />
                <Text style={styles.searchSelectEmptyText}>Brak wyników</Text>
              </View>
            )}
          </View>

          {value && (
            <TouchableOpacity
              style={styles.searchSelectClearButton}
              onPress={() => {
                onChange(null);
                setModalVisible(false);
              }}
            >
              <Icon name="close-circle" size={18} color={colors.error} />
              <Text style={styles.searchSelectClearText}>Wyczyść wybór</Text>
            </TouchableOpacity>
          )}
        </Modal>
      </Portal>
    </>
  );
}

function ReadonlyInfoField({ field }: { field: FormField }) {
  return (
    <View style={styles.readonlyContainer}>
      <Icon name="information-outline" size={24} color={colors.info} />
      <Text style={styles.readonlyText}>
        {field.description || field.question || field.label}
      </Text>
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles - Large, tablet-friendly design
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    marginBottom: screen.isTablet ? spacing.lg : spacing.md,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  labelContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  label: {
    ...typography.titleMedium,
    color: colors.textPrimary,
    fontSize: screen.isTablet ? 18 : 17,
  },
  required: {
    color: colors.error,
    fontWeight: '600',
  },
  columnNumber: {
    ...typography.labelSmall,
    color: colors.textDisabled,
    backgroundColor: colors.surfaceVariant,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  commentToggle: {
    padding: spacing.sm,
    marginLeft: spacing.sm,
  },
  description: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    lineHeight: 22,
  },
  fieldWrapper: {
    marginTop: spacing.xs,
  },
  
  // Error
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.error,
  },
  
  // Text Input
  textInput: {
    backgroundColor: colors.surface,
    fontSize: screen.isTablet ? 17 : 16,
  },
  textArea: {
    minHeight: screen.isTablet ? 150 : 120,
    textAlignVertical: 'top',
  },
  
  // Select (Chip style)
  selectContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  selectContainerError: {
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
  },
  selectChip: {
    paddingVertical: screen.isTablet ? spacing.lg : spacing.md,
    paddingHorizontal: screen.isTablet ? spacing.xl : spacing.lg,
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: 'transparent',
    minHeight: screen.isTablet ? 56 : 48,
    justifyContent: 'center',
  },
  selectChipSelected: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  selectChipText: {
    ...typography.labelLarge,
    color: colors.textSecondary,
    fontSize: 15,
  },
  selectChipTextSelected: {
    color: colors.primaryDark,
    fontWeight: '600',
  },
  
  // Radio
  radioContainer: {
    gap: spacing.sm,
  },
  radioContainerError: {
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
  },
  radioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.outline,
    minHeight: 56,
  },
  radioItemSelected: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  radioCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.outline,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  radioCircleSelected: {
    borderColor: colors.primary,
  },
  radioCircleInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  radioLabel: {
    ...typography.bodyLarge,
    color: colors.textPrimary,
    flex: 1,
  },
  radioLabelSelected: {
    color: colors.primaryDark,
    fontWeight: '500',
  },
  
  // Checkbox
  checkboxContainer: {
    gap: spacing.sm,
  },
  checkboxContainerError: {
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
  },
  checkboxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.outline,
    minHeight: 56,
  },
  checkboxItemSelected: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  checkboxItemError: {
    borderColor: colors.error,
  },
  checkboxBox: {
    width: 24,
    height: 24,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    borderColor: colors.outline,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  checkboxBoxSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxLabel: {
    ...typography.bodyLarge,
    color: colors.textPrimary,
    flex: 1,
  },
  checkboxLabelSelected: {
    color: colors.primaryDark,
    fontWeight: '500',
  },
  
  // Slider
  sliderContainer: {
    paddingVertical: spacing.md,
  },
  sliderContainerError: {
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  sliderValueRow: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  sliderValue: {
    ...typography.headlineLarge,
    color: colors.primary,
    fontWeight: '700',
  },
  sliderButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  sliderButton: {
    flex: 1,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: 'transparent',
    minHeight: 56,
    justifyContent: 'center',
  },
  sliderButtonActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  sliderButtonText: {
    ...typography.labelLarge,
    color: colors.textSecondary,
  },
  sliderButtonTextActive: {
    color: colors.primaryDark,
    fontWeight: '600',
  },
  
  // Searchable Select
  searchSelectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.outline,
    minHeight: 56,
  },
  searchSelectButtonError: {
    borderColor: colors.error,
  },
  searchSelectContent: {
    flex: 1,
  },
  searchSelectValue: {
    ...typography.bodyLarge,
    color: colors.textPrimary,
  },
  searchSelectPlaceholder: {
    ...typography.bodyLarge,
    color: colors.textDisabled,
  },
  searchSelectModal: {
    backgroundColor: colors.surface,
    margin: spacing.lg,
    borderRadius: borderRadius.xl,
    maxHeight: '80%',
  },
  searchSelectModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  searchSelectModalTitle: {
    ...typography.titleLarge,
    color: colors.textPrimary,
  },
  searchSelectSearchbar: {
    margin: spacing.md,
    backgroundColor: colors.surfaceVariant,
    elevation: 0,
  },
  searchSelectSearchbarInput: {
    ...typography.bodyLarge,
  },
  searchSelectList: {
    maxHeight: 400,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  searchSelectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
  },
  searchSelectItemSelected: {
    backgroundColor: colors.primaryLight,
  },
  searchSelectItemText: {
    ...typography.bodyLarge,
    color: colors.textPrimary,
  },
  searchSelectItemTextSelected: {
    color: colors.primaryDark,
    fontWeight: '500',
  },
  searchSelectEmpty: {
    alignItems: 'center',
    padding: spacing.xxl,
  },
  searchSelectEmptyText: {
    ...typography.bodyLarge,
    color: colors.textDisabled,
    marginTop: spacing.md,
  },
  searchSelectClearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
    gap: spacing.sm,
  },
  searchSelectClearText: {
    ...typography.labelLarge,
    color: colors.error,
  },
  
  // Readonly info field
  readonlyContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.infoLight,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    gap: spacing.md,
  },
  readonlyText: {
    ...typography.bodyLarge,
    color: colors.infoDark,
    flex: 1,
    lineHeight: 24,
  },
  
  // Readonly form fields (disabled state)
  readonlyInput: {
    backgroundColor: colors.surfaceVariant,
  },
  readonlyField: {
    backgroundColor: colors.surfaceVariant,
    opacity: 0.9,
  },
  readonlyFieldText: {
    color: colors.textSecondary,
  },
  readonlyChipUnselected: {
    opacity: 0.4,
    borderColor: colors.outline,
  },
  readonlyChipTextUnselected: {
    color: colors.textDisabled,
  },
  readonlyItemUnselected: {
    opacity: 0.4,
  },
  readonlyCircle: {
    borderColor: colors.textDisabled,
  },
  readonlyLabelUnselected: {
    color: colors.textDisabled,
  },
  readonlyCheckbox: {
    borderColor: colors.textDisabled,
    backgroundColor: colors.surfaceVariant,
  },
  readonlySliderButton: {
    opacity: 0.4,
    borderColor: colors.outline,
  },
  readonlySliderButtonText: {
    color: colors.textDisabled,
  },

  // Date Picker
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.outline,
    minHeight: 56,
    gap: spacing.md,
  },
  datePickerButtonError: {
    borderColor: colors.error,
  },
  datePickerValue: {
    ...typography.bodyLarge,
    color: colors.textPrimary,
    flex: 1,
  },
  datePickerPlaceholder: {
    color: colors.textDisabled,
  },
  datePickerModal: {
    backgroundColor: colors.surface,
    margin: spacing.lg,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  datePickerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  datePickerModalTitle: {
    ...typography.titleLarge,
    color: colors.textPrimary,
  },
  datePickerModalDone: {
    ...typography.labelLarge,
    color: colors.primary,
    fontWeight: '600',
  },
  iosDatePicker: {
    height: 200,
  },
  
  // Comment
  commentContainer: {
    marginTop: spacing.md,
  },
  commentInput: {
    backgroundColor: colors.surface,
  },
});
