// =============================================================================
// Device List Item - Premium enterprise device card for tablet
// =============================================================================

import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows, screen } from '../../theme';
import { Device } from '../../types';
import { SyncStatusBadge } from '../ui/SyncStatusBadge';

interface DeviceListItemProps {
  device: Device;
  onPress: () => void;
  showDetails?: boolean;
}

export function DeviceListItem({ 
  device, 
  onPress, 
  showDetails = true 
}: DeviceListItemProps) {
  const isNewDevice = device.isNew || device.createdLocally;
  const isPending = device.syncStatus !== 'synced';

  return (
    <TouchableOpacity 
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Gradient accent for new devices */}
      {isNewDevice && <View style={styles.newAccent} />}
      
      <View style={styles.content}>
        {/* Header row */}
        <View style={styles.header}>
          <View style={[
            styles.iconContainer,
            isNewDevice && styles.iconContainerNew
          ]}>
            <Icon 
              name={isNewDevice ? 'plus-circle' : 'devices'} 
              size={28} 
              color={isNewDevice ? colors.success : colors.primary} 
            />
          </View>
          
          <View style={styles.titleContainer}>
            <View style={styles.titleRow}>
              <Text style={styles.name} numberOfLines={1}>
                {device.name}
              </Text>
              {isNewDevice && (
                <View style={styles.newBadge}>
                  <Text style={styles.newBadgeText}>NOWE</Text>
                </View>
              )}
            </View>
            <Text style={styles.elementId}>{device.elementId}</Text>
          </View>
          
          <View style={styles.actionContainer}>
            {device.auditCount && device.auditCount > 0 ? (
              <View style={styles.completedBadge}>
                <Icon name="check-circle" size={16} color={colors.success} />
                <Text style={styles.completedText}>{device.auditCount}</Text>
              </View>
            ) : (
              <View style={styles.fillButton}>
                <Icon name="clipboard-edit" size={20} color={colors.primaryForeground} />
              </View>
            )}
          </View>
        </View>
        
        {/* Location info */}
        {showDetails && (
          <View style={styles.locationRow}>
            {device.building && (
              <View style={styles.locationItem}>
                <Icon name="office-building" size={16} color={colors.textSecondary} />
                <Text style={styles.locationText}>{device.building}</Text>
              </View>
            )}
            {device.level && (
              <View style={styles.locationItem}>
                <Icon name="layers" size={16} color={colors.textSecondary} />
                <Text style={styles.locationText}>{device.level}</Text>
              </View>
            )}
            {device.zone && (
              <View style={styles.locationItem}>
                <Icon name="map-marker-radius" size={16} color={colors.textSecondary} />
                <Text style={styles.locationText}>{device.zone}</Text>
              </View>
            )}
          </View>
        )}
        
        {/* Meta info */}
        {showDetails && (
          <View style={styles.metaRow}>
            {device.group && (
              <View style={styles.metaTag}>
                <Text style={styles.metaTagText}>{device.group}</Text>
              </View>
            )}
            {device.type && (
              <View style={styles.metaTag}>
                <Text style={styles.metaTagText}>{device.type}</Text>
              </View>
            )}
            {device.auditCount > 0 && (
              <View style={styles.auditInfo}>
                <Icon name="clipboard-check-outline" size={14} color={colors.textSecondary} />
                <Text style={styles.auditInfoText}>
                  {device.auditCount} {getAuditLabel(device.auditCount)}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

function getAuditLabel(count: number): string {
  if (count === 1) return 'audyt';
  if (count >= 2 && count <= 4) return 'audyty';
  return 'audytów';
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    ...shadows.sm,
  },
  newAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: screen.isTablet ? 5 : 4,
    backgroundColor: colors.success,
  },
  content: {
    padding: screen.isTablet ? spacing.xl : spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: screen.isTablet ? 64 : 56,
    height: screen.isTablet ? 64 : 56,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  iconContainerNew: {
    backgroundColor: colors.successLight,
  },
  titleContainer: {
    flex: 1,
    marginRight: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: {
    ...typography.titleLarge,
    fontSize: screen.isTablet ? 20 : 18,
    color: colors.textPrimary,
    fontWeight: '600',
    flex: 1,
  },
  newBadge: {
    backgroundColor: colors.success,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  newBadgeText: {
    ...typography.labelSmall,
    color: colors.textInverse,
    fontWeight: '700',
  },
  elementId: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  actionContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fillButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.successLight,
    borderRadius: borderRadius.full,
  },
  completedText: {
    ...typography.labelMedium,
    color: colors.success,
    fontWeight: '600',
  },
  locationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
    gap: spacing.lg,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  locationText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  metaTag: {
    backgroundColor: colors.surfaceVariant,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  metaTagText: {
    ...typography.labelMedium,
    color: colors.textSecondary,
  },
  auditInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
    gap: spacing.xs,
  },
  auditInfoText: {
    ...typography.labelMedium,
    color: colors.textSecondary,
  },
});
