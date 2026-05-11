import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, StyleSheet, Alert, ScrollView, TouchableOpacity, Switch, TextInput } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { useFocusEffect, useScrollToTop } from '@react-navigation/native';
import { colors, spacing, typography, borderRadius, screen } from '../theme';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useAuthStore } from '../stores/authStore';
import { useProjectStore } from '../stores/projectStore';
import { useSettingsStore } from '../stores/settingsStore';
import { getCurrentApiUrl } from '../services/api';
import { Project } from '../types';

export function SettingsScreen() {
  // Ref for scroll to top on tab focus
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);
  const { user, logout } = useAuthStore();
  const { 
    projects, 
    currentProject, 
    isOnline, 
    pendingUploads,
    isLoading,
    isDownloading,
    isUploading,
    syncProgress,
    currentProjectRemoved,
    loadProjects,
    fetchProjectsFromApi,
    selectProject,
    downloadProjectData,
    uploadProjectData,
    checkOnlineStatus,
  } = useProjectStore();
  
  const { settings, loadSettings, setDeveloperMode, setLocalApiUrl } = useSettingsStore();
  
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [showDevSettings, setShowDevSettings] = useState(false);
  const [localUrl, setLocalUrl] = useState(settings.localApiUrl);

  useEffect(() => {
    loadProjects();
    loadSettings();
    checkOnlineStatus();
    if (isOnline) {
      fetchProjectsFromApi();
    }
  }, []);

  // Scroll to top and sync projects when tab is focused
  useFocusEffect(
    useCallback(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      checkOnlineStatus();
      if (isOnline) {
        fetchProjectsFromApi();
      }
    }, [isOnline])
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
    setLocalUrl(settings.localApiUrl);
  }, [settings.localApiUrl]);

  const handleToggleDeveloperMode = async (value: boolean) => {
    await setDeveloperMode(value);
    Alert.alert(
      'Tryb deweloperski',
      value 
        ? `Włączono tryb deweloperski.\nAPI: ${settings.localApiUrl}`
        : `Wyłączono tryb deweloperski.\nAPI: https://audixapi.bmscope.com/api`,
      [{ text: 'OK' }]
    );
  };

  const handleSaveLocalUrl = async () => {
    await setLocalApiUrl(localUrl);
    Alert.alert('Zapisano', `Lokalny URL API: ${localUrl}`);
  };

  const handleSelectProject = async (project: Project) => {
    setShowProjectPicker(false);
    await selectProject(project.id);
    
    // Auto-download if online and no data
    if (isOnline && !project.lastSyncAt) {
      await downloadProjectData();
    }
  };

  const handleSyncProject = async () => {
    if (!isOnline) {
      Alert.alert('Offline', 'Połącz się z internetem aby zsynchronizować dane.');
      return;
    }
    
    // First upload pending audits, then download new data
    if (pendingUploads > 0) {
      const uploadSuccess = await uploadProjectData();
      if (!uploadSuccess) {
        Alert.alert('Błąd wysyłania', 'Nie udało się wysłać audytów. Spróbuj ponownie.');
        return;
      }
    }
    
    const success = await downloadProjectData();
    if (success) {
      Alert.alert('Sukces', 'Dane zostały zsynchronizowane.');
    } else {
      Alert.alert('Błąd', 'Nie udało się pobrać danych.');
    }
  };

  const handleUploadOnly = async () => {
    if (!isOnline) {
      Alert.alert('Offline', 'Połącz się z internetem aby wysłać dane.');
      return;
    }
    if (pendingUploads === 0) {
      Alert.alert('Info', 'Brak danych do wysłania.');
      return;
    }
    const success = await uploadProjectData();
    if (success) {
      Alert.alert('Sukces', 'Audyty zostały wysłane na serwer.');
    } else {
      Alert.alert('Błąd', 'Nie udało się wysłać audytów.');
    }
  };

  const handleLogout = () => {
    if (pendingUploads > 0) {
      Alert.alert(
        'Niezapisane dane',
        `Masz ${pendingUploads} audytów do wysłania. Czy na pewno chcesz się wylogować? Dane lokalne zostaną zachowane.`,
        [
          { text: 'Anuluj', style: 'cancel' },
          { text: 'Wyloguj', style: 'destructive', onPress: logout }
        ]
      );
    } else {
      Alert.alert(
        'Wylogowanie',
        'Czy na pewno chcesz się wylogować?',
        [
          { text: 'Anuluj', style: 'cancel' },
          { text: 'Wyloguj', onPress: logout }
        ]
      );
    }
  };

  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <ScrollView 
        ref={scrollRef}
        style={styles.content} 
        contentContainerStyle={[styles.contentContainer, { paddingTop: insets.top + spacing.md }]}
      >
        <Card variant="elevated" style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.userName}>{user?.fullName}</Text>
              <Text style={styles.userEmail}>{user?.email}</Text>
              <View style={styles.roleBadge}>
                <Icon 
                  name={user?.role === 'Admin' ? 'shield-account' : 'account'} 
                  size={14} 
                  color={colors.primary} 
                />
                <Text style={styles.roleText}>{user?.role}</Text>
              </View>
            </View>
          </View>
        </Card>

        {/* Project Selection */}
        <Card variant="outlined" style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Icon name="folder-open" size={24} color={colors.primary} />
            <Text style={styles.infoTitle}>Projekt</Text>
          </View>
          
          {currentProject ? (
            <>
              <TouchableOpacity 
                style={styles.projectSelector}
                onPress={() => setShowProjectPicker(!showProjectPicker)}
              >
                <Text style={styles.projectName}>{currentProject.name}</Text>
                <Icon 
                  name={showProjectPicker ? 'chevron-up' : 'chevron-down'} 
                  size={24} 
                  color={colors.textSecondary} 
                />
              </TouchableOpacity>
              <View style={styles.projectStats}>
                <View style={styles.stat}>
                  <Icon name="map-marker" size={16} color={colors.textSecondary} />
                  <Text style={styles.statText}>{currentProject.deviceCount || 0} formularzy</Text>
                </View>
                {currentProject.lastSyncAt && (
                  <View style={styles.stat}>
                    <Icon name="sync" size={16} color={colors.textSecondary} />
                    <Text style={styles.statText}>Zsync.</Text>
                  </View>
                )}
                {pendingUploads > 0 && (
                  <View style={[styles.stat, styles.pendingStat]}>
                    <Icon name="cloud-upload" size={16} color={colors.warning} />
                    <Text style={[styles.statText, styles.pendingText]}>{pendingUploads} do wysłania</Text>
                  </View>
                )}
              </View>
              {(isDownloading || isUploading) && (
                <View style={styles.syncProgress}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.syncText}>{syncProgress || 'Synchronizacja...'}</Text>
                </View>
              )}
              <View style={styles.syncButtons}>
                {pendingUploads > 0 && (
                  <Button
                    onPress={handleUploadOnly}
                    icon="cloud-upload"
                    size="small"
                    color="success"
                    style={styles.uploadButton}
                    loading={isUploading}
                    disabled={isUploading || isDownloading || !isOnline}
                  >
                    {`Wyślij audyty (${pendingUploads})`}
                  </Button>
                )}
                <Button
                  variant="outline"
                  onPress={handleSyncProject}
                  icon="sync"
                  size="small"
                  style={styles.syncButton}
                  loading={isDownloading}
                  disabled={isDownloading || isUploading || !isOnline}
                >
                  Pobierz dane
                </Button>
              </View>
            </>
          ) : (
            <TouchableOpacity 
              style={styles.projectSelector}
              onPress={() => setShowProjectPicker(!showProjectPicker)}
            >
              <Text style={styles.noProjectText}>Wybierz projekt</Text>
              <Icon name="chevron-down" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
          
          {showProjectPicker && (
            <View style={styles.projectList}>
              {isLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : projects.length === 0 ? (
                <Text style={styles.noProjectsText}>Brak dostępnych projektów</Text>
              ) : (
                projects.map(project => (
                  <TouchableOpacity
                    key={project.id}
                    style={[
                      styles.projectOption,
                      currentProject?.id === project.id && styles.projectOptionActive
                    ]}
                    onPress={() => handleSelectProject(project)}
                  >
                    <Icon 
                      name={currentProject?.id === project.id ? 'radiobox-marked' : 'radiobox-blank'} 
                      size={20} 
                      color={currentProject?.id === project.id ? colors.primary : colors.textSecondary} 
                    />
                    <Text style={[
                      styles.projectOptionText,
                      currentProject?.id === project.id && styles.projectOptionTextActive
                    ]}>
                      {project.name}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}
        </Card>

        <Card variant="outlined" style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Icon 
              name={isOnline ? 'wifi' : 'wifi-off'} 
              size={24} 
              color={isOnline ? colors.success : colors.error} 
            />
            <Text style={styles.infoTitle}>Status połączenia</Text>
          </View>
          <Text style={[styles.statusText, { color: isOnline ? colors.success : colors.error }]}>
            {isOnline ? 'Online - połączono z serwerem' : 'Offline - praca lokalna'}
          </Text>
          {pendingUploads > 0 && (
            <View style={styles.pendingBadge}>
              <Icon name="cloud-upload" size={16} color={colors.warning} />
              <Text style={styles.pendingText}>
                {pendingUploads} audytów do wysłania
              </Text>
            </View>
          )}
        </Card>

        <Card variant="outlined" style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Icon name="information" size={24} color={colors.textSecondary} />
            <Text style={styles.infoTitle}>O aplikacji</Text>
          </View>
          <View style={styles.appInfo}>
            <Text style={styles.appName}>Audix</Text>
            <Text style={styles.appVersion}>Wersja 1.0.0</Text>
          </View>
        </Card>

        {/* Developer Mode - only in __DEV__ */}
        {__DEV__ && (
          <Card variant="outlined" style={styles.devCard}>
            <TouchableOpacity 
              style={styles.devHeader}
              onPress={() => setShowDevSettings(!showDevSettings)}
            >
              <View style={styles.devHeaderLeft}>
                <Icon name="code-tags" size={24} color={colors.warning} />
                <Text style={styles.devTitle}>Tryb deweloperski</Text>
              </View>
              <Switch
                value={settings.developerMode}
                onValueChange={handleToggleDeveloperMode}
                trackColor={{ false: colors.outline, true: colors.primary }}
                thumbColor={settings.developerMode ? colors.primaryForeground : colors.surface}
              />
            </TouchableOpacity>
            
            {settings.developerMode && (
              <View style={styles.devContent}>
                <View style={styles.apiUrlRow}>
                  <Text style={styles.apiUrlLabel}>Aktualny URL API:</Text>
                  <Text style={styles.apiUrlValue}>{getCurrentApiUrl()}</Text>
                </View>
                
                <TouchableOpacity 
                  style={styles.devSettingsToggle}
                  onPress={() => setShowDevSettings(!showDevSettings)}
                >
                  <Text style={styles.devSettingsToggleText}>
                    {showDevSettings ? 'Ukryj ustawienia' : 'Pokaż ustawienia'}
                  </Text>
                  <Icon 
                    name={showDevSettings ? 'chevron-up' : 'chevron-down'} 
                    size={20} 
                    color={colors.primary} 
                  />
                </TouchableOpacity>
                
                {showDevSettings && (
                  <View style={styles.devSettings}>
                    <Text style={styles.devSettingsLabel}>Lokalny URL API:</Text>
                    <View style={styles.urlInputRow}>
                      <TextInput
                        style={styles.urlInput}
                        value={localUrl}
                        onChangeText={setLocalUrl}
                        placeholder="http://localhost:5004/api"
                        placeholderTextColor={colors.textDisabled}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                      <TouchableOpacity 
                        style={styles.saveUrlButton}
                        onPress={handleSaveLocalUrl}
                      >
                        <Icon name="check" size={20} color={colors.primaryForeground} />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            )}
          </Card>
        )}

        <Button
          variant="outline"
          onPress={handleLogout}
          icon="logout"
          color="error"
          fullWidth
          style={styles.logoutButton}
        >
          Wyloguj się
        </Button>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.lg,
    paddingHorizontal: screen.isTablet ? spacing.xl : spacing.lg,
    gap: spacing.md,
    maxWidth: screen.isTablet ? 700 : undefined,
    alignSelf: screen.isTablet ? 'center' : undefined,
    width: '100%',
  },
  profileCard: {
    marginBottom: spacing.sm,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: screen.isTablet ? 80 : 64,
    height: screen.isTablet ? 80 : 64,
    borderRadius: screen.isTablet ? 40 : 32,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.lg,
  },
  avatarText: {
    ...typography.headlineMedium,
    fontSize: screen.isTablet ? 24 : 20,
    color: colors.primaryForeground,
    fontWeight: '600',
  },
  profileInfo: {
    flex: 1,
  },
  userName: {
    ...typography.titleLarge,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  userEmail: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginTop: 2,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.sm,
    alignSelf: 'flex-start',
  },
  roleText: {
    ...typography.labelSmall,
    color: colors.primary,
    fontWeight: '600',
  },
  infoCard: {
    marginBottom: spacing.sm,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  infoTitle: {
    ...typography.titleMedium,
    color: colors.textPrimary,
  },
  projectSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
    marginBottom: spacing.sm,
  },
  projectName: {
    ...typography.bodyLarge,
    color: colors.textPrimary,
    fontWeight: '600',
    flex: 1,
  },
  noProjectText: {
    ...typography.bodyLarge,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  projectStats: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginBottom: spacing.md,
  },
  syncProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  syncText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  syncButton: {
    flex: 1,
    minWidth: 120,
  },
  projectList: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
  },
  projectOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  projectOptionActive: {
    backgroundColor: colors.primaryLight,
  },
  projectOptionText: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  projectOptionTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  noProjectsText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  pendingStat: {
    backgroundColor: colors.warningLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  pendingText: {
    color: colors.warningDark,
    fontWeight: '600',
  },
  syncButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
    flexWrap: 'wrap',
  },
  uploadButton: {
    flex: 1,
    minWidth: 140,
  },
  statusText: {
    ...typography.bodyMedium,
    marginBottom: spacing.sm,
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.warningLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  appInfo: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  appName: {
    ...typography.titleMedium,
    color: colors.textPrimary,
  },
  appVersion: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  logoutButton: {
    marginTop: spacing.lg,
  },
  // Developer Mode
  devCard: {
    marginBottom: spacing.sm,
    borderColor: colors.warning,
    borderWidth: 1,
  },
  devHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  devHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  devTitle: {
    ...typography.titleMedium,
    color: colors.warning,
  },
  devContent: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
  },
  apiUrlRow: {
    marginBottom: spacing.sm,
  },
  apiUrlLabel: {
    ...typography.labelSmall,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  apiUrlValue: {
    ...typography.bodySmall,
    color: colors.primary,
    fontFamily: 'monospace',
  },
  devSettingsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  devSettingsToggleText: {
    ...typography.labelMedium,
    color: colors.primary,
  },
  devSettings: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
  },
  devSettingsLabel: {
    ...typography.labelSmall,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  urlInputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  urlInput: {
    flex: 1,
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontFamily: 'monospace',
  },
  saveUrlButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
