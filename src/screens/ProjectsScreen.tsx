// =============================================================================
// Projects Screen - Project selection and download
// =============================================================================

import React, { useEffect } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Alert } from 'react-native';
import { Text, ActivityIndicator, FAB } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { StatusBar } from '../components/ui/StatusBar';
import { useProjectStore } from '../stores/projectStore';
import { Project } from '../types';

type RootStackParamList = {
  Projects: undefined;
  Devices: undefined;
};

export function ProjectsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  
  const {
    projects,
    currentProject,
    isLoading,
    isDownloading,
    syncProgress,
    error,
    isOnline,
    loadProjects,
    fetchProjectsFromApi,
    selectProject,
    downloadProjectData,
    checkOnlineStatus,
  } = useProjectStore();


  useEffect(() => {
    loadProjects();
    checkOnlineStatus();
  }, []);

  const handleRefresh = async () => {
    await checkOnlineStatus();
    if (isOnline) {
      await fetchProjectsFromApi();
    }
    await loadProjects();
  };

  const handleSelectProject = async (project: Project) => {
    await selectProject(project.id);
    
    // If project has no data yet and online, automatically download
    if (!project.lastSyncAt && project.deviceCount === 0) {
      if (isOnline) {
        const success = await downloadProjectData();
        if (!success) {
          Alert.alert(
            'Błąd pobierania',
            'Nie udało się pobrać danych projektu. Spróbuj ponownie.',
            [{ text: 'OK' }]
          );
          return;
        }
      } else {
        Alert.alert(
          'Brak danych',
          'Ten projekt nie ma jeszcze pobranych danych. Połącz się z internetem, aby pobrać dane.',
          [{ text: 'OK' }]
        );
        return;
      }
    }
    
    navigation.navigate('Devices');
  };

  const renderProject = ({ item }: { item: Project }) => (
    <Card
      variant="elevated"
      onPress={() => handleSelectProject(item)}
      style={styles.projectCard}
    >
      <View style={styles.projectHeader}>
        <View style={styles.projectIcon}>
          <Icon name="folder-open" size={28} color={colors.primary} />
        </View>
        <View style={styles.projectInfo}>
          <Text style={styles.projectName}>{item.name}</Text>
          {item.description && (
            <Text style={styles.projectDescription} numberOfLines={2}>
              {item.description}
            </Text>
          )}
        </View>
        <Icon name="chevron-right" size={24} color={colors.textDisabled} />
      </View>
      
      <View style={styles.projectStats}>
        <View style={styles.stat}>
          <Icon name="devices" size={18} color={colors.textSecondary} />
          <Text style={styles.statValue}>{item.deviceCount}</Text>
          <Text style={styles.statLabel}>urządzeń</Text>
        </View>
        
        <View style={styles.stat}>
          <Icon name="file-document-outline" size={18} color={colors.textSecondary} />
          <Text style={styles.statValue}>v{item.importVersion}</Text>
          <Text style={styles.statLabel}>wersja</Text>
        </View>
        
        {item.lastSyncAt && (
          <View style={styles.stat}>
            <Icon name="cloud-check" size={18} color={colors.success} />
            <Text style={styles.statLabel}>
              {formatSyncTime(item.lastSyncAt)}
            </Text>
          </View>
        )}
        
        {!item.lastSyncAt && (
          <View style={styles.stat}>
            <Icon name="cloud-download-outline" size={18} color={colors.warning} />
            <Text style={[styles.statLabel, { color: colors.warning }]}>
              Wymaga pobrania
            </Text>
          </View>
        )}
      </View>
    </Card>
  );

  if (isLoading && projects.length === 0) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Ładowanie projektów...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar />
      
      <View style={styles.header}>
        <Text style={styles.title}>Projekty</Text>
        <View style={styles.onlineIndicator}>
          <Icon 
            name={isOnline ? 'wifi' : 'wifi-off'} 
            size={20} 
            color={isOnline ? colors.success : colors.error} 
          />
          <Text style={[
            styles.onlineText, 
            { color: isOnline ? colors.success : colors.error }
          ]}>
            {isOnline ? 'Online' : 'Offline'}
          </Text>
        </View>
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Icon name="alert-circle" size={20} color={colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <FlatList
        data={projects}
        renderItem={renderProject}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="folder-alert-outline"
            title="Brak projektów"
            description={isOnline 
              ? "Pobierz projekty z serwera"
              : "Połącz się z internetem, aby pobrać projekty"
            }
            actionLabel={isOnline ? "Odśwież" : undefined}
            onAction={isOnline ? handleRefresh : undefined}
          />
        }
      />

      {isOnline && (
        <FAB
          icon="refresh"
          style={styles.fab}
          onPress={handleRefresh}
          loading={isLoading}
        />
      )}

    </View>
  );
}

function formatSyncTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Przed chwilą';
  if (minutes < 60) return `${minutes} min temu`;
  if (hours < 24) return `${hours} godz. temu`;
  return `${days} dni temu`;
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
  },
  title: {
    ...typography.displaySmall,
    color: colors.textPrimary,
  },
  onlineIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.full,
    ...shadows.sm,
  },
  onlineText: {
    ...typography.labelMedium,
    fontWeight: '600',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.errorLight,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  errorText: {
    ...typography.bodyMedium,
    color: colors.error,
    flex: 1,
  },
  list: {
    padding: spacing.lg,
    paddingTop: 0,
  },
  projectCard: {
    marginBottom: spacing.md,
  },
  projectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  projectIcon: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  projectInfo: {
    flex: 1,
  },
  projectName: {
    ...typography.titleLarge,
    color: colors.textPrimary,
  },
  projectDescription: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  projectStats: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
    gap: spacing.xl,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statValue: {
    ...typography.titleMedium,
    color: colors.textPrimary,
  },
  statLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    backgroundColor: colors.primary,
  },
  
  // Modal
  modal: {
    backgroundColor: colors.surface,
    margin: spacing.xl,
    padding: spacing.xl,
    borderRadius: borderRadius.xl,
    maxWidth: 400,
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
  modalDescription: {
    ...typography.bodyLarge,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
    lineHeight: 24,
  },
  downloadProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  progressText: {
    ...typography.bodyMedium,
    color: colors.primary,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
  },
});
