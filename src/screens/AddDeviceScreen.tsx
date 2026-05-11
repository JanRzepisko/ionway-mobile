// =============================================================================
// Add Device Screen - Create new device offline with smart suggestions
// Premium enterprise tablet design
// =============================================================================

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity, FlatList, Modal as RNModal, TextInput as RNTextInput } from 'react-native';
import { Text, TextInput, HelperText, Divider } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useProjectStore } from '../stores/projectStore';
import { useAuthStore } from '../stores/authStore';
import {
  getDistinctBuildings,
  getDistinctLevels,
  getDistinctZones,
  getDistinctSystems,
  getDistinctGroups,
  getDistinctTypes,
  getDistinctDrawingNumbers,
} from '../database/devices';

type RootStackParamList = {
  Devices: undefined;
  AddDevice: undefined;
  AuditForm: { deviceId: string };
};

interface FormData {
  name: string;
  building: string;
  level: string;
  zone: string;
  system: string;
  group: string;
  type: string;
  drawingNumber: string;
  routeNumber: string;
  disciplineCode: string;
}

interface SuggestionModalProps {
  visible: boolean;
  title: string;
  icon: string;
  options: string[];
  value: string;
  onSelect: (value: string) => void;
  onClose: () => void;
  allowCustom?: boolean;
}

function SuggestionModal({
  visible,
  title,
  icon,
  options,
  value,
  onSelect,
  onClose,
  allowCustom = true,
}: SuggestionModalProps) {
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [customValue, setCustomValue] = useState('');

  useEffect(() => {
    if (visible) {
      setSearchQuery('');
      setCustomValue(value);
    }
  }, [visible, value]);

  const filteredOptions = useMemo(() => {
    if (!searchQuery) return options;
    const query = searchQuery.toLowerCase();
    return options.filter(o => o.toLowerCase().includes(query));
  }, [options, searchQuery]);

  const handleSelect = (val: string) => {
    onSelect(val);
    onClose();
  };

  const handleConfirmCustom = () => {
    if (customValue.trim()) {
      onSelect(customValue.trim());
      onClose();
    }
  };

  return (
    <RNModal
      visible={visible}
      onRequestClose={onClose}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View style={[styles.suggestionModalContainer, { paddingTop: insets.top }]}>
        <View style={styles.suggestionModalHeader}>
          <View style={styles.suggestionModalIconContainer}>
            <Icon name={icon} size={28} color={colors.primary} />
          </View>
          <Text style={styles.suggestionModalTitle}>{title}</Text>
          <TouchableOpacity onPress={onClose} style={styles.suggestionModalClose}>
            <Icon name="close" size={28} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Search bar */}
        <View style={styles.suggestionModalSearchContainer}>
          <Icon name="magnify" size={22} color={colors.textSecondary} />
          <RNTextInput
            placeholder="Szukaj..."
            placeholderTextColor={colors.textDisabled}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.suggestionModalSearchInput}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Icon name="close-circle" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {allowCustom && (
          <>
            <View style={styles.customInputContainer}>
              <RNTextInput
                placeholder="Wprowadź ręcznie..."
                placeholderTextColor={colors.textDisabled}
                value={customValue}
                onChangeText={setCustomValue}
                style={styles.customInputNative}
              />
              {customValue.trim() && (
                <TouchableOpacity 
                  style={styles.customInputConfirm}
                  onPress={handleConfirmCustom}
                >
                  <Icon name="check" size={24} color={colors.primaryForeground} />
                </TouchableOpacity>
              )}
            </View>
            {options.length > 0 && (
              <Text style={styles.suggestionModalDividerText}>
                lub wybierz z istniejących
              </Text>
            )}
          </>
        )}

        <FlatList
          data={filteredOptions}
          keyExtractor={(item) => item}
          style={styles.suggestionModalList}
          contentContainerStyle={styles.suggestionModalListContent}
          renderItem={({ item }) => {
            const isSelected = item === value;
            return (
              <TouchableOpacity
                style={[
                  styles.suggestionModalItem,
                  isSelected && styles.suggestionModalItemSelected
                ]}
                onPress={() => handleSelect(item)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.suggestionModalItemText,
                  isSelected && styles.suggestionModalItemTextSelected
                ]}>
                  {item}
                </Text>
                {isSelected && (
                  <Icon name="check" size={24} color={colors.primary} />
                )}
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            options.length === 0 ? (
              <View style={styles.suggestionModalEmpty}>
                <Icon name="folder-open-outline" size={48} color={colors.textDisabled} />
                <Text style={styles.suggestionModalEmptyText}>
                  Brak wcześniejszych wartości
                </Text>
              </View>
            ) : (
              <View style={styles.suggestionModalEmpty}>
                <Icon name="magnify-close" size={48} color={colors.textDisabled} />
                <Text style={styles.suggestionModalEmptyText}>Brak wyników</Text>
              </View>
            )
          }
        />

        {/* Done button */}
        <View style={[styles.suggestionModalFooter, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <TouchableOpacity style={styles.suggestionModalDoneButton} onPress={onClose}>
            <Text style={styles.suggestionModalDoneText}>Gotowe</Text>
          </TouchableOpacity>
        </View>
      </View>
    </RNModal>
  );
}

interface FieldWithSuggestionsProps {
  label: string;
  icon: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  required?: boolean;
  error?: string;
  helperText?: string;
  allowCustom?: boolean;
}

function FieldWithSuggestions({
  label,
  icon,
  value,
  options,
  onChange,
  required = false,
  error,
  helperText,
  allowCustom = true,
}: FieldWithSuggestionsProps) {
  const [modalVisible, setModalVisible] = useState(false);

  return (
    <>
      <TouchableOpacity
        style={[
          styles.fieldButton,
          !!value && styles.fieldButtonActive,
          !!error && styles.fieldButtonError
        ]}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.7}
      >
        <View style={[
          styles.fieldButtonIcon,
          !!value && styles.fieldButtonIconActive
        ]}>
          <Icon 
            name={icon} 
            size={22} 
            color={value ? colors.primary : colors.textSecondary} 
          />
        </View>
        <View style={styles.fieldButtonContent}>
          <Text style={styles.fieldButtonLabel}>
            {label}{required && ' *'}
          </Text>
          <Text style={[
            styles.fieldButtonValue,
            !!value && styles.fieldButtonValueActive
          ]}>
            {value || (allowCustom ? 'Wybierz lub wprowadź...' : 'Wybierz...')}
          </Text>
        </View>
        <Icon name="chevron-right" size={22} color={colors.textSecondary} />
      </TouchableOpacity>
      {error && (
        <HelperText type="error" style={styles.fieldError}>{error}</HelperText>
      )}
      {helperText && !error && (
        <HelperText type="info" style={styles.fieldHelper}>{helperText}</HelperText>
      )}

      <SuggestionModal
        visible={modalVisible}
        title={label}
        icon={icon}
        options={options}
        value={value}
        onSelect={onChange}
        onClose={() => setModalVisible(false)}
        allowCustom={allowCustom}
      />
    </>
  );
}

