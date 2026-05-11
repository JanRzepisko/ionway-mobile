// =============================================================================
// App Navigator - Main navigation structure
// =============================================================================

import React, { useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { colors, typography } from '../theme';
import { useAuthStore } from '../stores/authStore';

// Screens
import { LoginScreen } from '../screens/LoginScreen';
import { DevicesScreen } from '../screens/DevicesScreen';
import { MyAuditsScreen } from '../screens/MyAuditsScreen';
import { AuditFormScreen } from '../screens/AuditFormScreen';
import { AddDeviceScreen } from '../screens/AddDeviceScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { NewFormScreen } from '../screens/NewFormScreen';
import { DemoFormScreen } from '../screens/DemoFormScreen';

// Types
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  AuditForm: { deviceId: string; deviceIds?: string[]; sessionId?: string; preview?: boolean };
  AddDevice: undefined;
  NewForm: undefined;
  DemoForm: undefined;
};

export type MainTabParamList = {
  Elements: undefined;
  MyAudits: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

// Main tabs
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.outlineVariant,
          paddingTop: 8,
          paddingBottom: 8,
          height: 70,
        },
        tabBarLabelStyle: {
          ...typography.labelMedium,
          marginTop: 4,
        },
      }}
    >
      <Tab.Screen
        name="Elements"
        component={DevicesScreen}
        options={{
          tabBarLabel: 'Elementy',
          tabBarIcon: ({ color, size }) => (
            <Icon name="format-list-checkbox" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="MyAudits"
        component={MyAuditsScreen}
        options={{
          tabBarLabel: 'Moje audyty',
          tabBarIcon: ({ color, size }) => (
            <Icon name="clipboard-check" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: 'Ustawienia',
          tabBarIcon: ({ color, size }) => (
            <Icon name="cog" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

// Root navigator
export function AppNavigator() {
  const { isAuthenticated, isLoading, loadStoredAuth } = useAuthStore();

  useEffect(() => {
    loadStoredAuth();
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      >
        {!isAuthenticated ? (
          <Stack.Screen name="Auth" component={LoginScreen} />
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen 
              name="AuditForm" 
              component={AuditFormScreen}
              options={{
                presentation: 'fullScreenModal',
                animation: 'slide_from_bottom',
              }}
            />
            <Stack.Screen 
              name="AddDevice" 
              component={AddDeviceScreen}
              options={{
                presentation: 'modal',
                animation: 'slide_from_bottom',
              }}
            />
            <Stack.Screen 
              name="NewForm" 
              component={NewFormScreen}
              options={{
                presentation: 'fullScreenModal',
                animation: 'slide_from_bottom',
              }}
            />
            <Stack.Screen 
              name="DemoForm" 
              component={DemoFormScreen}
              options={{
                presentation: 'modal',
                animation: 'slide_from_bottom',
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
