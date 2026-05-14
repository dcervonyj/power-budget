import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { AppStackParamList } from './types.js';
import { AppTabNavigator } from './AppTabNavigator.js';
import { TransactionDetailScreen } from '../screens/app/TransactionDetailScreen.js';
import { PlanEditorScreen } from '../screens/app/PlanEditorScreen.js';
import { PlanDashboardScreen } from '../screens/app/PlanDashboardScreen.js';
import { BankConnectionsScreen } from '../screens/app/BankConnectionsScreen.js';
import { AddBankConnectionScreen } from '../screens/app/AddBankConnectionScreen.js';
import { CategoriesScreen } from '../screens/app/CategoriesScreen.js';
import { HouseholdScreen } from '../screens/app/HouseholdScreen.js';
import { AuditLogScreen } from '../screens/app/AuditLogScreen.js';

const Stack = createNativeStackNavigator<AppStackParamList>();

export function AppStackNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Tabs" component={AppTabNavigator} options={{ headerShown: false }} />
      <Stack.Screen name="TransactionDetail" component={TransactionDetailScreen} />
      <Stack.Screen name="PlanEditor" component={PlanEditorScreen} />
      <Stack.Screen name="PlanDashboard" component={PlanDashboardScreen} />
      <Stack.Screen name="BankConnections" component={BankConnectionsScreen} />
      <Stack.Screen name="AddBankConnection" component={AddBankConnectionScreen} />
      <Stack.Screen name="Categories" component={CategoriesScreen} />
      <Stack.Screen name="Household" component={HouseholdScreen} />
      <Stack.Screen name="AuditLog" component={AuditLogScreen} />
    </Stack.Navigator>
  );
}
