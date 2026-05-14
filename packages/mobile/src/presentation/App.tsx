import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { RootNavigator } from './navigation/RootNavigator.js';

export function App() {
  return (
    <NavigationContainer>
      <RootNavigator />
      <StatusBar style="auto" />
    </NavigationContainer>
  );
}
