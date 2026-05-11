// =============================================================================
// Login Screen
// Supports offline access for previously authenticated users
// =============================================================================

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, TouchableOpacity, StatusBar, ScrollView } from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { colors, spacing, typography, borderRadius, screen } from '../theme';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useAuthStore } from '../stores/authStore';
import { checkApiConnection } from '../services/api';

export function LoginScreen() {
  const { login, tryOfflineAccess, isLoading, error, clearError } = useAuthStore();
  const insets = useSafeAreaInsets();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [hasStoredSession, setHasStoredSession] = useState(false);
  const [storedUserName, setStoredUserName] = useState('');

  // Check connection and stored session on mount
  useEffect(() => {
    const checkStatus = async () => {
      const online = await checkApiConnection();
      setIsOnline(online);
      
      const userJson = await SecureStore.getItemAsync('audix_user');
      if (userJson) {
        setHasStoredSession(true);
        try {
          const user = JSON.parse(userJson);
          setStoredUserName(`${user.firstName} ${user.lastName}`);
        } catch {
          // Ignore parse errors
        }
      }
    };
    
    checkStatus();
    const interval = setInterval(checkStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) return;
    await login(email.trim(), password);
  };

  const handleOfflineAccess = async () => {
    await tryOfflineAccess();
  };

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <View style={styles.logo}>
            <Icon name="clipboard-check-outline" size={48} color={colors.primaryForeground} />
          </View>
          <Text style={styles.title}>AUDIX</Text>
          <Text style={styles.subtitle}>Audyty offline-first</Text>
        </View>

        {/* Connection status */}
        <View style={[styles.statusBanner, !isOnline && styles.offlineBanner]}>
          <Icon 
            name={isOnline ? 'wifi' : 'wifi-off'} 
            size={18} 
            color={isOnline ? colors.success : colors.warning} 
          />
          <Text style={[styles.statusText, !isOnline && styles.offlineText]}>
            {isOnline ? 'Połączono z serwerem' : 'Brak połączenia z serwerem'}
          </Text>
        </View>

        {/* Login form */}
        <Card variant="elevated" style={styles.card}>
          <Text style={styles.cardTitle}>Zaloguj się</Text>
          
          {error && (
            <View style={styles.errorBanner}>
              <Icon name="alert-circle" size={20} color={colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {isOnline ? (
            <>
              <View style={styles.field}>
                <TextInput
                  mode="outlined"
                  label="Email"
                  value={email}
                  onChangeText={(text) => { setEmail(text); clearError(); }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  left={<TextInput.Icon icon="email-outline" />}
                  style={styles.input}
                />
              </View>

              <View style={styles.field}>
                <TextInput
                  mode="outlined"
                  label="Hasło"
                  value={password}
                  onChangeText={(text) => { setPassword(text); clearError(); }}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  left={<TextInput.Icon icon="lock-outline" />}
                  right={
                    <TextInput.Icon 
                      icon={showPassword ? 'eye-off' : 'eye'} 
                      onPress={() => setShowPassword(!showPassword)}
                    />
                  }
                  style={styles.input}
                />
              </View>

              <Button
                onPress={handleLogin}
                loading={isLoading}
                disabled={!email.trim() || !password.trim() || isLoading}
                fullWidth
                icon="login"
              >
                Zaloguj
              </Button>
            </>
          ) : (
            <>
              <View style={styles.offlineMessage}>
                <Icon name="cloud-off-outline" size={48} color={colors.textSecondary} />
                <Text style={styles.offlineTitle}>Tryb offline</Text>
                <Text style={styles.offlineDesc}>
                  {hasStoredSession
                    ? 'Brak połączenia z serwerem. Możesz kontynuować pracę na wcześniej pobranych danych.'
                    : 'Brak połączenia z serwerem. Połącz się z internetem, aby się zalogować.'}
                </Text>
              </View>

              {hasStoredSession && (
                <View style={styles.offlineAccessSection}>
                  <View style={styles.storedUserInfo}>
                    <View style={styles.storedUserAvatar}>
                      <Icon name="account" size={24} color={colors.primaryForeground} />
                    </View>
                    <View>
                      <Text style={styles.storedUserName}>{storedUserName}</Text>
                      <Text style={styles.storedUserHint}>Ostatnio zalogowany</Text>
                    </View>
                  </View>
                  
                  <Button
                    onPress={handleOfflineAccess}
                    loading={isLoading}
                    fullWidth
                    icon="folder-outline"
                    variant="outline"
                  >
                    Kontynuuj pracę offline
                  </Button>
                </View>
              )}
            </>
          )}
        </Card>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Aplikacja wymaga połączenia tylko do logowania i synchronizacji.
          </Text>
          <Text style={styles.footerText}>
            Audyty możesz przeprowadzać offline.
          </Text>
        </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    maxWidth: screen.isTablet ? 480 : undefined,
    width: '100%',
    alignSelf: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logo: {
    width: screen.isTablet ? 100 : 80,
    height: screen.isTablet ? 100 : 80,
    borderRadius: borderRadius.xl,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.displayLarge,
    fontSize: screen.isTablet ? 40 : 32,
    color: colors.primaryForeground,
    fontWeight: '700',
    letterSpacing: 2,
  },
  subtitle: {
    ...typography.bodyLarge,
    fontSize: screen.isTablet ? 18 : 16,
    color: 'rgba(255,255,255,0.8)',
    marginTop: spacing.sm,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    marginBottom: spacing.lg,
    gap: spacing.sm,
    alignSelf: 'center',
  },
  offlineBanner: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
  },
  statusText: {
    ...typography.labelMedium,
    color: colors.primaryForeground,
  },
  offlineText: {
    color: colors.warning,
  },
  card: {
    padding: spacing.xl,
  },
  cardTitle: {
    ...typography.headlineMedium,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.errorLight,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  errorText: {
    ...typography.bodyMedium,
    color: colors.error,
    flex: 1,
  },
  field: {
    marginBottom: spacing.md,
  },
  input: {
    backgroundColor: colors.surface,
  },
  offlineMessage: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  offlineTitle: {
    ...typography.titleLarge,
    color: colors.textPrimary,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  offlineDesc: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
  },
  offlineAccessSection: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
  },
  storedUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.lg,
  },
  storedUserAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storedUserName: {
    ...typography.titleMedium,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  storedUserHint: {
    ...typography.labelSmall,
    color: colors.textSecondary,
  },
  footer: {
    marginTop: spacing.xxl,
    alignItems: 'center',
  },
  footerText: {
    ...typography.bodySmall,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
});
