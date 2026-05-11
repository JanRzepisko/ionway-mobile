// =============================================================================
// Loading State Components
// Professional loading indicators and skeleton loaders
// =============================================================================

import React from 'react';
import { View, StyleSheet, ActivityIndicator, Animated, Easing } from 'react-native';
import { Text, Surface } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography } from '../../theme';

interface LoadingStateProps {
  title?: string;
  description?: string;
  size?: 'small' | 'medium' | 'large';
}

export function LoadingState({
  title = 'Ładowanie...',
  description,
  size = 'medium',
}: LoadingStateProps) {
  const indicatorSize = size === 'small' ? 'small' : 'large';
  const spinnerSize = size === 'small' ? 24 : size === 'medium' ? 36 : 48;

  return (
    <View style={styles.container}>
      <ActivityIndicator size={indicatorSize} color={colors.primary} />
      
      {size !== 'small' && (
        <>
          <Text style={styles.title}>{title}</Text>
          {description && (
            <Text style={styles.description}>{description}</Text>
          )}
        </>
      )}
    </View>
  );
}

// Spinner component for inline use
interface LoadingSpinnerProps {
  size?: number;
  color?: string;
}

export function LoadingSpinner({
  size = 24,
  color = colors.primary,
}: LoadingSpinnerProps) {
  return <ActivityIndicator size={size < 30 ? 'small' : 'large'} color={color} />;
}

// Full screen loading overlay
interface LoadingOverlayProps {
  visible: boolean;
  title?: string;
  description?: string;
}

export function LoadingOverlay({
  visible,
  title = 'Przetwarzanie...',
  description,
}: LoadingOverlayProps) {
  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <Surface style={styles.overlayCard} elevation={4}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.overlayTitle}>{title}</Text>
        {description && (
          <Text style={styles.overlayDescription}>{description}</Text>
        )}
      </Surface>
    </View>
  );
}

// Skeleton components for content loading
interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: object;
}

export function Skeleton({
  width = '100%',
  height = 16,
  borderRadius: br = borderRadius.sm,
  style,
}: SkeletonProps) {
  const animatedValue = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [animatedValue]);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius: br,
          opacity,
        },
        style,
      ]}
    />
  );
}

// Pre-built skeleton components
export function SkeletonCard() {
  return (
    <View style={styles.skeletonCard}>
      <Skeleton width="30%" height={14} />
      <Skeleton width="70%" height={24} style={{ marginTop: spacing.sm }} />
      <Skeleton width="50%" height={14} style={{ marginTop: spacing.sm }} />
    </View>
  );
}

export function SkeletonListItem() {
  return (
    <View style={styles.skeletonListItem}>
      <Skeleton width={48} height={48} borderRadius={borderRadius.md} />
      <View style={styles.skeletonListItemContent}>
        <Skeleton width="60%" height={16} />
        <Skeleton width="80%" height={14} style={{ marginTop: spacing.xs }} />
        <Skeleton width="40%" height={12} style={{ marginTop: spacing.xs }} />
      </View>
    </View>
  );
}

export function SkeletonForm() {
  return (
    <View style={styles.skeletonForm}>
      <Skeleton width="30%" height={12} />
      <Skeleton width="100%" height={48} style={{ marginTop: spacing.xs }} />
      <Skeleton width="30%" height={12} style={{ marginTop: spacing.lg }} />
      <Skeleton width="100%" height={48} style={{ marginTop: spacing.xs }} />
      <Skeleton width="30%" height={12} style={{ marginTop: spacing.lg }} />
      <Skeleton width="100%" height={100} style={{ marginTop: spacing.xs }} />
    </View>
  );
}

// Sync loading indicator
interface SyncLoadingProps {
  title?: string;
  progress?: number;
}

export function SyncLoading({
  title = 'Synchronizacja...',
  progress,
}: SyncLoadingProps) {
  const spinAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    animation.start();
    return () => animation.stop();
  }, [spinAnim]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.syncContainer}>
      <Animated.View style={{ transform: [{ rotate: spin }] }}>
        <Icon name="cloud-sync" size={48} color={colors.primary} />
      </Animated.View>
      <Text style={styles.syncTitle}>{title}</Text>
      {progress !== undefined && (
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
          <Text style={styles.progressText}>{Math.round(progress)}%</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  title: {
    ...typography.titleMedium,
    color: colors.textPrimary,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  description: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    maxWidth: 280,
  },

  // Overlay
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  overlayCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    minWidth: 200,
  },
  overlayTitle: {
    ...typography.titleMedium,
    color: colors.textPrimary,
    marginTop: spacing.lg,
  },
  overlayDescription: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },

  // Skeleton
  skeleton: {
    backgroundColor: colors.surfaceVariant,
  },
  skeletonCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  skeletonListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  skeletonListItemContent: {
    flex: 1,
  },
  skeletonForm: {
    padding: spacing.lg,
  },

  // Sync loading
  syncContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  syncTitle: {
    ...typography.titleMedium,
    color: colors.textPrimary,
    marginTop: spacing.lg,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
    width: '100%',
    maxWidth: 250,
  },
  progressTrack: {
    flex: 1,
    height: 8,
    backgroundColor: colors.surfaceVariant,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  progressText: {
    ...typography.labelMedium,
    color: colors.primary,
    minWidth: 40,
    textAlign: 'right',
  },
});
