import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types.js';
import { AuthStackNavigator } from './AuthStackNavigator.js';
import { AppStackNavigator } from './AppStackNavigator.js';
import { useIsAuthenticated } from './useIsAuthenticated.js';
import { tokenStore } from '../../infrastructure/index.js';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator(): React.JSX.Element {
  const isAuthenticated = useIsAuthenticated(tokenStore);

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
