// =============================================================================
// Auditor Status Component
// Shows current auditor information and online/offline status
// =============================================================================

import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, Surface } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography } from '../../theme';

interface Auditor {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'admin' | 'coordinator' | 'auditor';
}

interface AuditorStatusProps {
  auditor: Auditor;
  isOnline?: boolean;
  variant?: 'default' | 'compact' | 'detailed';
  onPress?: () => void;
}

export function AuditorStatus({
  auditor,
  isOnline = true,
  variant = 'default',
  onPress,
}: AuditorStatusProps) {
  const initials = `${auditor.firstName[0]}${auditor.lastName[0]}`.toUpperCase();
  const fullName = `${auditor.firstName} ${auditor.lastName}`;

  const roleConfig = {
    admin: { label: 'Administrator', color: colors.primaryDark, bgColor: colors.primaryLight },
    coordinator: { label: 'Koordynator', color: colors.info, bgColor: colors.infoLight },
    auditor: { label: 'Audytor', color: colors.success, bgColor: colors.successLight },
  };

  const role = roleConfig[auditor.role];

  if (variant === 'compact') {
    return (
      <TouchableOpacity 
        onPress={onPress} 
        disabled={!onPress}
        activeOpacity={onPress ? 0.7 : 1}
      >
        <View style={styles.compactContainer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
            <View style={[
              styles.statusDot, 
              styles.statusDotSmall,
              { backgroundColor: isOnline ? colors.success : colors.textDisabled }
            ]} />
          </View>
          <Text style={styles.compactName} numberOfLines={1}>{fullName}</Text>
        </View>
      </TouchableOpacity>
    );
  }

  if (variant === 'detailed') {
    return (
      <TouchableOpacity 
        onPress={onPress} 
        disabled={!onPress}
        activeOpacity={onPress ? 0.7 : 1}
      >
        <Surface style={styles.detailedContainer} elevation={1}>
          <View style={styles.detailedContent}>
            <View style={styles.avatarLarge}>
              <Text style={styles.avatarTextLarge}>{initials}</Text>
              <View style={[
                styles.statusDot, 
                styles.statusDotLarge,
                { backgroundColor: isOnline ? colors.success : colors.textDisabled }
              ]} />
            </View>

            <View style={styles.detailedInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.detailedName}>{fullName}</Text>
                <View style={[styles.roleBadge, { backgroundColor: role.bgColor }]}>
                  <Text style={[styles.roleText, { color: role.color }]}>{role.label}</Text>
                </View>
              </View>

              <View style={styles.emailRow}>
                <Icon name="email-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.email}>{auditor.email}</Text>
              </View>

              <View style={styles.statusRow}>
                <View style={[
                  styles.onlineBadge,
                  { backgroundColor: isOnline ? colors.successLight : colors.surfaceVariant }
                ]}>
                  <Icon 
                    name={isOnline ? 'wifi' : 'wifi-off'} 
                    size={14} 
                    color={isOnline ? colors.success : colors.textDisabled} 
                  />
                  <Text style={[
                    styles.onlineText,
                    { color: isOnline ? colors.success : colors.textDisabled }
                  ]}>
                    {isOnline ? 'Online' : 'Offline'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </Surface>
      </TouchableOpacity>
    );
  }

  // Default variant
  return (
    <TouchableOpacity 
      onPress={onPress} 
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={styles.container}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
          <View style={[
            styles.statusDot,
            { backgroundColor: isOnline ? colors.success : colors.textDisabled }
          ]} />
        </View>

        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{fullName}</Text>
            <View style={[styles.roleBadgeSmall, { backgroundColor: role.bgColor }]}>
              <Text style={[styles.roleTextSmall, { color: role.color }]}>{role.label}</Text>
            </View>
          </View>
          
          <View style={styles.onlineRow}>
            <Icon 
              name={isOnline ? 'wifi' : 'wifi-off'} 
              size={12} 
              color={isOnline ? colors.success : colors.textDisabled} 
            />
            <Text style={[
              styles.onlineLabel,
              { color: isOnline ? colors.success : colors.textDisabled }
            ]}>
              {isOnline ? 'Online' : 'Offline'}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// Simple avatar component for use in other places
interface UserAvatarProps {
  firstName: string;
  lastName: string;
  size?: 'small' | 'medium' | 'large';
  showStatus?: boolean;
  isOnline?: boolean;
}

export function UserAvatar({
  firstName,
  lastName,
  size = 'medium',
  showStatus = false,
  isOnline = true,
}: UserAvatarProps) {
  const initials = `${firstName[0]}${lastName[0]}`.toUpperCase();

  const sizeStyles = {
    small: { container: 32, text: 12, dot: 10 },
    medium: { container: 40, text: 14, dot: 12 },
    large: { container: 56, text: 18, dot: 14 },
  };

  const s = sizeStyles[size];

  return (
    <View style={[styles.avatarOnly, { width: s.container, height: s.container }]}>
      <Text style={[styles.avatarText, { fontSize: s.text }]}>{initials}</Text>
      {showStatus && (
        <View style={[
          styles.statusDot,
          { 
            width: s.dot, 
            height: s.dot,
            backgroundColor: isOnline ? colors.success : colors.textDisabled 
          }
        ]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Compact styles
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  compactName: {
    ...typography.labelMedium,
    color: colors.textSecondary,
    maxWidth: 100,
  },

  // Default styles
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarOnly: {
    borderRadius: 100,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarText: {
    ...typography.labelMedium,
    color: colors.primaryForeground,
    fontWeight: '600',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    position: 'absolute',
    bottom: 0,
    right: 0,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  statusDotSmall: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusDotLarge: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  info: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 2,
  },
  name: {
    ...typography.labelLarge,
    color: colors.textPrimary,
    fontWeight: '500',
    flex: 1,
  },
  roleBadgeSmall: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  roleTextSmall: {
    ...typography.labelSmall,
    fontWeight: '500',
  },
  onlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  onlineLabel: {
    ...typography.labelSmall,
  },

  // Detailed styles
  detailedContainer: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  detailedContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.lg,
  },
  avatarLarge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarTextLarge: {
    fontSize: 20,
    color: colors.primaryForeground,
    fontWeight: '600',
  },
  detailedInfo: {
    flex: 1,
  },
  detailedName: {
    ...typography.titleMedium,
    color: colors.textPrimary,
    fontWeight: '600',
    flex: 1,
  },
  roleBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  roleText: {
    ...typography.labelSmall,
    fontWeight: '500',
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  email: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  onlineText: {
    ...typography.labelSmall,
    fontWeight: '500',
  },
});
