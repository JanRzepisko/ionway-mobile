// =============================================================================
// My Audits Screen - View and filter audit sessions
// =============================================================================

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { 
  View, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Alert,
  Animated,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Text, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useNavigation, useFocusEffect, useScrollToTop } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';
import { useProjectStore } from '../stores/projectStore';
import { useAuditStore } from '../stores/auditStore';
import { AuditSession } from '../types';
import { 
  getAuditSessionsPaginated, 
  getAuditSessionCounts,
  getDeviceById, 
  fixStuckUploadingSessions, 
  fixStuckUploadingDevices, 
  deleteLocalAuditSession, 
  updateSessionLastInteraction,
  revertSessionToInProgress,
  getAnswerCountsForSessions,
  getFormFieldsCount,
  AuditSessionFilters,
  diagnoseSessions,
} from '../database';
import { useAuthStore } from '../stores/authStore';

const PAGE_SIZE = 30;

type FilterStatus = 'all' | 'completed' | 'in_progress' | 'pending' | 'synced';

type RootStackParamList = {
  AuditForm: { deviceId: string; deviceIds?: string[]; sessionId?: string; preview?: boolean };
};

export function MyAuditsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  
  // Ref for scroll to top on tab focus
  const listRef = useRef<FlatList>(null);
  useScrollToTop(listRef);
  
  const { 
    currentProject, 
    isOnline, 
    currentProjectRemoved,
    fetchProjectsFromApi,
    checkOnlineStatus,
  } = useProjectStore();
  const { loadLocalSessions } = useAuditStore();
  const { user } = useAuthStore();

  const [sessions, setSessions] = useState<AuditSession[]>([]);
  const [deviceNames, setDeviceNames] = useState<Record<string, string>>({});
  const [answerCounts, setAnswerCounts] = useState<Record<string, number>>({});
  const [totalFormFields, setTotalFormFields] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterStatus>('all');
  
  // Selection state
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [counts, setCounts] = useState({
    all: 0,
    completed: 0,
    inProgress: 0,
    pending: 0,
    synced: 0,
  });

  // Build filters for database query
  const buildFilters = useCallback((): AuditSessionFilters => {
    const filters: AuditSessionFilters = {};
    
    if (activeFilter === 'completed') {
      filters.status = 'completed';
    } else if (activeFilter === 'in_progress') {
      filters.status = 'in_progress';
    } else if (activeFilter === 'pending') {
      filters.syncStatus = 'pending';
    } else if (activeFilter === 'synced') {
      filters.syncStatus = 'synced';
    }
    
    if (searchQuery) {
      filters.search = searchQuery;
    }
    
    return filters;
  }, [activeFilter, searchQuery]);

  const loadSessions = useCallback(async (page: number = 1, append: boolean = false) => {
    if (!currentProject) return;
    
    if (append) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }
    
    try {
      // Fix any stuck "uploading" sessions and devices first (only on first load)
      if (page === 1 && !append) {
        await Promise.all([
          fixStuckUploadingSessions(currentProject.id),
          fixStuckUploadingDevices(currentProject.id),
        ]);
        
        // Run diagnostic to check for data issues
        await diagnoseSessions(currentProject.id);
        
        // Load counts for filter badges and total form fields
        const [sessionCounts, fieldsCount] = await Promise.all([
          getAuditSessionCounts(currentProject.id),
          getFormFieldsCount(currentProject.id),
        ]);
        setCounts(sessionCounts);
        setTotalFormFields(fieldsCount);
      }
      
      const filters = buildFilters();
      const result = await getAuditSessionsPaginated(currentProject.id, filters, page, PAGE_SIZE);
      
      if (append) {
        setSessions(prev => [...prev, ...result.items]);
      } else {
        setSessions(result.items);
      }
      
      setTotalCount(result.totalCount);
      setCurrentPage(result.page);
      setHasMore(result.hasMore);
      
      // Load device names for new sessions
      const newNames: Record<string, string> = {};
      for (const session of result.items) {
        if (!deviceNames[session.deviceId] && !newNames[session.deviceId]) {
          const device = await getDeviceById(session.deviceId);
          newNames[session.deviceId] = device?.name || session.deviceId;
        }
      }
      if (Object.keys(newNames).length > 0) {
        setDeviceNames(prev => ({ ...prev, ...newNames }));
      }
      
      // Load answer counts for these sessions
      const sessionLocalIds = result.items.map(s => s.localId);
      const newAnswerCounts = await getAnswerCountsForSessions(sessionLocalIds);
      setAnswerCounts(prev => append ? { ...prev, ...newAnswerCounts } : newAnswerCounts);
    } catch (error) {
      console.error('Error loading sessions:', error);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProject, buildFilters]);

  useFocusEffect(
    useCallback(() => {
      const syncAndLoad = async () => {
        await checkOnlineStatus();
        if (isOnline) {
          await fetchProjectsFromApi();
        }
        loadSessions(1, false);
      };
      syncAndLoad();
      // Scroll to top when tab is focused
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
    }, [isOnline, currentProject?.id])
  );
  
  // Reload when filter changes
  useEffect(() => {
    if (currentProject) {
      loadSessions(1, false);
    }
  }, [activeFilter, currentProject?.id]);
  
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

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadSessions(1, false);
    setRefreshing(false);
  };

  const handleLoadMore = useCallback(() => {
    if (!isLoadingMore && hasMore) {
      loadSessions(currentPage + 1, true);
    }
  }, [isLoadingMore, hasMore, currentPage, loadSessions]);

  // Filter sessions by search query (client-side since search is not in DB query)
  const filteredSessions = useMemo(() => {
    if (!searchQuery) return sessions;
    
    const query = searchQuery.toLowerCase();
    return sessions.filter(s => {
      const deviceName = deviceNames[s.deviceId] || '';
      return deviceName.toLowerCase().includes(query) || 
             s.deviceId.toLowerCase().includes(query);
    });
  }, [sessions, searchQuery, deviceNames]);

  const getStatusColor = (session: AuditSession) => {
    if (session.status === 'completed') {
      if (session.syncStatus === 'synced') return colors.success;
      return colors.warning;
    }
    return colors.primary;
  };

  const getStatusIcon = (session: AuditSession) => {
    if (session.status === 'completed') {
      if (session.syncStatus === 'synced') return 'cloud-check';
      return 'cloud-upload';
    }
    return 'clock-outline';
  };

  const getStatusText = (session: AuditSession) => {
    if (session.status === 'completed') {
      if (session.syncStatus === 'synced') return 'Wysłany';
      if (session.syncStatus === 'pending_upload' || session.syncStatus === 'local_only' || session.syncStatus === 'uploading') return 'Do wysłania';
      if (session.syncStatus === 'upload_error') return 'Błąd wysyłania';
      return 'Zakończony';
    }
    return 'W trakcie';
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    return date.toLocaleDateString('pl-PL', { 
      day: '2-digit', 
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Check if session can be deleted (only local/not synced sessions)
  const canDelete = (session: AuditSession) => {
    return session.syncStatus !== 'synced';
  };

  // Handle delete session
  const handleDeleteSession = async (session: AuditSession) => {
    if (!canDelete(session)) {
      Alert.alert('Nie można usunąć', 'Zsynchronizowane audyty nie mogą być usunięte.');
      return;
    }

    Alert.alert(
      'Usuń audyt',
      'Czy na pewno chcesz usunąć ten audyt? Ta operacja jest nieodwracalna.',
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'Usuń',
          style: 'destructive',
          onPress: async () => {
            const deleted = await deleteLocalAuditSession(session.localId);
            if (deleted) {
              // Remove from local state
              setSessions(prev => prev.filter(s => s.localId !== session.localId));
            } else {
              Alert.alert('Błąd', 'Nie udało się usunąć audytu.');
            }
          }
        }
      ]
    );
  };

  // Handle revert session to in_progress
  const handleRevertSession = async (session: AuditSession) => {
    if (!user) return;
    
    Alert.alert(
      'Cofnij do "W trakcie"',
      `Czy chcesz cofnąć audyt "${deviceNames[session.deviceId] || session.deviceId}" do statusu "W trakcie"?`,
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'Cofnij',
          onPress: async () => {
            try {
              const success = await revertSessionToInProgress(session.localId, user.id, user.fullName);
              if (success) {
                // Refresh the list
                setCurrentPage(1);
                loadSessions(1);
              }
            } catch (error) {
              console.error('Error reverting session:', error);
              Alert.alert('Błąd', 'Nie udało się cofnąć audytu');
            }
          },
        },
      ]
    );
  };

  // Check if session can be reverted (only completed sessions)
  const canRevert = (session: AuditSession) => {
    return session.status === 'completed';
  };

  // Render revert action for swipeable (left side)
  const renderLeftActions = (session: AuditSession, progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
    if (!canRevert(session)) return null;

    const trans = dragX.interpolate({
      inputRange: [0, 100],
      outputRange: [-100, 0],
      extrapolate: 'clamp',
    });

    return (
      <Animated.View style={[styles.revertAction, { transform: [{ translateX: trans }] }]}>
        <TouchableOpacity
          style={styles.revertButton}
          onPress={() => handleRevertSession(session)}
        >
          <Icon name="undo-variant" size={24} color={colors.surface} />
          <Text style={styles.revertText}>Cofnij</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // Render delete action for swipeable (right side)
  const renderRightActions = (session: AuditSession, progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
    if (!canDelete(session)) return null;

    const trans = dragX.interpolate({
      inputRange: [-100, 0],
      outputRange: [0, 100],
      extrapolate: 'clamp',
    });

    return (
      <Animated.View style={[styles.deleteAction, { transform: [{ translateX: trans }] }]}>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeleteSession(session)}
        >
          <Icon name="delete" size={24} color={colors.surface} />
          <Text style={styles.deleteText}>Usuń</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const filters: { key: FilterStatus; label: string; icon: string }[] = [
    { key: 'all', label: 'Wszystkie', icon: 'format-list-bulleted' },
    { key: 'completed', label: 'Zakończone', icon: 'check-circle' },
    { key: 'in_progress', label: 'W trakcie', icon: 'clock-outline' },
    { key: 'pending', label: 'Do wysłania', icon: 'cloud-upload' },
    { key: 'synced', label: 'Wysłane', icon: 'cloud-check' },
  ];

  const filterCounts = {
    all: counts.all,
    completed: counts.completed,
    in_progress: counts.inProgress,
    pending: counts.pending,
    synced: counts.synced,
  };

  // Selection handlers
  const toggleSessionSelection = useCallback((sessionId: string) => {
    setSelectedSessions(prev => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      return next;
    });
  }, []);

  const selectAllVisible = useCallback(() => {
    const allIds = filteredSessions.map(s => s.localId);
    setSelectedSessions(new Set(allIds));
  }, [filteredSessions]);

  const clearSelection = useCallback(() => {
    setSelectedSessions(new Set());
  }, []);

  // Handle batch continue - open selected audits as batch edit
  const handleBatchContinue = useCallback(async () => {
    const selectedList = Array.from(selectedSessions)
      .map(id => sessions.find(s => s.localId === id))
      .filter((s): s is AuditSession => s !== undefined && s.status === 'in_progress');
    
    if (selectedList.length === 0) {
      Alert.alert('Brak audytów w trakcie', 'Zaznacz audyty ze statusem "W trakcie" aby kontynuować.');
      return;
    }

    // Track interaction for all selected sessions
    if (user) {
      for (const session of selectedList) {
        await updateSessionLastInteraction(session.localId, user.id, user.fullName);
      }
    }

    // Get device IDs from selected sessions
    const deviceIds = selectedList.map(s => s.deviceId);
    
    // Navigate to batch edit
    navigation.navigate('AuditForm', {
      deviceId: deviceIds[0],
      deviceIds: deviceIds,
    });
    
    setSelectedSessions(new Set());
  }, [selectedSessions, sessions, user, navigation]);

  if (!currentProject) {
    return (
      <View style={[styles.container, styles.emptyContainer]}>
        <Icon name="folder-alert" size={64} color={colors.textDisabled} />
        <Text style={styles.emptyTitle}>Wybierz projekt</Text>
        <Text style={styles.emptySubtitle}>Przejdź do ustawień aby wybrać projekt</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        {/* Search */}
        <View style={styles.searchContainer}>
          <Icon name="magnify" size={22} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Szukaj audytu..."
            placeholderTextColor={colors.textDisabled}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Icon name="close-circle" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter tabs - full width */}
        <View style={styles.filtersRow}>
          {filters.map((item) => {
            const isActive = activeFilter === item.key;
            const count = filterCounts[item.key];
            return (
              <TouchableOpacity
                key={item.key}
                style={[styles.filterTab, isActive && styles.filterTabActive]}
                onPress={() => setActiveFilter(item.key)}
              >
                <Icon 
                  name={item.icon} 
                  size={14} 
                  color={isActive ? colors.primaryForeground : colors.textSecondary} 
                />
                <Text style={[styles.filterTabText, isActive && styles.filterTabTextActive]} numberOfLines={1}>
                  {item.label}
                </Text>
                <View style={[styles.filterBadge, isActive && styles.filterBadgeActive]}>
                  <Text style={[styles.filterBadgeText, isActive && styles.filterBadgeTextActive]}>
                    {count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
        
        {/* Selection controls and count info */}
        <View style={styles.selectionRow}>
          <View style={styles.selectionButtons}>
            <TouchableOpacity style={styles.selectAllButton} onPress={selectAllVisible}>
              <Icon name="checkbox-multiple-marked-outline" size={18} color={colors.primary} />
              <Text style={styles.selectAllText}>Zaznacz</Text>
            </TouchableOpacity>
            {selectedSessions.size > 0 && (
              <TouchableOpacity style={styles.clearSelectionButton} onPress={clearSelection}>
                <Icon name="close-circle" size={16} color={colors.error} />
                <Text style={styles.clearSelectionText}>({selectedSessions.size})</Text>
              </TouchableOpacity>
            )}
          </View>
          {totalCount > 0 && (
            <Text style={styles.countInfoText}>
              {filteredSessions.length} z {counts.all}
            </Text>
          )}
        </View>
      </View>

      {/* Sessions list */}
      <FlatList
        ref={listRef}
        data={filteredSessions}
        keyExtractor={(item) => item.localId}
        contentContainerStyle={[
          styles.listContent,
          selectedSessions.size > 0 && { paddingBottom: 100 }
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary]} />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Ładowanie audytów...</Text>
            </View>
          ) : (
            <View style={styles.emptyList}>
              <Icon name="clipboard-text-off" size={64} color={colors.textDisabled} />
              <Text style={styles.emptyTitle}>Brak audytów</Text>
              <Text style={styles.emptySubtitle}>
                {activeFilter !== 'all' ? 'Zmień filtr aby zobaczyć więcej' : 'Rozpocznij pierwszy audyt'}
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          isLoadingMore ? (
            <View style={styles.loadingMore}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.loadingMoreText}>Ładowanie więcej...</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const statusColor = getStatusColor(item);
          const deviceName = deviceNames[item.deviceId] || item.deviceId;
          const isDeletable = canDelete(item);
          const isInProgress = item.status === 'in_progress';
          const isSelected = selectedSessions.has(item.localId);
          
          // Calculate completion percentage
          const answeredCount = answerCounts[item.localId] || 0;
          const completionPercent = totalFormFields > 0 
            ? Math.round((answeredCount / totalFormFields) * 100) 
            : 0;
          
          // Format last edited time
          const formatLastEdited = (timestamp?: number) => {
            if (!timestamp) return null;
            const date = new Date(timestamp);
            const now = new Date();
            const diffMs = now.getTime() - date.getTime();
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMs / 3600000);
            const diffDays = Math.floor(diffMs / 86400000);
            
            if (diffMins < 1) return 'przed chwilą';
            if (diffMins < 60) return `${diffMins} min temu`;
            if (diffHours < 24) return `${diffHours} godz. temu`;
            if (diffDays < 7) return `${diffDays} dni temu`;
            return date.toLocaleDateString('pl-PL');
          };
          
          const handleCardPress = async () => {
            console.log('[MyAudits] Card pressed:', {
              localId: item.localId,
              deviceId: item.deviceId,
              status: item.status,
              answersInList: answeredCount,
            });
            
            // Track interaction for in-progress items
            if (isInProgress && user) {
              await updateSessionLastInteraction(item.localId, user.id, user.fullName);
            }
            navigation.navigate('AuditForm', { 
              deviceId: item.deviceId, 
              sessionId: item.localId,
              preview: item.status === 'completed'
            });
          };

          const handleCheckboxPress = () => {
            toggleSessionSelection(item.localId);
          };
          
          const cardContent = (
            <TouchableOpacity 
              style={[
                styles.sessionCard, 
                isInProgress && styles.sessionCardInProgress,
                isSelected && styles.sessionCardSelected
              ]}
              onPress={handleCardPress}
              activeOpacity={0.7}
            >
              {/* Checkbox */}
              <TouchableOpacity 
                style={styles.checkboxContainer}
                onPress={handleCheckboxPress}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Icon 
                  name={isSelected ? 'checkbox-marked' : 'checkbox-blank-outline'} 
                  size={24} 
                  color={isSelected ? colors.primary : colors.textSecondary} 
                />
              </TouchableOpacity>
              
              <View style={[styles.statusIndicator, { backgroundColor: statusColor }]} />
              
              <View style={styles.sessionContent}>
                <View style={styles.sessionHeader}>
                  <Text style={styles.deviceName} numberOfLines={1}>{deviceName}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                    <Icon name={getStatusIcon(item)} size={14} color={statusColor} />
                    <Text style={[styles.statusText, { color: statusColor }]}>
                      {getStatusText(item)}
                    </Text>
                  </View>
                </View>
                
                <View style={styles.sessionMeta}>
                  <View style={styles.metaLeft}>
                    <View style={styles.metaItem}>
                      <Icon name="calendar" size={14} color={colors.textSecondary} />
                      <Text style={styles.metaText}>{formatDate(item.startedAt)}</Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Icon name="format-list-checks" size={14} color={completionPercent === 100 ? colors.success : colors.textSecondary} />
                      <Text style={[styles.metaText, completionPercent === 100 && { color: colors.success, fontWeight: '600' }]}>
                        {completionPercent}% ({answeredCount}/{totalFormFields})
                      </Text>
                    </View>
                  </View>
                  {/* Show last edited info for in-progress items - on the right */}
                  {isInProgress && item.lastEditedByName && (
                    <View style={styles.lastEditedInfo}>
                      <Icon name="account-edit" size={12} color={colors.warning} />
                      <Text style={styles.lastEditedText} numberOfLines={1}>
                        {item.lastEditedByName} • {formatLastEdited(item.lastEditedAt)}
                      </Text>
                    </View>
                  )}
                </View>
                
                {/* Progress bar */}
                <View style={styles.progressBarContainer}>
                  <View style={[styles.progressBar, { width: `${completionPercent}%`, backgroundColor: completionPercent === 100 ? colors.success : colors.primary }]} />
                </View>

                {item.completedAt && (
                  <View style={styles.completedRow}>
                    <Icon name="check" size={14} color={colors.success} />
                    <Text style={styles.completedText}>
                      Zakończono: {formatDate(item.completedAt)}
                    </Text>
                  </View>
                )}
              </View>

              <Icon name="chevron-right" size={24} color={colors.textDisabled} />
            </TouchableOpacity>
          );
          
          // Wrap in Swipeable if can be deleted or reverted
          const isRevertable = canRevert(item);
          const hasSwipeActions = isDeletable || isRevertable;
          
          if (hasSwipeActions) {
            return (
              <Swipeable
                renderLeftActions={isRevertable ? (progress, dragX) => renderLeftActions(item, progress, dragX) : undefined}
                renderRightActions={isDeletable ? (progress, dragX) => renderRightActions(item, progress, dragX) : undefined}
                overshootLeft={false}
                overshootRight={false}
              >
                {cardContent}
              </Swipeable>
            );
          }
          
          return cardContent;
        }}
      />

      {/* Bottom action bar when items selected */}
      {selectedSessions.size > 0 && (
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, spacing.sm) + spacing.md }]}>
          <View style={styles.selectedInfo}>
            <Icon name="checkbox-multiple-marked" size={22} color={colors.primary} />
            <Text style={styles.selectedCount}>
              {selectedSessions.size}
            </Text>
          </View>
          <TouchableOpacity 
            style={styles.continueSelectedButton}
            onPress={handleBatchContinue}
          >
            <Icon name="clipboard-edit" size={18} color={colors.surface} />
            <Text style={styles.continueSelectedText}>Kontynuuj</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    gap: spacing.sm,
    height: 48,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.textPrimary,
    padding: 0,
  },
  filtersRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  filterTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.full,
  },
  filterTabActive: {
    backgroundColor: colors.primary,
  },
  filterTabText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  filterTabTextActive: {
    color: colors.primaryForeground,
    fontWeight: '600',
  },
  filterBadge: {
    backgroundColor: colors.outline,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: borderRadius.full,
    minWidth: 18,
    alignItems: 'center',
  },
  filterBadgeActive: {
    backgroundColor: colors.primaryForeground + '30',
  },
  filterBadgeText: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  filterBadgeTextActive: {
    color: colors.primaryForeground,
  },
  countInfo: {
    marginTop: spacing.sm,
    alignItems: 'center',
  },
  countInfoText: {
    ...typography.labelSmall,
    color: colors.textSecondary,
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  sessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
    paddingRight: spacing.sm,
    ...shadows.sm,
  },
  sessionCardInProgress: {
    backgroundColor: colors.warning + '06',
    borderWidth: 1,
    borderColor: colors.warning + '20',
  },
  statusIndicator: {
    width: 3,
    alignSelf: 'stretch',
  },
  sessionContent: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  deviceName: {
    ...typography.titleMedium,
    color: colors.textPrimary,
    fontWeight: '600',
    flex: 1,
    marginRight: spacing.sm,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  statusText: {
    ...typography.labelSmall,
    fontWeight: '600',
  },
  sessionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  metaLeft: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metaText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  lastEditedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
    maxWidth: '40%',
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: colors.outlineVariant,
    borderRadius: 2,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  completedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  completedText: {
    ...typography.bodySmall,
    color: colors.success,
  },
  lastEditedText: {
    ...typography.labelSmall,
    color: colors.warning,
    fontWeight: '500',
    fontSize: 11,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.md,
  },
  loadingText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  loadingMore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  loadingMoreText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyList: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl * 2,
  },
  emptyTitle: {
    ...typography.titleMedium,
    color: colors.textPrimary,
    marginTop: spacing.md,
  },
  emptySubtitle: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  // Swipe actions
  revertAction: {
    backgroundColor: colors.warning,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
    borderRadius: borderRadius.lg,
  },
  revertButton: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '100%',
    paddingHorizontal: spacing.md,
  },
  revertText: {
    ...typography.labelSmall,
    color: colors.surface,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  deleteAction: {
    backgroundColor: colors.error,
    justifyContent: 'center',
    alignItems: 'flex-end',
    marginBottom: spacing.sm,
    borderRadius: borderRadius.lg,
  },
  deleteButton: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '100%',
    paddingHorizontal: spacing.md,
  },
  deleteText: {
    ...typography.labelSmall,
    color: colors.surface,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  
  // Selection styles
  selectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  selectionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  selectAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  selectAllText: {
    ...typography.labelMedium,
    color: colors.primary,
    fontWeight: '500',
  },
  clearSelectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  clearSelectionText: {
    ...typography.labelMedium,
    color: colors.error,
    fontWeight: '500',
  },
  checkboxContainer: {
    padding: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sessionCardSelected: {
    backgroundColor: colors.primary + '10',
    borderWidth: 1,
    borderColor: colors.primary + '40',
  },
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
  selectedCount: {
    ...typography.titleSmall,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  continueSelectedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
  },
  continueSelectedText: {
    ...typography.labelMedium,
    color: colors.surface,
    fontWeight: '600',
  },
});
