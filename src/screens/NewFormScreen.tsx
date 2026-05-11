// =============================================================================
// New Form Screen - Full screen location selection with searchable filters
// =============================================================================

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  View, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  FlatList,
  StatusBar,
  TextInput,
  ActivityIndicator
} from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, typography, borderRadius, shadows, screen } from '../theme';
import { Button } from '../components/ui/Button';
import { useProjectStore } from '../stores/projectStore';
import { getFilteredDevicesPaginated, PaginatedDevicesResult } from '../database';
import { Device, DeviceFilters } from '../types';

const PAGE_SIZE = 30;

type RootStackParamList = {
  Main: undefined;
  AuditForm: { deviceId: string };
  AddDevice: undefined;
  NewForm: undefined;
};

// Searchable Filter Field Component
interface FilterFieldProps {
  label: string;
  icon: string;
  placeholder: string;
  value: string | null;
  searchQuery: string;
  onSearchChange: (text: string) => void;
  options: string[];
  onSelect: (value: string | null) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  disabled?: boolean;
}

function FilterField({
  label,
  icon,
  placeholder,
  value,
  searchQuery,
  onSearchChange,
  options,
  onSelect,
  isExpanded,
  onToggleExpand,
  disabled = false,
}: FilterFieldProps) {
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const query = searchQuery.toLowerCase();
    return options.filter(opt => opt.toLowerCase().includes(query));
  }, [options, searchQuery]);

  return (
    <View style={[styles.filterField, disabled && styles.filterFieldDisabled]}>
      <View style={styles.filterHeader}>
        <Icon name={icon} size={20} color={disabled ? colors.textDisabled : colors.primary} />
        <Text style={[styles.filterLabel, disabled && styles.filterLabelDisabled]}>{label}</Text>
        {value && (
          <TouchableOpacity 
            style={styles.clearButton}
            onPress={() => onSelect(null)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon name="close-circle" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity 
        style={[styles.filterInput, isExpanded && styles.filterInputExpanded, disabled && styles.filterInputDisabled]}
        onPress={() => !disabled && onToggleExpand()}
        activeOpacity={disabled ? 1 : 0.7}
      >
        {value ? (
          <View style={styles.selectedValue}>
            <Icon name="check-circle" size={18} color={colors.success} />
            <Text style={styles.selectedValueText}>{value}</Text>
          </View>
        ) : (
          <TextInput
            style={styles.filterTextInput}
            placeholder={placeholder}
            placeholderTextColor={colors.textDisabled}
            value={searchQuery}
            onChangeText={onSearchChange}
            onFocus={onToggleExpand}
            editable={!disabled}
          />
        )}
        <Icon 
          name={isExpanded ? 'chevron-up' : 'chevron-down'} 
          size={24} 
          color={disabled ? colors.textDisabled : colors.textSecondary} 
        />
      </TouchableOpacity>

      {isExpanded && !disabled && (
        <View style={styles.optionsList}>
          {filteredOptions.length === 0 ? (
            <View style={styles.noOptions}>
              <Text style={styles.noOptionsText}>Brak wyników</Text>
            </View>
          ) : (
            <>
              {filteredOptions.slice(0, 8).map(option => (
                <TouchableOpacity
                  key={option}
                  style={[styles.optionItem, value === option && styles.optionItemSelected]}
                  onPress={() => {
                    onSelect(option);
                    onSearchChange('');
                  }}
                >
                  <Text style={[styles.optionText, value === option && styles.optionTextSelected]}>
                    {option}
                  </Text>
                  {value === option && (
                    <Icon name="check" size={20} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
              {filteredOptions.length > 8 && (
                <Text style={styles.moreOptions}>
                  +{filteredOptions.length - 8} więcej...
                </Text>
              )}
            </>
          )}
        </View>
      )}
    </View>
  );
}

export function NewFormScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { currentProject, devices, filterOptions } = useProjectStore();

  // Filter states
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  
  // Search states for each filter
  const [buildingSearch, setBuildingSearch] = useState('');
  const [levelSearch, setLevelSearch] = useState('');
  const [zoneSearch, setZoneSearch] = useState('');
  
  // Expanded state for each filter
  const [expandedFilter, setExpandedFilter] = useState<'building' | 'level' | 'zone' | null>(null);

  // Pagination state
  const [paginatedDevices, setPaginatedDevices] = useState<Device[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Get unique filter options based on current selection
  const buildingOptions = useMemo(() => {
    const buildings = new Set<string>();
    devices.forEach(d => d.building && buildings.add(d.building));
    return Array.from(buildings).sort();
  }, [devices]);

  const levelOptions = useMemo(() => {
    const levels = new Set<string>();
    devices
      .filter(d => !selectedBuilding || d.building === selectedBuilding)
      .forEach(d => d.level && levels.add(d.level));
    return Array.from(levels).sort();
  }, [devices, selectedBuilding]);

  const zoneOptions = useMemo(() => {
    const zones = new Set<string>();
    devices
      .filter(d => !selectedBuilding || d.building === selectedBuilding)
      .filter(d => !selectedLevel || d.level === selectedLevel)
      .forEach(d => d.zone && zones.add(d.zone));
    return Array.from(zones).sort();
  }, [devices, selectedBuilding, selectedLevel]);

  // Build filters object
  const filters: DeviceFilters = useMemo(() => ({
    building: selectedBuilding || undefined,
    level: selectedLevel || undefined,
    zone: selectedZone || undefined,
  }), [selectedBuilding, selectedLevel, selectedZone]);

  // Load devices with pagination
  const loadDevices = useCallback(async (pageNum: number = 1, append: boolean = false) => {
    if (!currentProject) return;
    
    if (append) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }

    try {
      const result = await getFilteredDevicesPaginated(
        currentProject.id,
        filters,
        pageNum,
        PAGE_SIZE
      );
      
      if (append) {
        setPaginatedDevices(prev => [...prev, ...result.items]);
      } else {
        setPaginatedDevices(result.items);
      }
      setTotalCount(result.totalCount);
      setPage(result.page);
      setHasMore(result.hasMore);
    } catch (error) {
      console.error('Error loading devices:', error);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [currentProject, filters]);

  // Load initial data and reload on filter change
  useEffect(() => {
    loadDevices(1, false);
  }, [filters, currentProject?.id]);

  // Reset dependent filters when parent changes
  useEffect(() => {
    setSelectedLevel(null);
    setSelectedZone(null);
    setLevelSearch('');
    setZoneSearch('');
  }, [selectedBuilding]);

  useEffect(() => {
    setSelectedZone(null);
    setZoneSearch('');
  }, [selectedLevel]);

  const handleLoadMore = useCallback(() => {
    if (!isLoadingMore && hasMore) {
      loadDevices(page + 1, true);
    }
  }, [isLoadingMore, hasMore, page, loadDevices]);

  const handleSelectDevice = (device: Device) => {
    navigation.navigate('AuditForm', { deviceId: device.localId });
  };

  const handleAddDevice = () => {
    navigation.navigate('AddDevice');
  };

  const clearAllFilters = () => {
    setSelectedBuilding(null);
    setSelectedLevel(null);
    setSelectedZone(null);
    setBuildingSearch('');
    setLevelSearch('');
    setZoneSearch('');
    setExpandedFilter(null);
  };

  const hasActiveFilters = selectedBuilding || selectedLevel || selectedZone;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />
      
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Icon name="arrow-left" size={24} color={colors.primaryForeground} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Nowy formularz</Text>
          <Text style={styles.headerSubtitle}>Wybierz element</Text>
        </View>
      </View>

      <ScrollView 
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Filters Section */}
        <View style={styles.filtersSection}>
          <View style={styles.filtersSectionHeader}>
            <Text style={styles.filtersSectionTitle}>Filtruj po elemencie</Text>
            {hasActiveFilters && (
              <TouchableOpacity onPress={clearAllFilters}>
                <Text style={styles.clearFiltersText}>Wyczyść</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Building Filter */}
          <FilterField
            label="Budynek"
            icon="office-building"
            placeholder="Wyszukaj budynek..."
            value={selectedBuilding}
            searchQuery={buildingSearch}
            onSearchChange={setBuildingSearch}
            options={buildingOptions}
            onSelect={(val) => {
              setSelectedBuilding(val);
              setExpandedFilter(val ? 'level' : null);
            }}
            isExpanded={expandedFilter === 'building'}
            onToggleExpand={() => setExpandedFilter(expandedFilter === 'building' ? null : 'building')}
          />

          {/* Level Filter */}
          <FilterField
            label="Piętro"
            icon="stairs"
            placeholder="Wyszukaj piętro..."
            value={selectedLevel}
            searchQuery={levelSearch}
            onSearchChange={setLevelSearch}
            options={levelOptions}
            onSelect={(val) => {
              setSelectedLevel(val);
              setExpandedFilter(val ? 'zone' : null);
            }}
            isExpanded={expandedFilter === 'level'}
            onToggleExpand={() => setExpandedFilter(expandedFilter === 'level' ? null : 'level')}
            disabled={!selectedBuilding && levelOptions.length === 0}
          />

          {/* Zone Filter */}
          <FilterField
            label="Strefa / Pomieszczenie"
            icon="map-marker-radius"
            placeholder="Wyszukaj strefę..."
            value={selectedZone}
            searchQuery={zoneSearch}
            onSearchChange={setZoneSearch}
            options={zoneOptions}
            onSelect={(val) => {
              setSelectedZone(val);
              setExpandedFilter(null);
            }}
            isExpanded={expandedFilter === 'zone'}
            onToggleExpand={() => setExpandedFilter(expandedFilter === 'zone' ? null : 'zone')}
            disabled={!selectedLevel && zoneOptions.length === 0}
          />
        </View>

        {/* Results Section */}
        <View style={styles.resultsSection}>
          <View style={styles.resultsSectionHeader}>
            <Text style={styles.resultsSectionTitle}>
              {totalCount} {getDeviceLabel(totalCount)}
              {paginatedDevices.length < totalCount && (
                <Text style={styles.resultsSectionSubtitle}>
                  {' '}(pokazano {paginatedDevices.length})
                </Text>
              )}
            </Text>
            {hasActiveFilters && (
              <View style={styles.activeFiltersRow}>
                {selectedBuilding && (
                  <View style={styles.filterBadge}>
                    <Text style={styles.filterBadgeText}>{selectedBuilding}</Text>
                  </View>
                )}
                {selectedLevel && (
                  <View style={styles.filterBadge}>
                    <Text style={styles.filterBadgeText}>{selectedLevel}</Text>
                  </View>
                )}
                {selectedZone && (
                  <View style={styles.filterBadge}>
                    <Text style={styles.filterBadgeText}>{selectedZone}</Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Device List */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Ładowanie urządzeń...</Text>
            </View>
          ) : paginatedDevices.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Icon name="map-marker-off" size={64} color={colors.textDisabled} />
              <Text style={styles.emptyTitle}>Brak elementów</Text>
              <Text style={styles.emptySubtitle}>
                {hasActiveFilters 
                  ? 'Zmień filtry, aby zobaczyć więcej wyników'
                  : 'Dodaj nowy element, aby rozpocząć'}
              </Text>
            </View>
          ) : (
            <>
              {paginatedDevices.map((device) => (
                <TouchableOpacity
                  key={device.localId}
                  style={styles.deviceCard}
                  onPress={() => handleSelectDevice(device)}
                  activeOpacity={0.7}
                >
                  <View style={styles.deviceIcon}>
                    <Icon name="clipboard-text" size={28} color={colors.primary} />
                  </View>
                  <View style={styles.deviceContent}>
                    <Text style={styles.deviceName} numberOfLines={1}>{device.name}</Text>
                    <Text style={styles.deviceId}>{device.elementId}</Text>
                    <View style={styles.deviceLocation}>
                      {device.building && (
                        <View style={styles.locationBadge}>
                          <Text style={styles.locationText}>{device.building}</Text>
                        </View>
                      )}
                      {device.level && (
                        <View style={styles.locationBadge}>
                          <Text style={styles.locationText}>{device.level}</Text>
                        </View>
                      )}
                      {device.zone && (
                        <View style={styles.locationBadge}>
                          <Text style={styles.locationText}>{device.zone}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <Icon name="chevron-right" size={24} color={colors.textDisabled} />
                </TouchableOpacity>
              ))}
              
              {/* Load More Button */}
              {hasMore && (
                <TouchableOpacity
                  style={styles.loadMoreButton}
                  onPress={handleLoadMore}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <>
                      <Icon name="chevron-down" size={20} color={colors.primary} />
                      <Text style={styles.loadMoreText}>
                        Załaduj więcej ({totalCount - paginatedDevices.length} pozostało)
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        {/* Footer */}
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.sm) + spacing.lg }]}>
          <Button
            variant="outline"
            onPress={handleAddDevice}
            icon="plus"
            fullWidth
          >
            Dodaj nowy element
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}

function getDeviceLabel(count: number): string {
  if (count === 1) return 'element';
  if (count >= 2 && count <= 4) return 'elementy';
  return 'elementów';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: spacing.lg,
    paddingHorizontal: screen.isTablet ? spacing.xl : spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    ...typography.headlineMedium,
    fontSize: screen.isTablet ? 26 : 22,
    color: colors.textPrimary,
  },
  headerSubtitle: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // Scroll
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: screen.isTablet ? spacing.xl : spacing.lg,
  },

  // Filters Section
  filtersSection: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  filtersSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  filtersSectionTitle: {
    ...typography.titleMedium,
    color: colors.textPrimary,
  },
  clearFiltersText: {
    ...typography.labelMedium,
    color: colors.error,
  },

  // Filter Field
  filterField: {
    marginBottom: spacing.md,
  },
  filterFieldDisabled: {
    opacity: 0.5,
  },
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  filterLabel: {
    ...typography.labelMedium,
    color: colors.textPrimary,
    flex: 1,
  },
  filterLabelDisabled: {
    color: colors.textDisabled,
  },
  clearButton: {
    padding: spacing.xs,
  },
  filterInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 52,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  filterInputExpanded: {
    borderColor: colors.primary,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  filterInputDisabled: {
    backgroundColor: colors.outlineVariant,
  },
  filterTextInput: {
    flex: 1,
    ...typography.bodyLarge,
    color: colors.textPrimary,
    padding: 0,
  },
  selectedValue: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  selectedValueText: {
    ...typography.bodyLarge,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  optionsList: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderTopWidth: 0,
    borderColor: colors.primary,
    borderBottomLeftRadius: borderRadius.lg,
    borderBottomRightRadius: borderRadius.lg,
    maxHeight: 300,
  },
  noOptions: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  noOptionsText: {
    ...typography.bodyMedium,
    color: colors.textDisabled,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  optionItemSelected: {
    backgroundColor: colors.primaryLight,
  },
  optionText: {
    ...typography.bodyLarge,
    color: colors.textPrimary,
  },
  optionTextSelected: {
    color: colors.primaryDark,
    fontWeight: '600',
  },
  moreOptions: {
    ...typography.labelMedium,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },

  // Results Section
  resultsSection: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  resultsSectionHeader: {
    marginBottom: spacing.md,
  },
  resultsSectionTitle: {
    ...typography.titleMedium,
    color: colors.textPrimary,
  },
  resultsSectionSubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '400',
  },
  activeFiltersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  filterBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  filterBadgeText: {
    ...typography.labelSmall,
    color: colors.primaryDark,
  },

  // Device Card
  deviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceVariant,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
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
  deviceContent: {
    flex: 1,
  },
  deviceName: {
    ...typography.titleMedium,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  deviceId: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  deviceLocation: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  locationBadge: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  locationText: {
    ...typography.labelSmall,
    color: colors.textSecondary,
  },

  // Loading state
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
    gap: spacing.md,
  },
  loadingText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },

  // Empty state
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  emptyTitle: {
    ...typography.headlineSmall,
    color: colors.textPrimary,
    marginTop: spacing.lg,
  },
  emptySubtitle: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  
  // Load more
  loadMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.lg,
  },
  loadMoreText: {
    ...typography.labelMedium,
    color: colors.primary,
    fontWeight: '600',
  },

  // Footer
  footer: {
    paddingTop: spacing.md,
  },
});
