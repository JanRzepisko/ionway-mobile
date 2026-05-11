// =============================================================================
// Error State Components
// Clear, helpful error displays without technical chaos
// =============================================================================

import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text, Surface } from 'react-native-paper';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors, spacing, borderRadius, typography } from '../../theme';
import { Button } from './Button';

interface ErrorStateProps {
  title?: string;
  description?: string;
  error?: Error | string;
  showDetails?: boolean;
  onRetry?: () => void;
  onBack?: () => void;
}

export function ErrorState({
  title = 'Wystąpił błąd',
  description = 'Coś poszło nie tak. Spróbuj ponownie później.',
  error,
  showDetails = true,
  onRetry,
  onBack,
}: ErrorStateProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const errorMessage = error instanceof Error ? error.message : error;

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Icon name="alert-circle" size={48} color={colors.error} />
      </View>

      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>

      <View style={styles.actions}>
        {onRetry && (
          <Button onPress={onRetry} size="large" icon="refresh">
            Spróbuj ponownie
          </Button>
        )}
        {onBack && (
          <Button onPress={onBack} variant="outline" size="large">
            Wróć
          </Button>
        )}
      </View>

      {showDetails && errorMessage && (
        <View style={styles.detailsContainer}>
          <TouchableOpacity
            onPress={() => setDetailsOpen(!detailsOpen)}
            style={styles.detailsToggle}
          >
            <Icon
              name={detailsOpen ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={colors.textSecondary}
            />
            <Text style={styles.detailsToggleText}>Szczegóły techniczne</Text>
          </TouchableOpacity>

          {detailsOpen && (
            <Surface style={styles.detailsContent} elevation={0}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </ScrollView>
            </Surface>
          )}
        </View>
      )}
    </View>
  );
}

// Pre-configured error states for common scenarios

export function NetworkError({ onRetry }: { onRetry?: () => void }) {
  return (
    <View style={styles.container}>
      <View style={[styles.iconContainer, { backgroundColor: colors.surfaceVariant }]}>
        <Icon name="wifi-off" size={48} color={colors.textSecondary} />
      </View>

      <Text style={styles.title}>Brak połączenia</Text>
      <Text style={styles.description}>
        Sprawdź połączenie internetowe i spróbuj ponownie.
      </Text>

      {onRetry && (
        <View style={styles.actions}>
          <Button onPress={onRetry} variant="outline" size="large" icon="refresh">
            Spróbuj ponownie
          </Button>
        </View>
      )}
    </View>
  );
}

export function ServerError({ onRetry }: { onRetry?: () => void }) {
  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Icon name="server-off" size={48} color={colors.error} />
      </View>

      <Text style={styles.title}>Błąd serwera</Text>
      <Text style={styles.description}>
        Serwer nie odpowiada prawidłowo. Spróbuj ponownie za chwilę.
      </Text>

      {onRetry && (
        <View style={styles.actions}>
          <Button onPress={onRetry} variant="outline" size="large" icon="refresh">
            Spróbuj ponownie
          </Button>
        </View>
      )}
    </View>
  );
}

export function NotFoundError({
  resource = 'Zasób',
  onBack,
}: {
  resource?: string;
  onBack?: () => void;
}) {
  return (
    <View style={styles.container}>
      <View style={[styles.iconContainer, { backgroundColor: colors.surfaceVariant }]}>
        <Icon name="file-search-outline" size={48} color={colors.textSecondary} />
      </View>

      <Text style={styles.title}>Nie znaleziono</Text>
      <Text style={styles.description}>
        {resource} nie został znaleziony. Mógł zostać usunięty lub przeniesiony.
      </Text>

      {onBack && (
        <View style={styles.actions}>
          <Button onPress={onBack} variant="outline" size="large">
            Wróć
          </Button>
        </View>
      )}
    </View>
  );
}

export function SyncError({
  onRetry,
  pendingCount,
}: {
  onRetry?: () => void;
  pendingCount?: number;
}) {
  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Icon name="cloud-alert" size={48} color={colors.error} />
      </View>

      <Text style={styles.title}>Błąd synchronizacji</Text>
      <Text style={styles.description}>
        Nie udało się zsynchronizować danych. Twoje dane są bezpieczne na urządzeniu.
      </Text>

      {pendingCount !== undefined && pendingCount > 0 && (
        <View style={styles.pendingBadge}>
          <Icon name="cloud-upload-outline" size={16} color={colors.warning} />
          <Text style={styles.pendingText}>
            {pendingCount} {pendingCount === 1 ? 'rekord oczekuje' : 'rekordów oczekuje'} na wysłanie
          </Text>
        </View>
      )}

      {onRetry && (
        <View style={styles.actions}>
          <Button onPress={onRetry} size="large" icon="refresh">
            Ponów synchronizację
          </Button>
        </View>
      )}
    </View>
  );
}

// Inline error banner for top of screen
interface ErrorBannerProps {
  message: string;
  onDismiss?: () => void;
  onRetry?: () => void;
}

export function ErrorBanner({ message, onDismiss, onRetry }: ErrorBannerProps) {
  return (
    <Surface style={styles.banner} elevation={2}>
      <Icon name="alert-circle" size={20} color={colors.error} />
      <Text style={styles.bannerText} numberOfLines={2}>{message}</Text>
      <View style={styles.bannerActions}>
        {onRetry && (
          <TouchableOpacity onPress={onRetry} style={styles.bannerButton}>
            <Icon name="refresh" size={20} color={colors.error} />
          </TouchableOpacity>
        )}
        {onDismiss && (
          <TouchableOpacity onPress={onDismiss} style={styles.bannerButton}>
            <Icon name="close" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
    </Surface>
  );
}

// Inline error message for form fields
interface InlineErrorProps {
  message: string;
}

export function InlineError({ message }: InlineErrorProps) {
  return (
    <View style={styles.inlineError}>
      <Icon name="alert-circle-outline" size={14} color={colors.error} />
      <Text style={styles.inlineErrorText}>{message}</Text>
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
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.errorLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.headlineMedium,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  description: {
    ...typography.bodyLarge,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 300,
    marginBottom: spacing.lg,
  },
  actions: {
    gap: spacing.md,
    marginTop: spacing.md,
  },
  detailsContainer: {
    width: '100%',
    maxWidth: 400,
    marginTop: spacing.xl,
  },
  detailsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  detailsToggleText: {
    ...typography.labelMedium,
    color: colors.textSecondary,
  },
  detailsContent: {
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  errorText: {
    ...typography.bodySmall,
    fontFamily: 'monospace',
    color: colors.textSecondary,
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.warningLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    marginBottom: spacing.lg,
  },
  pendingText: {
    ...typography.labelMedium,
    color: colors.warning,
  },

  // Banner
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.errorLight,
    borderRadius: borderRadius.md,
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
  },
  bannerText: {
    ...typography.bodySmall,
    color: colors.error,
    flex: 1,
  },
  bannerActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  bannerButton: {
    padding: spacing.xs,
  },

  // Inline error
  inlineError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  inlineErrorText: {
    ...typography.bodySmall,
    color: colors.error,
  },
});
