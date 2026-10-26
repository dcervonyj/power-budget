import React from 'react';
import { Text } from 'react-native';
import { IntlProvider } from 'react-intl';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme/index.js';
import { renderGlassTabBar } from '../GlassTabBar.js';
import en from '../../../../assets/locales/en/shell.json';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const Tab = createBottomTabNavigator();

function Screen({ name }: { name: string }): React.JSX.Element {
  return <Text>{`screen ${name}`}</Text>;
}

function renderDashboard(): Promise<unknown> {
  return render(
    <ThemeProvider>
      <IntlProvider locale="en" messages={en}>
        <NavigationContainer>
          <Tab.Navigator tabBar={renderGlassTabBar} screenOptions={{ headerShown: false }}>
            <Tab.Screen name="Dashboard">{() => <Screen name="Dashboard" />}</Tab.Screen>
            <Tab.Screen name="Transactions">{() => <Screen name="Transactions" />}</Tab.Screen>
            <Tab.Screen name="ToSort" options={{ tabBarBadge: 7 }}>
              {() => <Screen name="ToSort" />}
            </Tab.Screen>
            <Tab.Screen name="Plans">{() => <Screen name="Plans" />}</Tab.Screen>
            <Tab.Screen name="Settings">{() => <Screen name="Settings" />}</Tab.Screen>
          </Tab.Navigator>
        </NavigationContainer>
      </IntlProvider>
    </ThemeProvider>,
  );
}

describe('GlassTabBar', () => {
  it('lists the four app tabs and keeps Settings out of the bar', async () => {
    await renderDashboard();

    expect(screen.getAllByRole('tab')).toHaveLength(4);
    expect(screen.queryByRole('tab', { name: 'Settings' })).toBeNull();
    expect(screen.getByRole('tab', { name: 'Overview' })).toBeSelected();
  });

  it('takes the To sort count from the tabBarBadge option', async () => {
    await renderDashboard();

    expect(screen.getByText('7', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /To sort/ })).toBeTruthy();
  });

  it('switches tab on press', async () => {
    await renderDashboard();

    await fireEvent.press(screen.getByRole('tab', { name: 'Transactions' }));

    expect(screen.getByRole('tab', { name: 'Transactions' })).toBeSelected();
    expect(screen.getByText('screen Transactions')).toBeTruthy();
  });
});
