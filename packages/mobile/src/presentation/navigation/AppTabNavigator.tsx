import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { AppTabParamList } from './types.js';
import { DashboardScreen } from '../screens/app/DashboardScreen.js';
import { TransactionListScreen } from '../screens/app/TransactionListScreen.js';
import { PlansListScreen } from '../screens/app/PlansListScreen.js';
import { SettingsScreen } from '../screens/app/SettingsScreen.js';

const Tab = createBottomTabNavigator<AppTabParamList>();

export function AppTabNavigator() {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Transactions" component={TransactionListScreen} />
      <Tab.Screen name="Plans" component={PlansListScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}
