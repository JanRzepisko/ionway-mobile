// =============================================================================
// Audix Design System - Premium Enterprise Theme
// =============================================================================

import { MD3LightTheme, configureFonts } from 'react-native-paper';
import { Platform, Dimensions } from 'react-native';

// Responsive helpers
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IS_TABLET = SCREEN_WIDTH >= 600;
const SPACING_MULTIPLIER = IS_TABLET ? 1.25 : 1;

// -----------------------------------------------------------------------------
// Color Palette
// -----------------------------------------------------------------------------

export const colors = {
  // Base
  white: '#ffffff',
  black: '#000000',
  
  // Primary
  primary: '#0285c6',
  primaryLight: '#e6f3fa',
  primaryDark: '#015177',
  primaryForeground: '#ffffff',
  
  // Secondary
  secondary: '#64748b',
  secondaryLight: '#f1f5f9',
  secondaryDark: '#334155',
  
  // Success
  success: '#10b981',
  successLight: '#d1fae5',
  successDark: '#047857',
  
  // Warning
  warning: '#f59e0b',
  warningLight: '#fef3c7',
  warningDark: '#b45309',
  
  // Error
  error: '#ef4444',
  errorLight: '#fee2e2',
  errorDark: '#b91c1c',
  
  // Info
  info: '#3b82f6',
  infoLight: '#dbeafe',
  infoDark: '#1d4ed8',
  
  // Neutral
  background: '#f8fafc',
  surface: '#ffffff',
  surfaceVariant: '#f1f5f9',
  outline: '#cbd5e1',
  outlineVariant: '#e2e8f0',
  
  // Text
  textPrimary: '#0f172a',
  textSecondary: '#475569',
  textDisabled: '#94a3b8',
  textInverse: '#ffffff',
  
  // Sync Status Colors
  syncPending: '#f59e0b',
  syncUploading: '#3b82f6',
  syncSynced: '#10b981',
  syncError: '#ef4444',
  syncConflict: '#8b5cf6',
  syncOffline: '#64748b',
};

// -----------------------------------------------------------------------------
// Typography
// -----------------------------------------------------------------------------

const fontConfig = {
  fontFamily: Platform.select({
    ios: 'System',
    android: 'Roboto',
    default: 'System',
  }),
};

export const typography = {
  // Display
  displayLarge: { fontSize: 32, fontWeight: '700' as const, lineHeight: 40 },
  displayMedium: { fontSize: 28, fontWeight: '700' as const, lineHeight: 36 },
  displaySmall: { fontSize: 24, fontWeight: '700' as const, lineHeight: 32 },
  
  // Headlines
  headlineLarge: { fontSize: 22, fontWeight: '600' as const, lineHeight: 28 },
  headlineMedium: { fontSize: 20, fontWeight: '600' as const, lineHeight: 26 },
  headlineSmall: { fontSize: 18, fontWeight: '600' as const, lineHeight: 24 },
  
  // Title
  titleLarge: { fontSize: 18, fontWeight: '500' as const, lineHeight: 24 },
  titleMedium: { fontSize: 16, fontWeight: '500' as const, lineHeight: 22 },
  titleSmall: { fontSize: 14, fontWeight: '500' as const, lineHeight: 20 },
  
  // Body
  bodyLarge: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
  bodyMedium: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  bodySmall: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },
  
  // Label
  labelLarge: { fontSize: 14, fontWeight: '500' as const, lineHeight: 20 },
  labelMedium: { fontSize: 12, fontWeight: '500' as const, lineHeight: 16 },
  labelSmall: { fontSize: 10, fontWeight: '500' as const, lineHeight: 14 },
};

// -----------------------------------------------------------------------------
// Spacing (responsive)
// -----------------------------------------------------------------------------

export const spacing = {
  xs: Math.round(4 * SPACING_MULTIPLIER),
  sm: Math.round(8 * SPACING_MULTIPLIER),
  md: Math.round(12 * SPACING_MULTIPLIER),
  lg: Math.round(16 * SPACING_MULTIPLIER),
  xl: Math.round(24 * SPACING_MULTIPLIER),
  xxl: Math.round(32 * SPACING_MULTIPLIER),
  xxxl: Math.round(48 * SPACING_MULTIPLIER),
};

// Base spacing (non-responsive, for fine-tuning)
export const baseSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

// Screen info export
export const screen = {
  width: SCREEN_WIDTH,
  isTablet: IS_TABLET,
  isPhone: !IS_TABLET,
};

// -----------------------------------------------------------------------------
// Border Radius
// -----------------------------------------------------------------------------

export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};

// -----------------------------------------------------------------------------
// Shadows
// -----------------------------------------------------------------------------

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
};

// -----------------------------------------------------------------------------
// React Native Paper Theme
// -----------------------------------------------------------------------------

