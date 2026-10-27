import React from 'react';
import { IntlProvider } from 'react-intl';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme/index.js';
import { AccountMenuView } from '../AccountMenuView.js';
import { GlassHeader } from '../GlassHeader.js';
import { TabBarView } from '../TabBarView.js';
import type { TabBarItem } from '../TabBarView.js';
import { useShellLabels } from '../useShellLabels.js';
import type { ShellTabKey } from '../useShellLabels.js';
import en from '../../../../assets/locales/en/shell.json';
import pl from '../../../../assets/locales/pl/shell.json';
import ru from '../../../../assets/locales/ru/shell.json';
import uk from '../../../../assets/locales/uk/shell.json';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const MESSAGES = { en, pl, ru, uk } as const;
type Locale = keyof typeof MESSAGES;

const TABS: readonly { key: ShellTabKey; icon: TabBarItem['icon'] }[] = [
  { key: 'overview', icon: 'dashboard' },
  { key: 'transactions', icon: 'transactions' },
  { key: 'toSort', icon: 'tag' },
  { key: 'plan', icon: 'plan' },
];

function wrap(element: React.ReactElement, locale: Locale = 'en'): React.JSX.Element {
  return (
    <ThemeProvider>
      <IntlProvider locale={locale} messages={MESSAGES[locale]}>
        {element}
      </IntlProvider>
    </ThemeProvider>
  );
}

function TabBarFixture({
  badge,
  focused = 'overview',
  onSelect = noop,
  onAdd = noop,
}: {
  badge?: number;
  focused?: ShellTabKey;
  onSelect?: (key: string) => void;
  onAdd?: () => void;
}): React.JSX.Element {
  const labels = useShellLabels();
  const items = TABS.map((tab) => ({
    key: tab.key,
    label: labels.tab(tab.key),
    icon: tab.icon,
    focused: tab.key === focused,
    badge: tab.key === 'toSort' ? badge : undefined,
  }));

  return (
    <TabBarView
      items={items}
      tabBarLabel={labels.tabBar()}
      addLabel={labels.addExpense()}
      onSelect={onSelect}
      onAdd={onAdd}
    />
  );
}

describe('TabBarView', () => {
  it('shows the four tab labels as tabs, one selected', async () => {
    await render(wrap(<TabBarFixture />));

    expect(screen.getAllByRole('tab')).toHaveLength(4);
    expect(screen.getByRole('tab', { name: 'Overview' })).toBeSelected();
    expect(screen.getByRole('tab', { name: 'Transactions' })).not.toBeSelected();
    expect(screen.getByRole('tab', { name: /To sort/ })).not.toBeSelected();
    expect(screen.getByRole('tab', { name: 'Plan' })).not.toBeSelected();
    expect(screen.getByLabelText('Main navigation')).toBeTruthy();
  });

  it('shows the count on To sort in the text and in the accessible name', async () => {
    await render(wrap(<TabBarFixture badge={12} />));

    expect(screen.getByText('12', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /To sort/ })).toBeTruthy();
  });

  it('caps a large count and hides a zero count', async () => {
    const { rerender } = await render(wrap(<TabBarFixture badge={120} />));

    expect(screen.getByText('99+', { includeHiddenElements: true })).toBeTruthy();

    await rerender(wrap(<TabBarFixture badge={0} />));

    expect(screen.queryByText('0', { includeHiddenElements: true })).toBeNull();
  });

  it('has a centre Add expense button between the tabs', async () => {
    const onAdd = jest.fn();
    await render(wrap(<TabBarFixture onAdd={onAdd} />));

    await fireEvent.press(screen.getByRole('button', { name: 'Add expense' }));

    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(screen.getAllByTestId('glass-blur', { includeHiddenElements: true })).toHaveLength(1);
  });

  it('reports the pressed tab', async () => {
    const onSelect = jest.fn();
    await render(wrap(<TabBarFixture onSelect={onSelect} />));

    await fireEvent.press(screen.getByRole('tab', { name: 'Plan' }));

    expect(onSelect).toHaveBeenCalledWith('plan');
  });

  it.each([
    ['pl', 'Przegląd', 'Do sortowania', 'Dodaj wydatek'],
    ['uk', 'Огляд', 'До сортування', 'Додати витрату'],
    ['ru', 'Обзор', 'К разбору', 'Добавить расход'],
  ] as const)('translates the labels in %s', async (locale, overview, toSort, add) => {
    await render(wrap(<TabBarFixture />, locale));

    expect(screen.getByRole('tab', { name: overview })).toBeTruthy();
    expect(screen.getByRole('tab', { name: toSort })).toBeTruthy();
    expect(screen.getByRole('button', { name: add })).toBeTruthy();
  });
});

describe('GlassHeader', () => {
  it('shows the title as a header and a back button only when asked', async () => {
    const onBack = jest.fn();
    const { rerender } = await render(
      wrap(<GlassHeader title="Transaction" backLabel="Back" onBack={onBack} />),
    );

    expect(screen.getByRole('header', { name: 'Transaction' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));

    expect(onBack).toHaveBeenCalledTimes(1);

    await rerender(wrap(<GlassHeader title="Overview" backLabel="Back" />));

    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
  });
});

describe('AccountMenuView', () => {
  const entries = [
    { key: 'settings', label: 'Settings', icon: 'settings' },
    { key: 'categories', label: 'Categories', icon: 'categories' },
    { key: 'household', label: 'Household', icon: 'users' },
    { key: 'banks', label: 'Banks', icon: 'bank' },
    { key: 'audit', label: 'Audit log', icon: 'clock' },
  ] as const;

  it('opens from the account button', async () => {
    const onOpen = jest.fn();
    await render(
      wrap(
        <AccountMenuView
          buttonLabel="Account menu"
          entries={entries}
          open={false}
          onOpen={onOpen}
          onClose={noop}
          onSelect={noop}
        />,
      ),
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Account menu' }));

    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menuitem', { name: 'Settings' })).toBeNull();
  });

  it('lists the five destinations and reports the chosen one', async () => {
    const onSelect = jest.fn();
    await render(
      wrap(
        <AccountMenuView
          buttonLabel="Account menu"
          entries={entries}
          open
          onOpen={noop}
          onClose={noop}
          onSelect={onSelect}
        />,
      ),
    );

    expect(screen.getAllByRole('menuitem').map(labelOf)).toEqual([
      'Settings',
      'Categories',
      'Household',
      'Banks',
      'Audit log',
    ]);
    await fireEvent.press(screen.getByRole('menuitem', { name: 'Banks' }));

    expect(onSelect).toHaveBeenCalledWith('banks');
  });
});

function labelOf(element: { props: { accessibilityLabel?: string } }): string | undefined {
  return element.props.accessibilityLabel;
}

function noop(): void {
  // No handler needed.
}
