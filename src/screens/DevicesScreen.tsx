// =============================================================================
// Devices Screen - Multi-select elements for batch audit
// Sticky search + filters, selectable elements list
// =============================================================================

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { 
  View, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity,
  RefreshControl,
  Keyboard,
  TextInput,
  Modal as RNModal,
  Alert,
} from 'react-native';
import { Text, ActivityIndicator, Portal, Modal, Snackbar, Checkbox } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useNavigation, useFocusEffect, useScrollToTop } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography, borderRadius, shadows, screen } from '../theme';
import { Button } from '../components/ui/Button';
import { StatusBar } from '../components/ui/StatusBar';
import { useProjectStore } from '../stores/projectStore';
import { useAuthStore } from '../stores/authStore';
import { useAuditStore } from '../stores/auditStore';
import { 
  getFilteredDevicesPaginated,
  getDistinctBuildings,
  getDistinctLevels,
  getDistinctZones,
  getDistinctTypes,
} from '../database';
import { Device, DeviceFilters, Project } from '../types';

const PAGE_SIZE = 50;

// =============================================================================
// Project Selection View
// =============================================================================
function ProjectSelectionView() {
  const { 
    projects, 
    isLoading, 
    isOnline,
    isDownloading,
    syncProgress,
    currentProjectRemoved,
    loadProjects, 
    fetchProjectsFromApi,
    selectProject,
    downloadProjectData,
    checkOnlineStatus,
    loadStoredProject,
  } = useProjectStore();

  useEffect(() => {
    const init = async () => {
      await loadProjects();
      await loadStoredProject();
      await checkOnlineStatus();
    };
    init();
  }, []);

  useEffect(() => {
    if (isOnline) {
      fetchProjectsFromApi();
    }
  }, [isOnline]);

  // Show alert if current project was removed from server
  useEffect(() => {
    if (currentProjectRemoved) {
      Alert.alert(
        'Projekt usunięty',
        'Wybrany projekt został usunięty z serwera. Wybierz inny projekt.',
        [{ text: 'OK' }]
      );
    }
  }, [currentProjectRemoved]);

  const handleSelectProject = async (project: Project) => {
    await selectProject(project.id);
    if (isOnline && !project.lastSyncAt) {
      await downloadProjectData();
    }
  };

  return (
    <View style={projectStyles.container}>
      <StatusBar />
      
      <View style={projectStyles.header}>
        <Icon name="folder-open" size={48} color={colors.primary} />
        <Text style={projectStyles.title}>Wybierz projekt</Text>
        <Text style={projectStyles.subtitle}>
          Wybierz projekt, na którym chcesz pracować
        </Text>
      </View>

      {isDownloading && (
        <View style={projectStyles.loadingCard}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={projectStyles.loadingText}>{syncProgress || 'Pobieranie danych...'}</Text>
        </View>
      )}

      {isLoading ? (
        <View style={projectStyles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={projectStyles.loadingText}>Ładowanie projektów...</Text>
        </View>
      ) : projects.length === 0 ? (
        <View style={projectStyles.emptyContainer}>
          <Icon name="folder-alert" size={64} color={colors.textDisabled} />
          <Text style={projectStyles.emptyTitle}>Brak projektów</Text>
          <Text style={projectStyles.emptySubtitle}>
            {isOnline 
              ? 'Nie znaleziono żadnych projektów.'
              : 'Połącz się z internetem, aby pobrać listę projektów.'
            }
          </Text>
        </View>
      ) : (
        <FlatList
          data={projects}
          keyExtractor={(item) => item.id}
          contentContainerStyle={projectStyles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={projectStyles.projectCard}
              onPress={() => handleSelectProject(item)}
              disabled={isDownloading}
            >
              <View style={projectStyles.projectIcon}>
                <Icon name="folder" size={32} color={colors.primary} />
              </View>
              <View style={projectStyles.projectInfo}>
                <Text style={projectStyles.projectName}>{item.name}</Text>
                {item.lastSyncAt && (
                  <View style={projectStyles.metaItem}>
                    <Icon name="check-circle" size={14} color={colors.success} />
                    <Text style={projectStyles.metaText}>Zsynchronizowany</Text>
                  </View>
                )}
              </View>
              <Icon name="chevron-right" size={24} color={colors.textDisabled} />
            </TouchableOpacity>
          )}
        />
      )}

      <View style={projectStyles.footer}>
        <View style={projectStyles.statusBadge}>
          <Icon 
            name={isOnline ? 'wifi' : 'wifi-off'} 
            size={16} 
            color={isOnline ? colors.success : colors.error} 
          />
          <Text style={[projectStyles.statusText, { color: isOnline ? colors.success : colors.error }]}>
            {isOnline ? 'Online' : 'Offline'}
          </Text>
        </View>
      </View>
    </View>
  );
}

const projectStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  title: { ...typography.headlineMedium, color: colors.textPrimary, marginTop: spacing.md },
  subtitle: { ...typography.bodyMedium, color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center' },
  loadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.primaryLight,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: borderRadius.md,
  },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  loadingText: { ...typography.bodyMedium, color: colors.textSecondary },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, gap: spacing.sm },
  emptyTitle: { ...typography.titleLarge, color: colors.textPrimary, marginTop: spacing.md },
  emptySubtitle: { ...typography.bodyMedium, color: colors.textSecondary, textAlign: 'center' },
  listContent: { padding: spacing.lg, gap: spacing.md },
  projectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
    marginBottom: spacing.sm,
  },
  projectIcon: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  projectInfo: { flex: 1 },
  projectName: { ...typography.titleMedium, color: colors.textPrimary, fontWeight: '600' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm },
  metaText: { ...typography.labelSmall, color: colors.textSecondary },
  footer: { padding: spacing.lg, alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.outlineVariant },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.full,
  },
  statusText: { ...typography.labelSmall, fontWeight: '600' },
});

