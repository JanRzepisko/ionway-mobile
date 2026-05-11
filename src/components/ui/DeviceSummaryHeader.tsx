// =============================================================================
// Device Summary Header Component
// Shows current device information in a sticky header
// =============================================================================

import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, Surface } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors, spacing, borderRadius, shadows, typography } from '../../theme';
import { Device } from '../../types';
import { SyncStatusBadge } from './SyncStatusBadge';

interface DeviceSummaryHeaderProps {
  device: Device;
  variant?: 'default' | 'compact' | 'detailed';
  onPress?: () => void;
}

export function DeviceSummaryHeader({
  device,
  variant = 'default',
  onPress,
}: DeviceSummaryHeaderProps) {
  const content = variant === 'compact' ? (
    <CompactView device={device} />
  ) : variant === 'detailed' ? (
    <DetailedView device={device} />
  ) : (
    <DefaultView device={device} />
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        <Surface style={[styles.container, variant === 'detailed' && styles.detailedContainer]} elevation={2}>
          {content}
        </Surface>
      </TouchableOpacity>
    );
  }

  return (
    <Surface style={[styles.container, variant === 'detailed' && styles.detailedContainer]} elevation={2}>
      {content}
    </Surface>
  );
}

function CompactView({ device }: { device: Device }) {
  return (
    <View style={styles.compactContent}>
      <View style={styles.compactIconContainer}>
        <Icon name="devices" size={24} color={colors.primary} />
      </View>
      <View style={styles.compactInfo}>
        <View style={styles.compactHeader}>
          <Text style={styles.elementId}>{device.elementId}</Text>
          <SyncStatusBadge status={device.syncStatus || 'synced'} size="small" showLabel={false} />
        </View>
        <Text style={styles.deviceName} numberOfLines={1}>{device.name}</Text>
      </View>
    </View>
  );
}

function DefaultView({ device }: { device: Device }) {
  return (
    <>
      <View style={styles.headerRow}>
        <View style={styles.iconContainer}>
          <Icon name="devices" size={28} color={colors.primary} />
        </View>
        <View style={styles.mainInfo}>
          <View style={styles.idRow}>
            <Text style={styles.elementId}>{device.elementId}</Text>
            <SyncStatusBadge status={device.syncStatus || 'synced'} size="small" />
          </View>
          <Text style={styles.deviceName} numberOfLines={1}>{device.name}</Text>
        </View>
      </View>
      
      <View style={styles.locationRow}>
        {device.building && (
          <LocationTag icon="office-building" value={device.building} />
        )}
        {device.level && (
          <LocationTag icon="layers" value={device.level} />
        )}
        {device.zone && (
          <LocationTag icon="map-marker" value={device.zone} />
        )}
      </View>
    </>
  );
}

function DetailedView({ device }: { device: Device }) {
  return (
    <>
      <View style={styles.detailedHeader}>
        <View style={styles.detailedIconContainer}>
          <Icon name="devices" size={36} color={colors.primary} />
        </View>
        <View style={styles.detailedMainInfo}>
          <View style={styles.idRow}>
            <Text style={styles.detailedElementId}>{device.elementId}</Text>
            <SyncStatusBadge status={device.syncStatus || 'synced'} size="medium" />
          </View>
          <Text style={styles.detailedDeviceName}>{device.name}</Text>
        </View>
      </View>

      <View style={styles.detailedGrid}>
        {device.building && (
          <InfoItem icon="office-building" label="Budynek" value={device.building} />
        )}
        {device.level && (
          <InfoItem icon="layers" label="Poziom" value={device.level} />
        )}
        {device.zone && (
          <InfoItem icon="map-marker" label="Strefa" value={device.zone} />
        )}
        {device.group && (
          <InfoItem icon="folder" label="Grupa" value={device.group} />
        )}
        {device.type && (
          <InfoItem icon="tag" label="Typ" value={device.type} />
        )}
        {device.drawingNumber && (
          <InfoItem icon="file-document-outline" label="Nr rysunku" value={device.drawingNumber} />
        )}
      </View>
    </>
  );
}

function LocationTag({ icon, value }: { icon: string; value: string }) {
  return (
    <View style={styles.locationTag}>
      <Icon name={icon} size={14} color={colors.textSecondary} />
      <Text style={styles.locationText}>{value}</Text>
    </View>
  );
}

function InfoItem({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.infoItem}>
      <View style={styles.infoLabel}>
        <Icon name={icon} size={14} color={colors.textSecondary} />
        <Text style={styles.infoLabelText}>{label}</Text>
      </View>
      <Text style={styles.infoValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  detailedContainer: {
    padding: spacing.lg,
  },
  
  // Compact styles
  compactContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  compactIconContainer: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactInfo: {
    flex: 1,
  },
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 2,
  },
  
  // Default styles
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainInfo: {
    flex: 1,
  },
  idRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  elementId: {
    ...typography.titleMedium,
    fontFamily: 'monospace',
    fontWeight: '700',
    color: colors.primaryDark,
  },
  deviceName: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  locationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  locationTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceVariant,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  locationText: {
    ...typography.labelSmall,
    color: colors.textSecondary,
  },
  
  // Detailed styles
  detailedHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.lg,
    marginBottom: spacing.lg,
  },
  detailedIconContainer: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailedMainInfo: {
    flex: 1,
  },
  detailedElementId: {
    ...typography.headlineMedium,
    fontFamily: 'monospace',
    fontWeight: '700',
    color: colors.primaryDark,
  },
  detailedDeviceName: {
    ...typography.titleMedium,
    color: colors.textPrimary,
  },
  detailedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  infoItem: {
    width: '30%',
    minWidth: 100,
  },
  infoLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  infoLabelText: {
    ...typography.labelSmall,
    color: colors.textSecondary,
  },
  infoValue: {
    ...typography.bodyMedium,
    fontWeight: '500',
    color: colors.textPrimary,
  },
});
