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
import { AddExpenseScreen } from '../screens/app/AddExpenseScreen.js';
import { renderStackHeader } from './headers.js';
import { useShellLabels } from './useShellLabels.js';

const Stack = createNativeStackNavigator<AppStackParamList>();

export function AppStackNavigator(): React.JSX.Element {
  const labels = useShellLabels();

  return (
    <Stack.Navigator screenOptions={{ header: renderStackHeader }}>
      <Stack.Screen name="Tabs" component={AppTabNavigator} options={{ headerShown: false }} />
      <Stack.Screen
        name="TransactionDetail"
        component={TransactionDetailScreen}
        options={{ title: labels.title('transaction') }}
      />
      <Stack.Screen
        name="PlanEditor"
        component={PlanEditorScreen}
        options={{ title: labels.title('planEditor') }}
      />
      <Stack.Screen
        name="PlanDashboard"
        component={PlanDashboardScreen}
        options={{ title: labels.title('planDashboard') }}
      />
      <Stack.Screen
        name="BankConnections"
        component={BankConnectionsScreen}
        options={{ title: labels.title('banks') }}
      />
      <Stack.Screen
        name="AddBankConnection"
        component={AddBankConnectionScreen}
        options={{ title: labels.title('addBank') }}
      />
      <Stack.Screen
        name="Categories"
        component={CategoriesScreen}
        options={{ title: labels.title('categories') }}
      />
      <Stack.Screen
        name="Household"
        component={HouseholdScreen}
        options={{ title: labels.title('household') }}
      />
      <Stack.Screen
        name="AuditLog"
        component={AuditLogScreen}
        options={{ title: labels.title('audit') }}
      />
      <Stack.Screen
        name="AddExpense"
        component={AddExpenseScreen}
        options={{ title: labels.title('addExpense'), presentation: 'modal' }}
      />
    </Stack.Navigator>
  );
}
