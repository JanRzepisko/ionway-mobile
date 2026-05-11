// =============================================================================
// Audix - Offline-First Audit Application
// =============================================================================

import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaperProvider } from 'react-native-paper';
import { AppNavigator } from './src/navigation/AppNavigator';
import { paperTheme } from './src/theme';
import { getDatabase } from './src/database/schema';
import { useSettingsStore } from './src/stores/settingsStore';

export default function App() {
  const loadSettings = useSettingsStore(state => state.loadSettings);
  
  useEffect(() => {
    // Initialize database and settings on app start
    getDatabase().catch(console.error);
    loadSettings();
  }, []);

  return (
    <SafeAreaProvider>
      <PaperProvider theme={paperTheme}>
        <StatusBar style="auto" />
        <AppNavigator />
      </PaperProvider>
    </SafeAreaProvider>
  );
}
