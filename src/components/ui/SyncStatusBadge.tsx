// =============================================================================
// Sync Status Badge Component
// =============================================================================

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { getSyncStatusColor, getSyncStatusLabel, colors, spacing, borderRadius } from '../../theme';
import { SyncStatus } from '../../types';

interface SyncStatusBadgeProps {
  status: SyncStatus;
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
}

export function SyncStatusBadge({ 
  status, 
  size = 'medium',
  showLabel = true 
}: SyncStatusBadgeProps) {
  const color = getSyncStatusColor(status);
  const label = getSyncStatusLabel(status);
  
  const iconSize = size === 'small' ? 14 : size === 'medium' ? 18 : 22;
  const fontSize = size === 'small' ? 10 : size === 'medium' ? 12 : 14;
  const padding = size === 'small' ? spacing.xs : size === 'medium' ? spacing.sm : spacing.md;
  
  const icon = getStatusIcon(status);

  return (
    <View style={[styles.container, { backgroundColor: `${color}20`, paddingHorizontal: padding, paddingVertical: padding / 2 }]}>
      <Icon name={icon} size={iconSize} color={color} />
      {showLabel && (
        <Text style={[styles.label, { color, fontSize, marginLeft: spacing.xs }]}>
          {label}
        </Text>
      )}
    </View>
  );
}

function getStatusIcon(status: SyncStatus): string {
  switch (status) {
    case 'local_only':
      return 'content-save-outline';
    case 'pending_upload':
      return 'cloud-upload-outline';
    case 'uploading':
      return 'cloud-sync-outline';
    case 'synced':
      return 'cloud-check-outline';
    case 'upload_error':
      return 'cloud-alert-outline';
    case 'conflict':
      return 'alert-circle-outline';
    default:
      return 'cloud-off-outline';
  }
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.full,
  },
  label: {
    fontWeight: '500',
  },
});