export function AddDeviceScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuthStore();
  const { currentProject, createDevice } = useProjectStore();

  const [formData, setFormData] = useState<FormData>({
    name: '',
    building: '',
    level: '',
    zone: '',
    system: '',
    group: '',
    type: '',
    drawingNumber: '',
    routeNumber: '',
    disciplineCode: '',
  });
  
  const [errors, setErrors] = useState<Partial<FormData>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cascading filter options
  const [buildings, setBuildings] = useState<string[]>([]);
  const [levels, setLevels] = useState<string[]>([]);
  const [zones, setZones] = useState<string[]>([]);
  const [systems, setSystems] = useState<string[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [drawingNumbers, setDrawingNumbers] = useState<string[]>([]);

  // Load initial options
  useEffect(() => {
    if (currentProject) {
      loadOptions();
    }
  }, [currentProject?.id]);

  // Update cascading options when form data changes
  useEffect(() => {
    if (currentProject) {
      loadCascadingOptions();
    }
  }, [formData.building, formData.level, formData.zone, formData.system, formData.group, formData.type]);

  const loadOptions = async () => {
    if (!currentProject) return;
    
    // Load only buildings initially - rest will be loaded by cascading
    const b = await getDistinctBuildings(currentProject.id);
    setBuildings(b);
    
    // Trigger cascading load for other fields
    loadCascadingOptions();
  };

  const loadCascadingOptions = async () => {
    if (!currentProject) return;

    const building = formData.building || undefined;
    const level = formData.level || undefined;
    const zone = formData.zone || undefined;
    const system = formData.system || undefined;
    const group = formData.group || undefined;
    const type = formData.type || undefined;

    // Load all options in parallel - always show available options, filtered by parent selections
    const [l, z, s, g, t, dn] = await Promise.all([
      // Levels - filter by building if selected, otherwise all
      getDistinctLevels(currentProject.id, building),
      
      // Zones - filter by building and/or level if selected
      getDistinctZones(currentProject.id, building, level),
      
      // Systems - filter by selections above
      getDistinctSystems(currentProject.id, building, level, zone),
      
      // Groups - filter by selections above
      getDistinctGroups(currentProject.id, { building, level, zone, system }),
      
      // Types - filter by selections above
      getDistinctTypes(currentProject.id, { building, level, zone, system, group }),
      
      // Drawing numbers - filter by all selected fields
      getDistinctDrawingNumbers(currentProject.id, { building, level, zone, system, group, type }),
    ]);

    setLevels(l);
    setZones(z);
    setSystems(s);
    setGroups(g);
    setTypes(t);
    setDrawingNumbers(dn);
  };

  const updateField = useCallback(async (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
    
    // Auto-fill parent fields if they can be uniquely determined
    if (currentProject && value) {
      const autoFillParents = async () => {
        const db = await import('../database');
        const newData: Partial<FormData> = {};
        
        // When selecting a lower field, try to find unique parent values
        if (field === 'level' && !formData.building) {
          // Find which building this level is in
          const buildings = await db.getDistinctBuildings(currentProject.id);
          for (const b of buildings) {
            const levelsInBuilding = await db.getDistinctLevels(currentProject.id, b);
            if (levelsInBuilding.includes(value)) {
              // Check if this level only exists in one building
              const matchingBuildings = [];
              for (const building of buildings) {
                const levels = await db.getDistinctLevels(currentProject.id, building);
                if (levels.includes(value)) matchingBuildings.push(building);
              }
              if (matchingBuildings.length === 1) {
                newData.building = matchingBuildings[0];
              }
              break;
            }
          }
        }
        
        if (field === 'zone' && (!formData.building || !formData.level)) {
          // Find building and level for this zone
          const buildings = formData.building ? [formData.building] : await db.getDistinctBuildings(currentProject.id);
          let foundBuilding: string | undefined;
          let foundLevel: string | undefined;
          let uniqueMatch = true;
          
          for (const b of buildings) {
            const levels = await db.getDistinctLevels(currentProject.id, b);
            for (const l of levels) {
              const zones = await db.getDistinctZones(currentProject.id, b, l);
              if (zones.includes(value)) {
                if (foundBuilding && (foundBuilding !== b || foundLevel !== l)) {
                  uniqueMatch = false;
                  break;
                }
                foundBuilding = b;
                foundLevel = l;
              }
            }
            if (!uniqueMatch) break;
          }
          
          if (uniqueMatch && foundBuilding && foundLevel) {
            if (!formData.building) newData.building = foundBuilding;
            if (!formData.level) newData.level = foundLevel;
          }
        }
        
        if (Object.keys(newData).length > 0) {
          setFormData(prev => ({ ...prev, ...newData }));
        }
      };
      
      autoFillParents();
    }
  }, [errors, currentProject, formData.building, formData.level]);

  const validate = (): boolean => {
    const newErrors: Partial<FormData> = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Nazwa jest wymagana';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate() || !user) return;
    
    setIsSubmitting(true);
    
    try {
      const device = await createDevice(
        {
          name: formData.name.trim(),
          building: formData.building.trim() || undefined,
          level: formData.level.trim() || undefined,
          zone: formData.zone.trim() || undefined,
          system: formData.system.trim() || undefined,
          group: formData.group.trim() || undefined,
          type: formData.type.trim() || undefined,
          drawingNumber: formData.drawingNumber.trim() || undefined,
          routeNumber: formData.routeNumber.trim() || undefined,
          disciplineCode: formData.disciplineCode.trim() || undefined,
        },
        user.id,
        user.firstName,
        user.lastName
      );

      Alert.alert(
        'Element dodany',
        `Element "${device.name}" został dodany lokalnie.\n\nZnacznik: ${device.znacznik}\n\nZostanie zsynchronizowany po połączeniu z internetem.`,
        [
          { 
            text: 'Rozpocznij audyt', 
            onPress: () => navigation.replace('AuditForm', { deviceId: device.id })
          },
          { 
            text: 'Wróć do listy', 
            onPress: () => navigation.goBack(),
            style: 'cancel'
          }
        ]
      );
    } catch (error) {
      Alert.alert(
        'Błąd',
        error instanceof Error ? error.message : 'Nie udało się dodać urządzenia'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!currentProject) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Brak wybranego projektu</Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <View style={styles.header}>
        <Button mode="text" onPress={() => navigation.goBack()} icon="close" size="small">
          Anuluj
        </Button>
      </View>

      <View style={styles.titleContainer}>
        <View style={styles.titleIcon}>
          <Icon name="plus-circle" size={32} color={colors.success} />
        </View>
        <View>
          <Text style={styles.title}>Dodaj urządzenie</Text>
          <Text style={styles.subtitle}>Projekt: {currentProject.name}</Text>
        </View>
      </View>

      <View style={styles.infoBanner}>
        <Icon name="information-outline" size={20} color={colors.info} />
        <Text style={styles.infoBannerText}>
          Urządzenie zostanie zapisane lokalnie i zsynchronizowane po połączeniu z internetem.
        </Text>
      </View>

      {/* Basic info */}
      <Card variant="outlined" style={styles.formCard}>
        <View style={styles.sectionHeader}>
          <Icon name="information-outline" size={20} color={colors.primary} />
          <Text style={styles.sectionTitle}>Podstawowe informacje</Text>
        </View>
        
        <View style={styles.field}>
          <TextInput
            mode="outlined"
            label="Nazwa urządzenia *"
            value={formData.name}
            onChangeText={(v) => updateField('name', v)}
            error={!!errors.name}
            style={styles.input}
            outlineColor={colors.outline}
            activeOutlineColor={colors.primary}
          />
          {errors.name && (
            <HelperText type="error">{errors.name}</HelperText>
          )}
        </View>
        
        <FieldWithSuggestions
          label="Typ urządzenia"
          icon="tag-outline"
          value={formData.type}
          options={types}
          onChange={(v) => updateField('type', v)}
          helperText={types.length > 0 ? `${types.length} dostępnych typów` : undefined}
        />
      </Card>

      {/* Element */}
      <Card variant="outlined" style={styles.formCard}>
        <View style={styles.sectionHeader}>
          <Icon name="map-marker-outline" size={20} color={colors.primary} />
          <Text style={styles.sectionTitle}>Element</Text>
        </View>
        
        <Text style={styles.sectionDescription}>
          Wybierz element kaskadowo. Każdy kolejny wybór zawęża dostępne opcje.
        </Text>

        <FieldWithSuggestions
          label="Budynek"
          icon="office-building"
          value={formData.building}
          options={buildings}
          onChange={(v) => updateField('building', v)}
        />
        
        <FieldWithSuggestions
          label="Poziom / Kondygnacja"
          icon="layers"
          value={formData.level}
          options={levels}
          onChange={(v) => updateField('level', v)}
        />
        
        <FieldWithSuggestions
          label="Strefa"
          icon="map-marker-radius"
          value={formData.zone}
          options={zones}
          onChange={(v) => updateField('zone', v)}
        />
        
        <FieldWithSuggestions
          label="Układ / System"
          icon="sitemap"
          value={formData.system}
          options={systems}
          onChange={(v) => updateField('system', v)}
        />
        
        <FieldWithSuggestions
          label="Grupa"
          icon="group"
          value={formData.group}
          options={groups}
          onChange={(v) => updateField('group', v)}
        />
      </Card>

      {/* Additional data */}
      <Card variant="outlined" style={styles.formCard}>
        <View style={styles.sectionHeader}>
          <Icon name="file-document-outline" size={20} color={colors.primary} />
          <Text style={styles.sectionTitle}>Dane dodatkowe</Text>
        </View>
        
        <FieldWithSuggestions
          label="Numer rysunku"
          icon="file-document-outline"
          value={formData.drawingNumber}
          options={drawingNumbers}
          onChange={(v) => updateField('drawingNumber', v)}
          allowCustom={false}
        />
        
        <View style={styles.field}>
          <TextInput
            mode="outlined"
            label="Numer trasy"
            value={formData.routeNumber}
            onChangeText={(v) => updateField('routeNumber', v)}
            style={styles.input}
            outlineColor={colors.outline}
            activeOutlineColor={colors.primary}
          />
        </View>
        
        <View style={styles.field}>
          <TextInput
            mode="outlined"
            label="Oznaczenie branżowe"
            value={formData.disciplineCode}
            onChangeText={(v) => updateField('disciplineCode', v)}
            style={styles.input}
            outlineColor={colors.outline}
            activeOutlineColor={colors.primary}
          />
        </View>
      </Card>

      {/* Actions */}
      <View style={styles.actions}>
        <Button
          mode="outlined"
          onPress={() => navigation.goBack()}
          size="large"
          style={styles.cancelButton}
        >
          Anuluj
        </Button>
        
        <Button
          onPress={handleSubmit}
          loading={isSubmitting}
          disabled={isSubmitting || !formData.name.trim()}
          icon="plus"
          size="large"
          color="success"
          style={styles.submitButton}
        >
          Dodaj urządzenie
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingBottom: spacing.xxl,
  },
  header: {
    padding: spacing.md,
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  titleIcon: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.successLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.headlineLarge,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginTop: 2,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.infoLight,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  infoBannerText: {
    ...typography.bodyMedium,
    color: colors.infoDark,
    flex: 1,
  },
  formCard: {
    margin: spacing.lg,
    marginTop: 0,
    marginBottom: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.titleMedium,
    color: colors.textPrimary,
  },
  sectionDescription: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  field: {
    marginBottom: spacing.md,
  },
  input: {
    backgroundColor: colors.surface,
  },
  
  // Field with suggestions
  fieldButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.outline,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  fieldButtonActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  fieldButtonError: {
    borderColor: colors.error,
  },
  fieldButtonIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldButtonIconActive: {
    backgroundColor: colors.surface,
  },
  fieldButtonContent: {
    flex: 1,
  },
  fieldButtonLabel: {
    ...typography.labelSmall,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fieldButtonValue: {
    ...typography.bodyLarge,
    color: colors.textDisabled,
    marginTop: 2,
  },
  fieldButtonValueActive: {
    color: colors.primaryDark,
    fontWeight: '500',
  },
  fieldError: {
    marginTop: -spacing.xs,
    marginBottom: spacing.sm,
  },
  fieldHelper: {
    marginTop: -spacing.xs,
    marginBottom: spacing.sm,
  },
  
  // Suggestion modal (native)
  suggestionModalContainer: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  suggestionModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
    gap: spacing.md,
  },
  suggestionModalIconContainer: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
  },
  suggestionModalClose: {
    padding: spacing.sm,
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.full,
  },
  suggestionModalSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginHorizontal: spacing.xl,
    marginVertical: spacing.lg,
    gap: spacing.sm,
    height: 52,
  },
  suggestionModalSearchInput: {
    flex: 1,
    fontSize: 17,
    color: colors.textPrimary,
    padding: 0,
  },
  customInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  customInputNative: {
    flex: 1,
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 17,
    color: colors.textPrimary,
    height: 52,
  },
  customInputConfirm: {
    width: 52,
    height: 52,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionModalDividerText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.md,
    backgroundColor: colors.surfaceVariant,
    marginHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  suggestionModalList: {
    flex: 1,
  },
  suggestionModalListContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
  },
  suggestionModalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
    minHeight: 60,
  },
  suggestionModalItemSelected: {
    backgroundColor: colors.primaryLight,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  suggestionModalItemText: {
    fontSize: 17,
    color: colors.textPrimary,
    flex: 1,
  },
  suggestionModalItemTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  suggestionModalEmpty: {
    alignItems: 'center',
    paddingVertical: spacing.xxl * 2,
    gap: spacing.md,
  },
  suggestionModalEmptyText: {
    fontSize: 16,
    color: colors.textDisabled,
    textAlign: 'center',
  },
  suggestionModalFooter: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
  },
  suggestionModalDoneButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    minHeight: 56,
    justifyContent: 'center',
  },
  suggestionModalDoneText: {
    fontSize: 18,
    color: colors.primaryForeground,
    fontWeight: '700',
  },
  
  // Actions
  actions: {
    flexDirection: 'row',
    padding: spacing.lg,
    gap: spacing.md,
  },
  cancelButton: {
    flex: 1,
  },
  submitButton: {
    flex: 2,
  },
  errorText: {
    ...typography.bodyLarge,
    color: colors.error,
    textAlign: 'center',
    padding: spacing.xl,
  },
});
