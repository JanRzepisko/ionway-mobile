// =============================================================================
// Sync Screen - Synchronization status and controls
// =============================================================================

import React, { useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, ActivityIndicator, Divider } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { StatusBar } from '../components/ui/StatusBar';
import { useProjectStore } from '../stores/projectStore';
import { useAuthStore } from '../stores/authStore';
import { getDatabaseStats } from '../database/schema';
import { RootStackParamList } from '../navigation/AppNavigator';

interface DatabaseStats {
  projects: number;
  devices: number;
  auditSessions: number;
  auditAnswers: number;
  pendingUploads: number;
}

export function SyncScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { logout } = useAuthStore();
  const {
    currentProject,
    isOnline,
    isDownloading,
    isUploading,
    syncProgress,
    pendingUploads,
    lastSyncAt,
    syncError,
    downloadProjectData,
    uploadProjectData,
    checkOnlineStatus,
    clearError,
  } = useProjectStore();

  const [stats, setStats] = React.useState<DatabaseStats | null>(null);
  const [loadingStats, setLoadingStats] = React.useState(true);

  useEffect(() => {
    loadStats();
    checkOnlineStatus();
    
    const interval = setInterval(checkOnlineStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadStats = async () => {
    setLoadingStats(true);
    try {
      const dbStats = await getDatabaseStats();
      setStats(dbStats);
    } finally {
      setLoadingStats(false);
    }
  };

  const handleDownload = async () => {
    await downloadProjectData();
    await loadStats();
  };

  const handleUpload = async () => {
    await uploadProjectData();
    await loadStats();
  };

  return (
    <View style={styles.container}>
      <StatusBar />
      
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Synchronizacja</Text>

        {/* Connection status */}
        <Card variant="elevated" style={styles.card}>
          <View style={styles.statusHeader}>
            <View style={[
              styles.statusIndicator,
              { backgroundColor: isOnline ? colors.successLight : colors.errorLight }
            ]}>
              <Icon 
                name={isOnline ? 'wifi' : 'wifi-off'} 
                size={32} 
                color={isOnline ? colors.success : colors.error} 
              />
            </View>
            <View style={styles.statusInfo}>
              <Text style={styles.statusTitle}>
                {isOnline ? 'Połączono z internetem' : 'Brak połączenia'}
              </Text>
              <Text style={styles.statusSubtitle}>
                {isOnline 
                  ? 'Możesz synchronizować dane'
                  : 'Dane są zapisywane lokalnie'
                }
              </Text>
            </View>
          </View>
        </Card>

        {/* Sync actions */}
        {currentProject && (
          <Card variant="outlined" style={styles.card}>
            <Text style={styles.sectionTitle}>Synchronizacja projektu</Text>
            <Text style={styles.projectName}>{currentProject.name}</Text>
            
            <Divider style={styles.divider} />

            {(isDownloading || isUploading) && (
              <View style={styles.progressContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.progressText}>{syncProgress}</Text>
              </View>
            )}

            {syncError && (
              <View style={styles.errorBanner}>
                <Icon name="alert-circle" size={20} color={colors.error} />
                <Text style={styles.errorText}>{syncError}</Text>
              </View>
            )}

            <View style={styles.actions}>
              <Button
                mode="outlined"
                onPress={handleDownload}
                icon="cloud-download"
                loading={isDownloading}
                disabled={!isOnline || isUploading}
                fullWidth
              >
                Pobierz dane
              </Button>
              
              <Button
                onPress={handleUpload}
                icon="cloud-upload"
                loading={isUploading}
                disabled={!isOnline || isDownloading || pendingUploads === 0}
                color={pendingUploads > 0 ? 'warning' : 'primary'}
                fullWidth
              >
                {`Wyślij dane (${pendingUploads})`}
              </Button>
            </View>

            {lastSyncAt && (
              <Text style={styles.lastSync}>
                Ostatnia synchronizacja: {formatDate(lastSyncAt)}
              </Text>
            )}
          </Card>
        )}

        {/* Local data stats */}
        <Card variant="outlined" style={styles.card}>
          <Text style={styles.sectionTitle}>Dane lokalne</Text>
          
          {loadingStats ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : stats && (
            <View style={styles.statsGrid}>
              <StatItem 
                icon="folder-multiple" 
                label="Projekty" 
                value={stats.projects} 
              />
              <StatItem 
                icon="devices" 
                label="Urządzenia" 
                value={stats.devices} 
              />
              <StatItem 
                icon="clipboard-check" 
                label="Audyty" 
                value={stats.auditSessions} 
              />
              <StatItem 
                icon="form-textbox" 
                label="Odpowiedzi" 
                value={stats.auditAnswers} 
              />
              <StatItem 
                icon="cloud-upload-outline" 
                label="Do wysłania" 
                value={stats.pendingUploads}
                highlight={stats.pendingUploads > 0}
              />
            </View>
          )}
        </Card>

        {/* Demo Form */}
        <Card variant="outlined" style={styles.card}>
          <View style={styles.demoHeader}>
            <View style={styles.demoIcon}>
              <Icon name="flask" size={24} color={colors.info} />
            </View>
            <View style={styles.demoInfo}>
              <Text style={styles.sectionTitle}>Tryb demonstracyjny</Text>
              <Text style={styles.demoDescription}>
                Przetestuj dynamiczny renderer formularzy bez potrzeby pobierania danych z serwera
              </Text>
            </View>
          </View>
          <Button
            onPress={() => navigation.navigate('DemoForm')}
            icon="form-select"
            fullWidth
          >
            Otwórz demo formularza
          </Button>
        </Card>

        {/* Logout */}
        <Card variant="outlined" style={styles.card}>
          <Text style={styles.sectionTitle}>Konto</Text>
          <Text style={styles.warningText}>
            Wylogowanie spowoduje usunięcie wszystkich lokalnych danych.
            Upewnij się, że wszystkie dane zostały zsynchronizowane.
          </Text>
          <Button
            mode="outlined"
            onPress={logout}
            icon="logout"
            color="error"
            fullWidth
          >
            Wyloguj się
          </Button>
        </Card>
      </ScrollView>
    </View>
  );
}

function StatItem({ 
  icon, 
  label, 
  value,
  highlight = false
}: { 
  icon: string; 
  label: string; 
  value: number;
  highlight?: boolean;
}) {
  return (
    <View style={styles.statItem}>
      <Icon 
        name={icon} 
        size={24} 
        color={highlight ? colors.warning : colors.textSecondary} 
      />
      <Text style={[
        styles.statValue,
        highlight && { color: colors.warning }
      ]}>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
  },
  title: {
    ...typography.displaySmall,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  card: {
    marginBottom: spacing.md,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.lg,
  },
  statusInfo: {
    flex: 1,
  },
  statusTitle: {
    ...typography.titleLarge,
    color: colors.textPrimary,
  },
  statusSubtitle: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  sectionTitle: {
    ...typography.titleMedium,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  projectName: {
    ...typography.headlineSmall,
    color: colors.textPrimary,
  },
  divider: {
    marginVertical: spacing.lg,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  progressText: {
    ...typography.bodyMedium,
    color: colors.primary,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.errorLight,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  errorText: {
    ...typography.bodyMedium,
    color: colors.error,
    flex: 1,
  },
  actions: {
    gap: spacing.md,
  },
  lastSync: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  statItem: {
    width: '30%',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.md,
  },
  statValue: {
    ...typography.headlineMedium,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  statLabel: {
    ...typography.labelSmall,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  warningText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  demoHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  demoIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.infoLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  demoInfo: {
    flex: 1,
  },
  demoDescription: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
});
