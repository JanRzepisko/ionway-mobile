// =============================================================================
// Status Bar Component - Shows current user, project, and sync status
// =============================================================================

import React from 'react';
import { View, StyleSheet, StatusBar as RNStatusBar, Platform } from 'react-native';
import { Text, Surface } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography } from '../../theme';
import { useProjectStore } from '../../stores/projectStore';
import { useAuthStore } from '../../stores/authStore';

export function StatusBar() {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { 
    currentProject, 
    isOnline, 
    pendingUploads,
    isDownloading,
    isUploading 
  } = useProjectStore();

  return (
    <>
      <RNStatusBar barStyle="dark-content" backgroundColor={colors.surface} />
      <Surface style={[styles.container, { paddingTop: insets.top + spacing.sm }]} elevation={2}>
      <View style={styles.left}>
        {/* User */}
        <View style={styles.item}>
          <Icon name="account" size={18} color={colors.textSecondary} />
          <Text style={styles.text} numberOfLines={1}>
            {user?.fullName || 'Nieznany'}
          </Text>
        </View>
        
        {/* Project */}
        {currentProject && (
          <View style={styles.item}>
            <Icon name="folder-outline" size={18} color={colors.textSecondary} />
            <Text style={styles.text} numberOfLines={1}>
              {currentProject.name}
            </Text>
          </View>
        )}
      </View>
      
      <View style={styles.right}>
        {/* Pending uploads */}
        {pendingUploads > 0 && (
          <View style={styles.badge}>
            <Icon name="cloud-upload-outline" size={16} color={colors.warning} />
            <Text style={[styles.badgeText, { color: colors.warning }]}>
              {pendingUploads}
            </Text>
          </View>
        )}
        
        {/* Sync status */}
        {(isDownloading || isUploading) ? (
          <View style={styles.syncIndicator}>
            <Icon 
              name="cloud-sync-outline" 
              size={20} 
              color={colors.primary} 
            />
          </View>
        ) : (
          <View style={styles.onlineIndicator}>
            <Icon 
              name={isOnline ? 'wifi' : 'wifi-off'} 
              size={20} 
              color={isOnline ? colors.success : colors.error} 
            />
          </View>
        )}
      </View>
    </Surface>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.lg,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  text: {
    ...typography.labelMedium,
    color: colors.textSecondary,
    maxWidth: 120,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.warningLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  badgeText: {
    ...typography.labelSmall,
    fontWeight: '600',
  },
  syncIndicator: {
    padding: spacing.xs,
  },
  onlineIndicator: {
    padding: spacing.xs,
  },
});
