import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { AppTabParamList } from './types.js';
import { DashboardScreen } from '../screens/app/DashboardScreen.js';
import { TransactionListScreen } from '../screens/app/TransactionListScreen.js';
import { ToSortScreen } from '../screens/app/ToSortScreen.js';
import { PlansListScreen } from '../screens/app/PlansListScreen.js';
import { SettingsScreen } from '../screens/app/SettingsScreen.js';
import { renderGlassTabBar } from './GlassTabBar.js';
import { renderTabHeader } from './headers.js';
import { ShellBackground } from './ShellBackground.js';
import { useShellLabels } from './useShellLabels.js';

const Tab = createBottomTabNavigator<AppTabParamList>();

const TRANSPARENT_SCENE = { backgroundColor: 'transparent' } as const;

export function AppTabNavigator(): React.JSX.Element {
  const labels = useShellLabels();

  return (
    <ShellBackground>
      <Tab.Navigator
        tabBar={renderGlassTabBar}
        screenOptions={{ header: renderTabHeader, sceneStyle: TRANSPARENT_SCENE }}
      >
        <Tab.Screen
          name="Dashboard"
          component={DashboardScreen}
          options={{ title: labels.title('overview') }}
        />
        <Tab.Screen
          name="Transactions"
          component={TransactionListScreen}
          options={{ title: labels.title('transactions') }}
        />
        <Tab.Screen
          name="ToSort"
          component={ToSortScreen}
          options={{ title: labels.title('toSort') }}
        />
        <Tab.Screen
          name="Plans"
          component={PlansListScreen}
          options={{ title: labels.title('plan') }}
        />
        <Tab.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ title: labels.title('settings') }}
        />
      </Tab.Navigator>
    </ShellBackground>
  );
}
