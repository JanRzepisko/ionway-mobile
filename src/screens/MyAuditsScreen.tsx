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
} from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useNavigation, useFocusEffect, useScrollToTop } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';
import { useProjectStore } from '../stores/projectStore';
import { useAuditStore } from '../stores/auditStore';
import { AuditSession } from '../types';
import { getAllAuditSessions, getDeviceById } from '../database';

type FilterStatus = 'all' | 'completed' | 'in_progress' | 'pending' | 'synced';

type RootStackParamList = {
  AuditForm: { deviceId: string; sessionId?: string };
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

  const [sessions, setSessions] = useState<AuditSession[]>([]);
  const [deviceNames, setDeviceNames] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterStatus>('all');

  const loadSessions = useCallback(async () => {
    if (!currentProject) return;
    
    try {
      const allSessions = await getAllAuditSessions(currentProject.id);
      setSessions(allSessions.sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0)));
      
      // Load device names
      const names: Record<string, string> = {};
      for (const session of allSessions) {
        if (!names[session.deviceId]) {
          const device = await getDeviceById(session.deviceId);
          names[session.deviceId] = device?.name || session.deviceId;
        }
      }
      setDeviceNames(names);
    } catch (error) {
      console.error('Error loading sessions:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentProject]);

  useFocusEffect(
    useCallback(() => {
      const syncAndLoad = async () => {
        await checkOnlineStatus();
        if (isOnline) {
          await fetchProjectsFromApi();
        }
        loadSessions();
      };
      syncAndLoad();
      // Scroll to top when tab is focused
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
    }, [loadSessions, isOnline])
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

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadSessions();
    setRefreshing(false);
  };

  const filteredSessions = useMemo(() => {
    let result = sessions;
    
    // Filter by status
    if (activeFilter !== 'all') {
      result = result.filter(s => {
        switch (activeFilter) {
          case 'completed':
            return s.status === 'completed';
          case 'in_progress':
            return s.status === 'in_progress';
          case 'pending':
            return s.syncStatus === 'pending_upload' || s.syncStatus === 'local_only';
          case 'synced':
            return s.syncStatus === 'synced';
          default:
            return true;
        }
      });
    }
    
    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(s => {
        const deviceName = deviceNames[s.deviceId] || '';
        return deviceName.toLowerCase().includes(query) || 
               s.deviceId.toLowerCase().includes(query);
      });
    }
    
    return result;
  }, [sessions, activeFilter, searchQuery, deviceNames]);

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
      if (session.syncStatus === 'pending_upload') return 'Do wysłania';
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

  const filters: { key: FilterStatus; label: string; icon: string }[] = [
    { key: 'all', label: 'Wszystkie', icon: 'format-list-bulleted' },
    { key: 'completed', label: 'Zakończone', icon: 'check-circle' },
    { key: 'in_progress', label: 'W trakcie', icon: 'clock-outline' },
    { key: 'pending', label: 'Do wysłania', icon: 'cloud-upload' },
    { key: 'synced', label: 'Wysłane', icon: 'cloud-check' },
  ];

  const getCounts = () => {
    return {
      all: sessions.length,
      completed: sessions.filter(s => s.status === 'completed').length,
      in_progress: sessions.filter(s => s.status === 'in_progress').length,
      pending: sessions.filter(s => s.syncStatus === 'pending_upload' || s.syncStatus === 'local_only').length,
      synced: sessions.filter(s => s.syncStatus === 'synced').length,
    };
  };

  const counts = getCounts();

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
            const count = counts[item.key];
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
      </View>

      {/* Sessions list */}
      <FlatList
        ref={listRef}
        data={filteredSessions}
        keyExtractor={(item) => item.localId}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary]} />
        }
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
        renderItem={({ item }) => {
          const statusColor = getStatusColor(item);
          const deviceName = deviceNames[item.deviceId] || item.deviceId;
          
          return (
            <TouchableOpacity 
              style={styles.sessionCard}
              onPress={() => navigation.navigate('AuditForm', { deviceId: item.deviceId })}
              activeOpacity={0.7}
            >
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
                  <View style={styles.metaItem}>
                    <Icon name="calendar" size={14} color={colors.textSecondary} />
                    <Text style={styles.metaText}>{formatDate(item.startedAt)}</Text>
                  </View>
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
        }}
      />
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
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  sessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
    overflow: 'hidden',
    ...shadows.sm,
  },
  statusIndicator: {
    width: 4,
    alignSelf: 'stretch',
  },
  sessionContent: {
    flex: 1,
    padding: spacing.md,
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
    gap: spacing.lg,
    marginTop: spacing.xs,
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
});
