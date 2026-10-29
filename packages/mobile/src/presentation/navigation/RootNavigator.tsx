import React from 'react';
import { View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types.js';
import { AuthStackNavigator } from './AuthStackNavigator.js';
import { AppStackNavigator } from './AppStackNavigator.js';
import { useIsAuthenticated } from './useIsAuthenticated.js';
import { useOnboardingGate } from './useOnboardingGate.js';
import { OnboardingScreen } from '../screens/onboarding/OnboardingScreen.js';
import { onboardingApi, tokenStore } from '../../infrastructure/index.js';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator(): React.JSX.Element {
  const isAuthenticated = useIsAuthenticated(tokenStore);
  const gate = useOnboardingGate(isAuthenticated, onboardingApi);

  if (isAuthenticated && gate.status === 'checking') {
    return <View testID="onboarding-gate-loading" style={{ flex: 1 }} />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isAuthenticated && <Stack.Screen name="Auth" component={AuthStackNavigator} />}
      {isAuthenticated && gate.status === 'needed' && (
        <Stack.Screen name="Onboarding">
          {(): React.JSX.Element => (
            <OnboardingScreen api={onboardingApi} onCompleted={gate.markCompleted} />
          )}
        </Stack.Screen>
      )}
      {isAuthenticated && gate.status === 'completed' && (
        <Stack.Screen name="App" component={AppStackNavigator} />
      )}
    </Stack.Navigator>
  );
}
