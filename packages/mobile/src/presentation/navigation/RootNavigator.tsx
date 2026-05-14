import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types.js';
import { AuthStackNavigator } from './AuthStackNavigator.js';
import { AppStackNavigator } from './AppStackNavigator.js';

const Stack = createNativeStackNavigator<RootStackParamList>();

// Placeholder: real auth state comes from AuthView in MOB-003
function useIsAuthenticated(): boolean {
  // TODO: wire from AuthView in MOB-003
  return false;
}

export function RootNavigator() {
  const isAuthenticated = useIsAuthenticated();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        <Stack.Screen name="App" component={AppStackNavigator} />
      ) : (
        <Stack.Screen name="Auth" component={AuthStackNavigator} />
      )}
    </Stack.Navigator>
  );
}
