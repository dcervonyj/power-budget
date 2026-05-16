import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { AuthStackParamList } from './types.js';
import { LoginScreen } from '../screens/auth/LoginScreen.js';
import { RegisterScreen } from '../screens/auth/RegisterScreen.js';
import { MagicLinkScreen } from '../screens/auth/MagicLinkScreen.js';
import { TotpEnrollmentScreen } from '../screens/auth/TotpEnrollmentScreen.js';
import { OAuthCallbackScreen } from '../screens/auth/OAuthCallbackScreen.js';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthStackNavigator() {
  return (
    <Stack.Navigator initialRouteName="Login">
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="MagicLink" component={MagicLinkScreen} />
      <Stack.Screen name="TotpEnrollment" component={TotpEnrollmentScreen} />
      <Stack.Screen
        name="OAuthCallback"
        component={OAuthCallbackScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}