// =============================================================================
// Filter Modal Component
// =============================================================================
interface FilterModalProps {
  visible: boolean;
  title: string;
  icon: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  onClear: () => void;
  onClose: () => void;
}

function FilterModal({ visible, title, icon, options, selected, onToggle, onClear, onClose }: FilterModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const insets = useSafeAreaInsets();
  
  const filteredOptions = useMemo(() => {
    if (!searchQuery) return options;
    const query = searchQuery.toLowerCase();
    return options.filter(opt => opt.toLowerCase().includes(query));
  }, [options, searchQuery]);

  const handleClose = () => {
    setSearchQuery('');
    onClose();
  };

  return (
    <RNModal 
      visible={visible} 
      onRequestClose={handleClose}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View style={[filterModalStyles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={filterModalStyles.header}>
          <View style={filterModalStyles.headerLeft}>
            <Icon name={icon} size={28} color={colors.primary} />
            <Text style={filterModalStyles.title}>{title}</Text>
          </View>
          <TouchableOpacity onPress={handleClose} style={filterModalStyles.closeButton}>
            <Icon name="close" size={28} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={filterModalStyles.searchContainer}>
          <Icon name="magnify" size={24} color={colors.textSecondary} />
          <TextInput
            style={filterModalStyles.searchInput}
            placeholder={`Szukaj w ${title.toLowerCase()}...`}
            placeholderTextColor={colors.textDisabled}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Icon name="close-circle" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Selected count and clear */}
        {selected.length > 0 && (
          <View style={filterModalStyles.selectedRow}>
            <Text style={filterModalStyles.selectedText}>
              Wybrano: {selected.length}
            </Text>
            <TouchableOpacity onPress={onClear}>
              <Text style={filterModalStyles.clearText}>Wyczyść wszystko</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Options list */}
        <FlatList
          data={filteredOptions}
          keyExtractor={(item) => item}
          style={filterModalStyles.list}
          contentContainerStyle={filterModalStyles.listContent}
          renderItem={({ item }) => {
            const isSelected = selected.includes(item);
            return (
              <TouchableOpacity 
                style={[filterModalStyles.optionItem, isSelected && filterModalStyles.optionItemSelected]}
                onPress={() => onToggle(item)}
                activeOpacity={0.7}
              >
                <View style={[filterModalStyles.optionCheckbox, isSelected && filterModalStyles.optionCheckboxSelected]}>
                  {isSelected && <Icon name="check" size={18} color={colors.primaryForeground} />}
                </View>
                <Text style={[filterModalStyles.optionText, isSelected && filterModalStyles.optionTextSelected]}>
                  {item}
                </Text>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={filterModalStyles.emptyContainer}>
              <Icon name="magnify-close" size={48} color={colors.textDisabled} />
              <Text style={filterModalStyles.emptyText}>
                {searchQuery ? 'Brak wyników wyszukiwania' : 'Brak dostępnych opcji'}
              </Text>
            </View>
          }
        />

        {/* Done button */}
        <View style={[filterModalStyles.footer, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          <TouchableOpacity style={filterModalStyles.doneButton} onPress={handleClose}>
            <Text style={filterModalStyles.doneButtonText}>Gotowe</Text>
          </TouchableOpacity>
        </View>
      </View>
    </RNModal>
  );
}

const filterModalStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
    backgroundColor: colors.surface,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  closeButton: {
    padding: spacing.sm,
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.full,
  },
  searchContainer: {
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
  searchInput: {
    flex: 1,
    fontSize: 18,
    color: colors.textPrimary,
    padding: 0,
  },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  selectedText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
  },
  clearText: {
    fontSize: 16,
    color: colors.error,
    fontWeight: '500',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.background,
    gap: spacing.lg,
    minHeight: 64,
  },
  optionItemSelected: {
    backgroundColor: colors.primaryLight,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  optionCheckbox: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    borderColor: colors.outline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionCheckboxSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  optionText: {
    fontSize: 18,
    color: colors.textPrimary,
    flex: 1,
  },
  optionTextSelected: {
    fontWeight: '600',
    color: colors.primary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl * 3,
    gap: spacing.lg,
  },
  emptyText: {
    fontSize: 16,
    color: colors.textDisabled,
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
    backgroundColor: colors.surface,
  },
  doneButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    minHeight: 56,
    justifyContent: 'center',
  },
  doneButtonText: {
    fontSize: 18,
    color: colors.primaryForeground,
    fontWeight: '700',
  },
});

// =============================================================================
// Filter Button Component (triggers modal)
// =============================================================================
interface FilterButtonProps {
  label: string;
  icon: string;
  selected: string[];
  onPress: () => void;
}

function FilterButton({ label, icon, selected, onPress }: FilterButtonProps) {
  const hasSelection = selected.length > 0;
  const displayValue = hasSelection 
    ? selected.length <= 2 
      ? selected.join(', ')
      : `${selected.slice(0, 2).join(', ')} +${selected.length - 2}`
    : 'Wszystkie';
  
  return (
    <TouchableOpacity 
      style={[filterButtonStyles.button, hasSelection && filterButtonStyles.buttonActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[filterButtonStyles.iconContainer, hasSelection && filterButtonStyles.iconContainerActive]}>
        <Icon name={icon} size={22} color={hasSelection ? colors.primary : colors.textSecondary} />
      </View>
      <View style={filterButtonStyles.content}>
        <Text style={filterButtonStyles.labelSmall}>{label}</Text>
        <Text 
          style={[filterButtonStyles.value, hasSelection && filterButtonStyles.valueActive]}
          numberOfLines={1}
        >
          {displayValue}
        </Text>
      </View>
      {hasSelection && (
        <View style={filterButtonStyles.badge}>
          <Text style={filterButtonStyles.badgeText}>{selected.length}</Text>
        </View>
      )}
      <Icon name="chevron-right" size={20} color={colors.textDisabled} />
    </TouchableOpacity>
  );
}

const filterButtonStyles = StyleSheet.create({
  button: {
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
    ...shadows.sm,
  },
  buttonActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
    borderWidth: 2,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainerActive: {
    backgroundColor: colors.primary + '25',
  },
  content: {
    flex: 1,
  },
  labelSmall: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 2,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 15,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  valueActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  badge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    minWidth: 26,
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 12,
    color: colors.primaryForeground,
    fontWeight: '700',
  },
});

// =============================================================================
// Main Devices Screen
// =============================================================================
type RootStackParamList = {
  Projects: undefined;
  Devices: undefined;
  AuditForm: { deviceId: string; deviceIds?: string[]; preview?: boolean };
  AddDevice: undefined;
  NewForm: undefined;
};

export function DevicesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  
  // Ref for scroll to top on tab focus
  const listRef = useRef<FlatList>(null);
  useScrollToTop(listRef);
  
  const {
    currentProject,
    devices,
    isLoading,
    isOnline,
    isDownloading,
    isUploading,
    syncProgress,
    pendingUploads,
    currentProjectRemoved,
    loadDevices,
    downloadProjectData,
    uploadProjectData,
    syncAll,
    forceFullSync,
    checkOnlineStatus,
    loadStoredProject,
    fetchProjectsFromApi,
  } = useProjectStore();

  const { localSessions, loadLocalSessions } = useAuditStore();

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // Multi-select filters
  const [selectedBuildings, setSelectedBuildings] = useState<string[]>([]);
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [selectedZones, setSelectedZones] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  
  // Cascaded filter options (based on current selections)
  const [availableBuildings, setAvailableBuildings] = useState<string[]>([]);
  const [availableLevels, setAvailableLevels] = useState<string[]>([]);
  const [availableZones, setAvailableZones] = useState<string[]>([]);
  const [availableTypes, setAvailableTypes] = useState<string[]>([]);
  
  // Filter modals
  const [activeFilterModal, setActiveFilterModal] = useState<'building' | 'level' | 'zone' | 'type' | null>(null);
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  // Selected elements for batch audit
  const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set());

  // Pagination
  const [paginatedDevices, setPaginatedDevices] = useState<Device[]>([]);
  const [totalDevicesCount, setTotalDevicesCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMoreDevices, setHasMoreDevices] = useState(false);
  const [isLoadingDevices, setIsLoadingDevices] = useState(false);
  const [isLoadingMoreDevices, setIsLoadingMoreDevices] = useState(false);

  // Filtered and sorted devices - completed audits at the bottom
  const filteredDevices = useMemo(() => {
    let result = paginatedDevices;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(d => 
        d.name.toLowerCase().includes(query) || 
        d.elementId.toLowerCase().includes(query) ||
        (d.znacznik && d.znacznik.toLowerCase().includes(query))
      );
    }
    
    if (selectedBuildings.length > 0) {
      result = result.filter(d => d.building && selectedBuildings.includes(d.building));
    }
    
    if (selectedLevels.length > 0) {
      result = result.filter(d => d.level && selectedLevels.includes(d.level));
    }
    
    if (selectedZones.length > 0) {
      result = result.filter(d => d.zone && selectedZones.includes(d.zone));
    }
    
    if (selectedTypes.length > 0) {
      result = result.filter(d => d.type && selectedTypes.includes(d.type));
    }
    
    // Sort: completed audits at the bottom
    result = [...result].sort((a, b) => {
      const aCompleted = localSessions?.find(s => s.deviceId === a.id)?.status === 'completed';
      const bCompleted = localSessions?.find(s => s.deviceId === b.id)?.status === 'completed';
      if (aCompleted && !bCompleted) return 1;
      if (!aCompleted && bCompleted) return -1;
      return 0;
    });
    
    return result;
  }, [paginatedDevices, searchQuery, selectedBuildings, selectedLevels, selectedZones, selectedTypes, localSessions]);

  // Load devices
  const loadPaginatedDevices = useCallback(async (pageNum: number = 1, append: boolean = false) => {
    if (!currentProject) return;
    
    if (append) {
      setIsLoadingMoreDevices(true);
    } else {
      setIsLoadingDevices(true);
    }

    try {
      const result = await getFilteredDevicesPaginated(
        currentProject.id,
        {},
        pageNum,
        PAGE_SIZE
      );
      
      if (append) {
        setPaginatedDevices(prev => [...prev, ...result.items]);
      } else {
        setPaginatedDevices(result.items);
      }
      setTotalDevicesCount(result.totalCount);
      setCurrentPage(result.page);
      setHasMoreDevices(result.hasMore);
    } catch (error) {
      console.error('Error loading devices:', error);
    } finally {
      setIsLoadingDevices(false);
      setIsLoadingMoreDevices(false);
    }
  }, [currentProject]);

  // Init
  useEffect(() => {
    const init = async () => {
      await loadStoredProject();
      setIsInitializing(false);
    };
    init();
  }, []);

  useEffect(() => {
    if (currentProject) {
      loadPaginatedDevices(1, false);
    }
  }, [currentProject?.id]);

  useFocusEffect(
    useCallback(() => {
      const syncAndLoad = async () => {
        await checkOnlineStatus();
        
        // Sync projects from server when online
        const online = await checkOnlineStatus();
        if (isOnline) {
          await fetchProjectsFromApi();
        }
        
        if (currentProject) {
          loadDevices();
          loadPaginatedDevices(1, false);
          loadLocalSessions(currentProject.id);
        }
      };
      
      syncAndLoad();
      
      // Scroll to top when tab is focused
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
    }, [currentProject?.id, isOnline])
  );
  
  // Handle when current project was removed from server
  useEffect(() => {
    if (currentProjectRemoved) {
      Alert.alert(
        'Projekt usunięty',
        'Wybrany projekt został usunięty z serwera. Wybierz inny projekt.',
        [{ text: 'OK' }]
      );
    }
  }, [currentProjectRemoved]);

  useEffect(() => {
    checkOnlineStatus();
    const interval = setInterval(checkOnlineStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  // Load cascading filter options - always show all available, filtered by selections above
  const loadCascadingFilterOptions = useCallback(async () => {
    if (!currentProject) return;

    // Buildings - always load all
    const buildings = await getDistinctBuildings(currentProject.id);
    setAvailableBuildings(buildings);

    // Levels - filter by selected buildings if any, otherwise show all
    if (selectedBuildings.length > 0) {
      const levelsPromises = selectedBuildings.map(b => getDistinctLevels(currentProject.id, b));
      const levelsArrays = await Promise.all(levelsPromises);
      const uniqueLevels = [...new Set(levelsArrays.flat())].sort();
      setAvailableLevels(uniqueLevels);
    } else {
      // Show all levels if no building selected
      const allLevels = await getDistinctLevels(currentProject.id);
      setAvailableLevels(allLevels);
    }

    // Zones - filter by selections, but always show available zones
    if (selectedBuildings.length > 0 && selectedLevels.length > 0) {
      const zonesPromises: Promise<string[]>[] = [];
      for (const b of selectedBuildings) {
        for (const l of selectedLevels) {
          zonesPromises.push(getDistinctZones(currentProject.id, b, l));
        }
      }
      const zonesArrays = await Promise.all(zonesPromises);
      const uniqueZones = [...new Set(zonesArrays.flat())].sort();
      setAvailableZones(uniqueZones);
    } else if (selectedBuildings.length > 0) {
      // Show zones for selected buildings (any level)
      const zonesPromises = selectedBuildings.map(b => getDistinctZones(currentProject.id, b));
      const zonesArrays = await Promise.all(zonesPromises);
      const uniqueZones = [...new Set(zonesArrays.flat())].sort();
      setAvailableZones(uniqueZones);
    } else {
      // Show all zones if nothing selected
      const allZones = await getDistinctZones(currentProject.id);
      setAvailableZones(allZones);
    }

    // Types - always show, filtered by current selections
    const typeFilters: { building?: string; level?: string; zone?: string } = {};
    // Build filter based on what's selected
    const typesPromises: Promise<string[]>[] = [];
    
    if (selectedBuildings.length > 0 && selectedLevels.length > 0 && selectedZones.length > 0) {
      for (const b of selectedBuildings) {
        for (const l of selectedLevels) {
          for (const z of selectedZones) {
            typesPromises.push(getDistinctTypes(currentProject.id, { building: b, level: l, zone: z }));
          }
        }
      }
    } else if (selectedBuildings.length > 0 && selectedLevels.length > 0) {
      for (const b of selectedBuildings) {
        for (const l of selectedLevels) {
          typesPromises.push(getDistinctTypes(currentProject.id, { building: b, level: l }));
        }
      }
    } else if (selectedBuildings.length > 0) {
      for (const b of selectedBuildings) {
        typesPromises.push(getDistinctTypes(currentProject.id, { building: b }));
      }
    } else {
      typesPromises.push(getDistinctTypes(currentProject.id, {}));
    }
    
    const typesArrays = await Promise.all(typesPromises);
    const uniqueTypes = [...new Set(typesArrays.flat())].sort();
    setAvailableTypes(uniqueTypes);
  }, [currentProject, selectedBuildings, selectedLevels, selectedZones]);

  // Reload filter options when selections change
  useEffect(() => {
    loadCascadingFilterOptions();
  }, [loadCascadingFilterOptions]);

  // Filter change handlers - don't clear downstream, let user select freely
  const handleBuildingFilterChange = useCallback((buildings: string[]) => {
    setSelectedBuildings(buildings);
  }, []);

  const handleLevelFilterChange = useCallback((levels: string[]) => {
    setSelectedLevels(levels);
  }, []);

  const handleZoneFilterChange = useCallback((zones: string[]) => {
    setSelectedZones(zones);
  }, []);

  const handleTypeFilterChange = useCallback((types: string[]) => {
    setSelectedTypes(types);
  }, []);

  // Handlers
  const handleLoadMoreDevices = useCallback(() => {
    if (!isLoadingMoreDevices && hasMoreDevices) {
      loadPaginatedDevices(currentPage + 1, true);
    }
  }, [isLoadingMoreDevices, hasMoreDevices, currentPage, loadPaginatedDevices]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadDevices();
    await loadPaginatedDevices(1, false);
    if (currentProject) {
      await loadLocalSessions(currentProject.id);
    }
    setRefreshing(false);
  }, [loadDevices, loadPaginatedDevices, loadLocalSessions, currentProject]);

  const toggleDeviceSelection = useCallback((deviceId: string) => {
    // Check if device has completed audit
    const existingAudit = localSessions?.find(s => s.deviceId === deviceId);
    if (existingAudit?.status === 'completed') {
      // Navigate to preview mode
      navigation.navigate('AuditForm', { deviceId, preview: true });
      return;
    }
    
    setSelectedDevices(prev => {
      const next = new Set(prev);
      if (next.has(deviceId)) {
        next.delete(deviceId);
      } else {
        next.add(deviceId);
      }
      return next;
    });
  }, [localSessions, navigation]);

  const selectAllVisible = useCallback(() => {
    setSelectedDevices(new Set(filteredDevices.map(d => d.id)));
  }, [filteredDevices]);

  const clearSelection = useCallback(() => {
    setSelectedDevices(new Set());
  }, []);

  const handleStartBatchAudit = useCallback(() => {
    if (selectedDevices.size === 0) return;
    
    const deviceIds = Array.from(selectedDevices);
    // Navigate to audit form with first device, pass all IDs
    navigation.navigate('AuditForm', { 
      deviceId: deviceIds[0],
      deviceIds: deviceIds 
    });
  }, [selectedDevices, navigation]);

  const getDeviceAuditStatus = useCallback((deviceId: string) => {
    if (!localSessions) return null;
    return localSessions.find(s => s.deviceId === deviceId) || null;
  }, [localSessions]);

  const handleDownload = async () => {
    const success = await downloadProjectData();
    if (success) {
      setSnackbarMessage('Dane pobrane pomyślnie');
      setSnackbarVisible(true);
      setShowSyncModal(false);
    }
  };

  const handleUpload = async () => {
    const success = await uploadProjectData();
    if (success) {
      setSnackbarMessage('Dane wysłane pomyślnie');
      setSnackbarVisible(true);
      setShowSyncModal(false);
    }
  };

  const handleSyncAll = async () => {
    const result = await syncAll();
    setSnackbarMessage(result.message);
    setSnackbarVisible(true);
    if (result.success) {
      setShowSyncModal(false);
    }
  };

  const handleForceFullSync = async () => {
    const result = await forceFullSync();
    setSnackbarMessage(result.message);
    setSnackbarVisible(true);
    if (result.success) {
      setShowSyncModal(false);
    }
  };

  const hasActiveFilters = selectedBuildings.length > 0 || selectedLevels.length > 0 || 
                          selectedZones.length > 0 || selectedTypes.length > 0 || searchQuery.length > 0;

  const clearAllFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedBuildings([]);
    setSelectedLevels([]);
    setSelectedZones([]);
    setSelectedTypes([]);
  }, []);

  if (isInitializing) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Ładowanie...</Text>
      </View>
    );
  }

  if (!currentProject) {
    return <ProjectSelectionView />;
  }

  return (
    <View style={styles.container}>
      {/* Premium Header */}
      <View style={[styles.headerGradient, { paddingTop: insets.top }]}>
        {/* Title row */}
        <View style={styles.titleRow}>
          <View style={styles.titleLeft}>
            <View style={styles.titleIconContainer}>
              <Icon name="clipboard-check-multiple" size={28} color={colors.primary} />
            </View>
            <View>
              <Text style={styles.titleText}>Elementy</Text>
              <Text style={styles.subtitleText}>
                {totalDevicesCount} {totalDevicesCount === 1 ? 'element' : totalDevicesCount < 5 ? 'elementy' : 'elementów'}
              </Text>
            </View>
          </View>
          
          {/* Sync button */}
          <TouchableOpacity 
            style={[styles.syncButton, isOnline && styles.syncButtonOnline]} 
            onPress={() => setShowSyncModal(true)}
            activeOpacity={0.8}
          >
            <Icon 
              name={isOnline ? "cloud-sync" : "cloud-off-outline"} 
              size={28} 
              color={isOnline ? colors.primary : colors.textDisabled} 
            />
            {pendingUploads > 0 && (
              <View style={styles.syncBadge}>
                <Text style={styles.syncBadgeText}>{pendingUploads > 9 ? '9+' : pendingUploads}</Text>
              </View>
            )}
            <View style={[styles.statusIndicator, { backgroundColor: isOnline ? colors.success : colors.error }]} />
          </TouchableOpacity>
        </View>

        {/* Search bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchIconContainer}>
            <Icon name="magnify" size={24} color={colors.primary} />
          </View>
          <TextInput
            style={styles.searchInput}
            placeholder="Szukaj po nazwie, ID lub znaczniku..."
            placeholderTextColor={colors.textDisabled}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity style={styles.searchClear} onPress={() => setSearchQuery('')}>
              <Icon name="close-circle" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filters toggle + Selection controls row */}
        <View style={styles.filtersAndSelectionRow}>
          <TouchableOpacity 
            style={[styles.filtersToggle, hasActiveFilters && styles.filtersToggleActive]} 
            onPress={() => setFiltersExpanded(!filtersExpanded)}
            activeOpacity={0.7}
          >
            <View style={styles.filtersToggleLeft}>
              <View style={[styles.filterIconContainer, hasActiveFilters && styles.filterIconContainerActive]}>
                <Icon name="filter-variant" size={20} color={hasActiveFilters ? colors.primaryForeground : colors.textSecondary} />
              </View>
              <Text style={[styles.filtersToggleText, hasActiveFilters && styles.filtersToggleTextActive]}>
                Filtry
              </Text>
              {hasActiveFilters && (
                <View style={styles.filterCountBadge}>
                  <Text style={styles.filterCountText}>
                    {selectedBuildings.length + selectedLevels.length + selectedZones.length + selectedTypes.length}
                  </Text>
                </View>
              )}
            </View>
            <Icon 
              name={filtersExpanded ? 'chevron-up' : 'chevron-down'} 
              size={20} 
              color={hasActiveFilters ? colors.primary : colors.textSecondary} 
            />
          </TouchableOpacity>

          <View style={styles.selectionButtons}>
            <TouchableOpacity style={styles.selectAllButton} onPress={selectAllVisible}>
              <Icon name="checkbox-multiple-marked-outline" size={20} color={colors.primary} />
              <Text style={styles.selectAllText}>Zaznacz wszystkie</Text>
            </TouchableOpacity>
            {selectedDevices.size > 0 && (
              <TouchableOpacity style={styles.clearSelectionButton} onPress={clearSelection}>
                <Icon name="close-circle" size={18} color={colors.error} />
                <Text style={styles.clearSelectionText}>({selectedDevices.size})</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Collapsible filters */}
        {filtersExpanded && (
          <View style={styles.filtersContainer}>
            <FilterButton 
              label="Budynek" 
              icon="office-building"
              selected={selectedBuildings}
              onPress={() => setActiveFilterModal('building')}
            />
            <FilterButton 
              label="Piętro" 
              icon="layers"
              selected={selectedLevels}
              onPress={() => setActiveFilterModal('level')}
            />
            <FilterButton 
              label="Strefa" 
              icon="map-marker-radius"
              selected={selectedZones}
              onPress={() => setActiveFilterModal('zone')}
            />
            <FilterButton 
              label="Typ" 
              icon="tag"
              selected={selectedTypes}
              onPress={() => setActiveFilterModal('type')}
            />
            
            {hasActiveFilters && (
              <TouchableOpacity style={styles.clearFiltersButton} onPress={clearAllFilters}>
                <Icon name="close-circle" size={18} color={colors.error} />
                <Text style={styles.clearFiltersText}>Wyczyść wszystkie filtry</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Active filters summary */}
        {hasActiveFilters && (
          <View style={styles.activeFiltersRow}>
            <Text style={styles.activeFiltersText}>
              {filteredDevices.length} z {totalDevicesCount} elementów
            </Text>
          </View>
        )}

      </View>

      {/* Filter Modals */}
      <FilterModal
        visible={activeFilterModal === 'building'}
        title="Budynek"
        icon="office-building"
        options={availableBuildings}
        selected={selectedBuildings}
        onToggle={(v) => {
          const newSelection = selectedBuildings.includes(v)
            ? selectedBuildings.filter(b => b !== v)
            : [...selectedBuildings, v];
          handleBuildingFilterChange(newSelection);
        }}
        onClear={() => handleBuildingFilterChange([])}
        onClose={() => setActiveFilterModal(null)}
      />
      <FilterModal
        visible={activeFilterModal === 'level'}
        title="Piętro"
        icon="layers"
        options={availableLevels}
        selected={selectedLevels}
        onToggle={(v) => {
          const newSelection = selectedLevels.includes(v)
            ? selectedLevels.filter(l => l !== v)
            : [...selectedLevels, v];
          handleLevelFilterChange(newSelection);
        }}
        onClear={() => handleLevelFilterChange([])}
        onClose={() => setActiveFilterModal(null)}
      />
      <FilterModal
        visible={activeFilterModal === 'zone'}
        title="Strefa"
        icon="map-marker-radius"
        options={availableZones}
        selected={selectedZones}
        onToggle={(v) => {
          const newSelection = selectedZones.includes(v)
            ? selectedZones.filter(z => z !== v)
            : [...selectedZones, v];
          handleZoneFilterChange(newSelection);
        }}
        onClear={() => handleZoneFilterChange([])}
        onClose={() => setActiveFilterModal(null)}
      />
      <FilterModal
        visible={activeFilterModal === 'type'}
        title="Typ"
        icon="tag"
        options={availableTypes}
        selected={selectedTypes}
        onToggle={(v) => {
          const newSelection = selectedTypes.includes(v)
            ? selectedTypes.filter(t => t !== v)
            : [...selectedTypes, v];
          handleTypeFilterChange(newSelection);
        }}
        onClear={() => handleTypeFilterChange([])}
        onClose={() => setActiveFilterModal(null)}
      />

      {/* Device List */}
      <FlatList
        ref={listRef}
        data={filteredDevices}
        keyExtractor={(item) => item.localId}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary]} />
        }
        onEndReached={handleLoadMoreDevices}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={
          isLoadingDevices ? (
            <View style={styles.loadingSmall}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Ładowanie elementów...</Text>
            </View>
          ) : (
            <View style={styles.emptySmall}>
              <Icon name="package-variant" size={64} color={colors.textDisabled} />
              <Text style={styles.emptyTitle}>Brak elementów</Text>
              <Text style={styles.emptySubtitle}>
                {hasActiveFilters ? 'Zmień filtry aby zobaczyć wyniki' : 'Brak elementów w projekcie'}
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          isLoadingMoreDevices ? (
            <View style={styles.loadingMore}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const isSelected = selectedDevices.has(item.id);
          const auditStatus = getDeviceAuditStatus(item.id);
          const isCompleted = auditStatus?.status === 'completed';
          
          return (
            <TouchableOpacity 
              style={[
                styles.deviceItem, 
                isSelected && styles.deviceItemSelected,
                isCompleted && styles.deviceItemCompleted
              ]}
              onPress={() => toggleDeviceSelection(item.id)}
              activeOpacity={isCompleted ? 1 : 0.7}
            >
              <View style={[
                styles.checkbox, 
                isSelected && styles.checkboxSelected,
                isCompleted && styles.checkboxCompleted
              ]}>
                {isCompleted ? (
                  <Icon name="check-all" size={16} color={colors.success} />
                ) : isSelected ? (
                  <Icon name="check" size={16} color={colors.primaryForeground} />
                ) : null}
              </View>
              
              <View style={styles.deviceInfo}>
                <Text style={styles.deviceName} numberOfLines={1}>{item.name}</Text>
                <View style={styles.deviceIdRow}>
                  <Text style={styles.deviceId}>{item.elementId}</Text>
                  {item.znacznik && (
                    <View style={styles.znacznikBadge}>
                      <Text style={styles.znacznikText}>{item.znacznik}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.deviceMeta}>
                  {item.building && (
                    <View style={styles.metaTag}>
                      <Text style={styles.metaTagText}>{item.building}</Text>
                    </View>
                  )}
                  {item.level && (
                    <View style={styles.metaTag}>
                      <Text style={styles.metaTagText}>{item.level}</Text>
                    </View>
                  )}
                  {item.zone && (
                    <View style={styles.metaTag}>
                      <Text style={styles.metaTagText}>{item.zone}</Text>
                    </View>
                  )}
                </View>
              </View>
              
              {auditStatus && (
                <View style={styles.auditStatusContainer}>
                  {/* Sync status for completed audits */}
                  {auditStatus.status === 'completed' && (
                    <View style={[
                      styles.auditSyncBadge,
                      auditStatus.syncStatus === 'synced' ? styles.auditSyncBadgeSynced : styles.auditSyncBadgePending
                    ]}>
                      <Icon 
                        name={auditStatus.syncStatus === 'synced' ? 'cloud-check' : 'cloud-upload'} 
                        size={14} 
                        color={auditStatus.syncStatus === 'synced' ? colors.success : colors.warning} 
                      />
                    </View>
                  )}
                  
                  {/* Audit status badge */}
                  <View style={[
                    styles.auditBadge,
                    auditStatus.status === 'completed' ? styles.auditBadgeCompleted : styles.auditBadgeInProgress
                  ]}>
                    <Icon 
                      name={auditStatus.status === 'completed' ? 'check' : 'clock-outline'} 
                      size={14} 
                      color={auditStatus.status === 'completed' ? colors.success : colors.warning} 
                    />
                    {auditStatus.status === 'completed' && (
                      <Icon 
                        name="eye" 
                        size={12} 
                        color={colors.success} 
                        style={{ marginLeft: 2 }}
                      />
                    )}
                  </View>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
      />

      {/* Bottom Action - Floating button or selection bar */}
      {selectedDevices.size > 0 ? (
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, spacing.sm) + spacing.md }]}>
          <View style={styles.selectedInfo}>
            <Icon name="checkbox-multiple-marked" size={24} color={colors.primary} />
            <Text style={styles.selectedCount}>
              {selectedDevices.size} {selectedDevices.size === 1 ? 'element' : 
                selectedDevices.size < 5 ? 'elementy' : 'elementów'}
            </Text>
          </View>
          <Button 
            onPress={handleStartBatchAudit}
            icon="clipboard-text"
            size="large"
          >
            Rozpocznij audyt
          </Button>
        </View>
      ) : (
        <TouchableOpacity 
          style={[styles.floatingButton, { bottom: Math.max(insets.bottom, spacing.sm) + spacing.lg }]}
          onPress={() => navigation.navigate('AddDevice')}
          activeOpacity={0.9}
        >
          <Icon name="plus" size={32} color={colors.primaryForeground} />
        </TouchableOpacity>
      )}

      {/* Sync Modal */}
      <Portal>
        <Modal
          visible={showSyncModal}
          onDismiss={() => setShowSyncModal(false)}
          contentContainerStyle={styles.modal}
        >
          <Text style={styles.modalTitle}>Synchronizacja</Text>
          
          {/* Main sync button - syncs everything */}
          <View style={[styles.syncOption, { backgroundColor: colors.primaryLight, borderRadius: 12, padding: 16, marginBottom: 16 }]}>
            <Icon name="sync" size={36} color={colors.primary} />
            <View style={styles.syncOptionInfo}>
              <Text style={[styles.syncOptionTitle, { fontSize: 18 }]}>Synchronizuj wszystko</Text>
              <Text style={styles.syncOptionSubtitle}>
                {pendingUploads > 0 
                  ? `${pendingUploads} elementów do wysłania` 
                  : 'Porównaj i zaktualizuj dane'}
              </Text>
              {syncProgress ? (
                <Text style={[styles.syncOptionSubtitle, { color: colors.primary, marginTop: 4 }]}>
                  {syncProgress}
                </Text>
              ) : null}
            </View>
            <Button 
              onPress={handleSyncAll} 
              disabled={!isOnline || isDownloading || isUploading}
              loading={isDownloading || isUploading}
            >
              Synchronizuj
            </Button>
          </View>

          <Text style={[styles.syncOptionSubtitle, { marginBottom: 8, color: colors.textSecondary }]}>
            Lub wybierz opcję:
          </Text>

          <View style={styles.syncOption}>
            <Icon name="cloud-download" size={32} color={colors.primary} />
            <View style={styles.syncOptionInfo}>
              <Text style={styles.syncOptionTitle}>Pobierz dane</Text>
              <Text style={styles.syncOptionSubtitle}>Pobierz najnowsze dane z serwera</Text>
            </View>
            <Button 
              onPress={handleDownload} 
              disabled={!isOnline || isDownloading}
              loading={isDownloading}
              size="small"
              variant="outline"
            >
              Pobierz
            </Button>
          </View>

          <View style={styles.syncOption}>
            <Icon name="cloud-upload" size={32} color={pendingUploads > 0 ? colors.warning : colors.textSecondary} />
            <View style={styles.syncOptionInfo}>
              <Text style={styles.syncOptionTitle}>Wyślij dane</Text>
              <Text style={styles.syncOptionSubtitle}>
                {pendingUploads > 0 ? `${pendingUploads} audytów/zdjęć do wysłania` : 'Wszystko zsynchronizowane'}
              </Text>
            </View>
            <Button 
              onPress={handleUpload} 
              disabled={!isOnline || isUploading || pendingUploads === 0}
              loading={isUploading}
              size="small"
              variant="outline"
            >
              Wyślij
            </Button>
          </View>

          {/* Force full sync option */}
          <View style={[styles.syncOption, { marginTop: 16, borderTopWidth: 1, borderTopColor: colors.outlineVariant, paddingTop: 16 }]}>
            <Icon name="refresh" size={32} color={colors.error} />
            <View style={styles.syncOptionInfo}>
              <Text style={styles.syncOptionTitle}>Pełna synchronizacja</Text>
              <Text style={styles.syncOptionSubtitle}>
                Wymuś ponowne wysłanie wszystkich danych i pobierz całą bazę
              </Text>
            </View>
            <Button 
              onPress={handleForceFullSync} 
              disabled={!isOnline || isDownloading || isUploading}
              loading={isDownloading || isUploading}
              size="small"
              variant="destructive"
            >
              Wykonaj
            </Button>
          </View>

          <Button variant="outline" onPress={() => setShowSyncModal(false)} style={styles.modalClose}>
            Zamknij
          </Button>
        </Modal>
      </Portal>

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
      >
        {snackbarMessage}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  loadingText: { ...typography.bodyMedium, color: colors.textSecondary, marginTop: spacing.md },
  loadingSmall: { alignItems: 'center', padding: spacing.xxl },
  loadingMore: { padding: spacing.lg, alignItems: 'center' },
  
  // Premium Header
  headerGradient: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    ...shadows.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    paddingTop: spacing.sm,
  },
  titleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  titleIconContainer: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleText: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  subtitleText: {
    fontSize: 15,
    color: colors.textSecondary,
    marginTop: 2,
  },
  syncButton: { 
    position: 'relative',
    width: 56,
    height: 56,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.outlineVariant,
  },
  syncButtonOnline: {
    borderColor: colors.primary + '40',
    backgroundColor: colors.primaryLight,
  },
  syncBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  syncBadgeText: {
    fontSize: 11,
    color: colors.primaryForeground,
    fontWeight: '700',
  },
  statusIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 3,
    borderColor: colors.surface,
  },

  // Search - Premium design
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 14,
    paddingRight: spacing.md,
    height: 48,
    borderWidth: 1.5,
    borderColor: colors.outlineVariant,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  searchIconContainer: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.textPrimary,
    padding: 0,
  },
  searchClear: {
    padding: spacing.sm,
  },

  // Filters and Selection Row
  filtersAndSelectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  filtersToggle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.outlineVariant,
  },
  filtersToggleActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  filtersToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  filterIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterIconContainerActive: {
    backgroundColor: colors.primary,
  },
  filtersToggleText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  filtersToggleTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  filterCountBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  filterCountText: {
    fontSize: 11,
    color: colors.primaryForeground,
    fontWeight: '700',
  },
  selectionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  filtersCountBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    minWidth: 20,
    alignItems: 'center',
  },
  filtersCountText: {
    ...typography.labelSmall,
    color: colors.primaryForeground,
    fontWeight: '700',
    fontSize: 11,
  },
  filtersContainer: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  clearFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  clearFiltersText: {
    ...typography.labelMedium,
    color: colors.error,
  },
  activeFiltersRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: spacing.xs,
  },
  activeFiltersText: { ...typography.labelMedium, color: colors.primary, fontWeight: '500' },

  // Selection buttons
  selectAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.primary,
    minHeight: 48,
  },
  selectAllText: { 
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  clearSelectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.errorLight,
    borderRadius: 10,
  },
  clearSelectionText: { 
    fontSize: 12,
    color: colors.error,
    fontWeight: '600',
  },

  // List
  listContent: { padding: spacing.sm, paddingBottom: 80, paddingTop: spacing.sm },
  
  // Device Item
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  deviceItemSelected: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    borderColor: colors.outline,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  checkboxSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxCompleted: {
    backgroundColor: colors.success + '20',
    borderColor: colors.success,
  },
  deviceItemCompleted: {
    opacity: 0.6,
    backgroundColor: colors.success + '08',
  },
  deviceInfo: { flex: 1 },
  deviceName: { ...typography.titleSmall, color: colors.textPrimary, fontWeight: '600' },
  deviceIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 2,
  },
  deviceId: { ...typography.labelSmall, color: colors.textSecondary },
  znacznikBadge: {
    backgroundColor: colors.primary + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.primary + '40',
  },
  znacznikText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    fontFamily: 'monospace',
  },
  deviceMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  metaTag: {
    backgroundColor: colors.surfaceVariant,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  metaTagText: { ...typography.labelSmall, color: colors.textSecondary },
  auditStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  auditSyncBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  auditSyncBadgeSynced: { backgroundColor: colors.success + '20' },
  auditSyncBadgePending: { backgroundColor: colors.warning + '20' },
  auditBadge: {
    flexDirection: 'row',
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  auditBadgeCompleted: { backgroundColor: colors.successLight },
  auditBadgeInProgress: { backgroundColor: colors.warningLight },

  // Bottom Bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
    ...shadows.lg,
  },
  selectedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  selectedCount: { ...typography.titleMedium, color: colors.textPrimary, fontWeight: '600' },
  
  // Floating Add Button
  floatingButton: {
    position: 'absolute',
    right: spacing.lg,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.lg,
    shadowColor: colors.primary,
    shadowOpacity: 0.4,
    elevation: 8,
  },

  // Empty states
  emptySmall: { alignItems: 'center', padding: spacing.xxl },
  emptyTitle: { ...typography.titleMedium, color: colors.textPrimary, marginTop: spacing.md },
  emptySubtitle: { ...typography.bodyMedium, color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center' },

  // Modal
  modal: {
    backgroundColor: colors.surface,
    margin: spacing.xl,
    padding: spacing.xl,
    borderRadius: borderRadius.xl,
  },
  modalTitle: { ...typography.headlineSmall, color: colors.textPrimary, marginBottom: spacing.lg },
  modalClose: { marginTop: spacing.lg },
  syncOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  syncOptionInfo: { flex: 1, marginLeft: spacing.md },
  syncOptionTitle: { ...typography.titleSmall, color: colors.textPrimary },
  syncOptionSubtitle: { ...typography.bodySmall, color: colors.textSecondary, marginTop: 2 },
});
