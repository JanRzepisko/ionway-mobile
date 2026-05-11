// =============================================================================
// Card Component - Styled card with variants
// Premium Enterprise Design System
// =============================================================================

import React from 'react';
import { View, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { colors, spacing, borderRadius, shadows } from '../../theme';

type CardVariant = 'default' | 'outlined' | 'elevated' | 'highlighted' | 'status';
type StatusType = 'success' | 'warning' | 'error' | 'info' | 'primary';

interface CardProps {
  children: React.ReactNode;
  variant?: CardVariant;
  status?: StatusType;
  onPress?: () => void;
  disabled?: boolean;
  selected?: boolean;
  noPadding?: boolean;
  style?: ViewStyle;
}

export function Card({ 
  children, 
  variant = 'default',
  status,
  onPress, 
  disabled = false,
  selected = false,
  noPadding = false,
  style 
}: CardProps) {
  const statusColor = status ? getStatusColor(status) : null;
  
  const cardStyle = [
    styles.base,
    variant === 'outlined' && styles.outlined,
    variant === 'elevated' && styles.elevated,
    variant === 'highlighted' && styles.highlighted,
    variant === 'status' && statusColor && { borderLeftWidth: 4, borderLeftColor: statusColor },
    selected && styles.selected,
    disabled && styles.disabled,
    noPadding && styles.noPadding,
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity 
        style={cardStyle} 
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.7}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={cardStyle}>{children}</View>;
}

function getStatusColor(status: StatusType): string {
  switch (status) {
    case 'success':
      return colors.success;
    case 'warning':
      return colors.warning;
    case 'error':
      return colors.error;
    case 'info':
      return colors.info;
    case 'primary':
    default:
      return colors.primary;
  }
}

// Card subcomponents for consistent layouts
interface CardHeaderProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function CardHeader({ children, style }: CardHeaderProps) {
  return <View style={[styles.header, style]}>{children}</View>;
}

interface CardContentProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function CardContent({ children, style }: CardContentProps) {
  return <View style={[styles.content, style]}>{children}</View>;
}

interface CardFooterProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function CardFooter({ children, style }: CardFooterProps) {
  return <View style={[styles.footer, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.sm,
  },
  outlined: {
    ...shadows.sm,
    shadowOpacity: 0,
    elevation: 0,
    borderWidth: 1,
    borderColor: colors.outline,
  },
  elevated: {
    ...shadows.md,
  },
  highlighted: {
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  selected: {
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  disabled: {
    opacity: 0.6,
  },
  noPadding: {
    padding: 0,
  },
  header: {
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  content: {
    // Default content area
  },
  footer: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
});