export const paperTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: colors.primary,
    primaryContainer: colors.primaryLight,
    secondary: colors.secondary,
    secondaryContainer: colors.secondaryLight,
    tertiary: colors.info,
    tertiaryContainer: colors.infoLight,
    surface: colors.surface,
    surfaceVariant: colors.surfaceVariant,
    surfaceDisabled: colors.outlineVariant,
    background: colors.background,
    error: colors.error,
    errorContainer: colors.errorLight,
    onPrimary: colors.primaryForeground,
    onPrimaryContainer: colors.primaryDark,
    onSecondary: colors.textInverse,
    onSecondaryContainer: colors.secondaryDark,
    onTertiary: colors.textInverse,
    onTertiaryContainer: colors.infoDark,
    onSurface: colors.textPrimary,
    onSurfaceVariant: colors.textSecondary,
    onSurfaceDisabled: colors.textDisabled,
    onBackground: colors.textPrimary,
    onError: colors.textInverse,
    onErrorContainer: colors.errorDark,
    outline: colors.outline,
    outlineVariant: colors.outlineVariant,
    inverseSurface: colors.primaryDark,
    inverseOnSurface: colors.textInverse,
    inversePrimary: colors.primaryLight,
    elevation: {
      level0: 'transparent',
      level1: colors.surface,
      level2: colors.surfaceVariant,
      level3: colors.surfaceVariant,
      level4: colors.surfaceVariant,
      level5: colors.surfaceVariant,
    },
  },
  fonts: configureFonts({ config: fontConfig }),
  roundness: borderRadius.md,
};

// -----------------------------------------------------------------------------
// Sync Status Helpers
// -----------------------------------------------------------------------------

export type SyncStatusType = 
  | 'offline'
  | 'local_only'
  | 'pending_upload'
  | 'uploading'
  | 'synced'
  | 'upload_error'
  | 'conflict';

export interface SyncStatusConfig {
  label: string;
  description: string;
  icon: string;
  color: string;
  backgroundColor: string;
}

export const syncStatusConfig: Record<SyncStatusType, SyncStatusConfig> = {
  offline: {
    label: 'Brak internetu',
    description: 'Brak połączenia z serwerem',
    icon: 'wifi-off',
    color: colors.syncOffline,
    backgroundColor: colors.surfaceVariant,
  },
  local_only: {
    label: 'Zapisano lokalnie',
    description: 'Dane zapisane tylko na urządzeniu',
    icon: 'content-save-outline',
    color: colors.syncPending,
    backgroundColor: colors.warningLight,
  },
  pending_upload: {
    label: 'Oczekuje na wysłanie',
    description: 'Dane gotowe do wysłania',
    icon: 'cloud-upload-outline',
    color: colors.syncPending,
    backgroundColor: colors.warningLight,
  },
  uploading: {
    label: 'Wysyłanie...',
    description: 'Trwa wysyłanie danych',
    icon: 'cloud-sync-outline',
    color: colors.syncUploading,
    backgroundColor: colors.infoLight,
  },
  synced: {
    label: 'Zsynchronizowano',
    description: 'Dane zsynchronizowane z serwerem',
    icon: 'cloud-check-outline',
    color: colors.syncSynced,
    backgroundColor: colors.successLight,
  },
  upload_error: {
    label: 'Błąd wysyłki',
    description: 'Wystąpił błąd podczas wysyłania',
    icon: 'cloud-alert-outline',
    color: colors.syncError,
    backgroundColor: colors.errorLight,
  },
  conflict: {
    label: 'Konflikt danych',
    description: 'Wykryto konflikt danych',
    icon: 'alert-circle-outline',
    color: colors.syncConflict,
    backgroundColor: '#f3e8ff',
  },
};

export function getSyncStatusColor(status: string): string {
  const config = syncStatusConfig[status as SyncStatusType];
  return config?.color || colors.syncOffline;
}

export function getSyncStatusLabel(status: string): string {
  const config = syncStatusConfig[status as SyncStatusType];
  return config?.label || 'Nieznany status';
}

export function getSyncStatusIcon(status: string): string {
  const config = syncStatusConfig[status as SyncStatusType];
  return config?.icon || 'cloud-off-outline';
}

export function getSyncStatusDescription(status: string): string {
  const config = syncStatusConfig[status as SyncStatusType];
  return config?.description || '';
}

// -----------------------------------------------------------------------------
// Role Helpers
// -----------------------------------------------------------------------------

export type UserRole = 'admin' | 'coordinator' | 'auditor';

export interface RoleConfig {
  label: string;
  color: string;
  backgroundColor: string;
}

export const roleConfig: Record<UserRole, RoleConfig> = {
  admin: {
    label: 'Administrator',
    color: colors.primaryDark,
    backgroundColor: colors.primaryLight,
  },
  coordinator: {
    label: 'Koordynator',
    color: colors.info,
    backgroundColor: colors.infoLight,
  },
  auditor: {
    label: 'Audytor',
    color: colors.success,
    backgroundColor: colors.successLight,
  },
};

export function getRoleLabel(role: UserRole): string {
  return roleConfig[role]?.label || role;
}

export function getRoleColor(role: UserRole): string {
  return roleConfig[role]?.color || colors.textSecondary;
}

// -----------------------------------------------------------------------------
// Gradient Helpers
// -----------------------------------------------------------------------------

export const gradients = {
  primary: {
    colors: [colors.primary, colors.primaryDark] as const,
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  primaryLight: {
    colors: [colors.primaryLight, '#ffffff'] as const,
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  surface: {
    colors: [colors.surface, colors.surfaceVariant] as const,
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
  },
};
