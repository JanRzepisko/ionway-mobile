// =============================================================================
// Button Component - Large tablet-friendly buttons
// Premium Enterprise Design System
// =============================================================================

import React from 'react';
import { StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Button as PaperButton } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography } from '../../theme';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
type ButtonColor = 'primary' | 'success' | 'warning' | 'error';
type ButtonSize = 'small' | 'medium' | 'large';

interface ButtonProps {
  children: string;
  onPress: () => void;
  variant?: ButtonVariant;
  mode?: 'text' | 'outlined' | 'contained';  // Alias for variant (backward compat)
  size?: ButtonSize;
  icon?: string;
  iconRight?: string;
  loading?: boolean;
  disabled?: boolean;
  color?: ButtonColor;
  fullWidth?: boolean;
  style?: ViewStyle;
}

export function Button({
  children,
  onPress,
  variant = 'primary',
  mode,
  size = 'large',
  icon,
  iconRight,
  loading = false,
  disabled = false,
  color = 'primary',
  fullWidth = false,
  style,
}: ButtonProps) {
  // Map mode to variant if provided (backward compat)
  const effectiveVariant: ButtonVariant = mode 
    ? (mode === 'text' ? 'ghost' : mode === 'outlined' ? 'outline' : 'primary')
    : variant;
  const variantConfig = getVariantConfig(effectiveVariant, color);
  const contentStyle = getContentStyle(size);
  const labelStyle = getLabelStyle(size);
  const paperMode = getPaperMode(effectiveVariant);

  return (
    <PaperButton
      mode={paperMode}
      onPress={onPress}
      loading={loading}
      disabled={disabled || loading}
      icon={icon ? ({ size: iconSize }) => (
        <Icon name={icon} size={iconSize} color={variantConfig.textColor} />
      ) : undefined}
      buttonColor={variantConfig.backgroundColor}
      textColor={variantConfig.textColor}
      contentStyle={[
        contentStyle, 
        fullWidth && styles.fullWidth,
        iconRight && styles.iconRight,
      ]}
      labelStyle={labelStyle}
      style={[
        styles.base,
        effectiveVariant === 'outline' && { borderColor: variantConfig.borderColor },
        effectiveVariant === 'ghost' && styles.ghost,
        fullWidth && styles.fullWidth,
        style,
      ]}
    >
      {children}
    </PaperButton>
  );
}

function getPaperMode(variant: ButtonVariant): 'contained' | 'outlined' | 'text' {
  switch (variant) {
    case 'outline':
      return 'outlined';
    case 'ghost':
      return 'text';
    case 'secondary':
      return 'contained';
    default:
      return 'contained';
  }
}

interface VariantConfig {
  backgroundColor: string;
  textColor: string;
  borderColor: string;
}

function getVariantConfig(variant: ButtonVariant, color: ButtonColor): VariantConfig {
  const baseColor = getBaseColor(color);
  
  switch (variant) {
    case 'primary':
      return {
        backgroundColor: baseColor,
        textColor: colors.textInverse,
        borderColor: baseColor,
      };
    case 'secondary':
      return {
        backgroundColor: colors.surfaceVariant,
        textColor: colors.textPrimary,
        borderColor: colors.outline,
      };
    case 'outline':
      return {
        backgroundColor: 'transparent',
        textColor: baseColor,
        borderColor: baseColor,
      };
    case 'ghost':
      return {
        backgroundColor: 'transparent',
        textColor: colors.textSecondary,
        borderColor: 'transparent',
      };
    case 'destructive':
      return {
        backgroundColor: colors.error,
        textColor: colors.textInverse,
        borderColor: colors.error,
      };
    default:
      return {
        backgroundColor: baseColor,
        textColor: colors.textInverse,
        borderColor: baseColor,
      };
  }
}

function getBaseColor(color: ButtonColor): string {
  switch (color) {
    case 'success':
      return colors.success;
    case 'warning':
      return colors.warning;
    case 'error':
      return colors.error;
    default:
      return colors.primary;
  }
}

function getContentStyle(size: ButtonSize): ViewStyle {
  switch (size) {
    case 'small':
      return { paddingVertical: spacing.xs, paddingHorizontal: spacing.md };
    case 'medium':
      return { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg };
    default:
      return { paddingVertical: spacing.md, paddingHorizontal: spacing.xl };
  }
}

function getLabelStyle(size: ButtonSize): TextStyle {
  switch (size) {
    case 'small':
      return { ...typography.labelMedium, fontWeight: '500' };
    case 'medium':
      return { ...typography.labelLarge, fontWeight: '500' };
    default:
      return { ...typography.titleMedium, fontWeight: '600' };
  }
}

const styles = StyleSheet.create({
  base: {
    borderRadius: borderRadius.lg,
  },
  fullWidth: {
    width: '100%',
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  iconRight: {
    flexDirection: 'row-reverse',
  },
});
