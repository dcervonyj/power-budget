import React, { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { AccountMenuView } from './AccountMenuView.js';
import type { AccountMenuEntry } from './AccountMenuView.js';
import { useShellLabels } from './useShellLabels.js';
import type { AccountMenuKey } from './useShellLabels.js';
import type { AppStackParamList } from './types.js';

const ENTRIES: readonly { key: AccountMenuKey; icon: AccountMenuEntry['icon'] }[] = [
  { key: 'settings', icon: 'settings' },
  { key: 'categories', icon: 'categories' },
  { key: 'household', icon: 'users' },
  { key: 'banks', icon: 'bank' },
  { key: 'audit', icon: 'clock' },
];

/** Account menu of the app shell; each entry opens its screen on the app stack. */
export function AccountMenu(): React.JSX.Element {
  const labels = useShellLabels();
  const navigation = useNavigation<NavigationProp<AppStackParamList>>();
  const [open, setOpen] = useState(false);
  const entries = ENTRIES.map((entry) => ({ ...entry, label: labels.menuItem(entry.key) }));

  function select(key: AccountMenuKey): void {
    setOpen(false);
    if (key === 'settings') {
      navigation.navigate('Tabs', { screen: 'Settings' });
    } else if (key === 'categories') {
      navigation.navigate('Categories');
    } else if (key === 'household') {
      navigation.navigate('Household');
    } else if (key === 'banks') {
      navigation.navigate('BankConnections');
    } else {
      navigation.navigate('AuditLog');
    }
  }

  function openMenu(): void {
    setOpen(true);
  }

  function closeMenu(): void {
    setOpen(false);
  }

  return (
    <AccountMenuView
      buttonLabel={labels.accountMenu()}
      entries={entries}
      open={open}
      onOpen={openMenu}
      onClose={closeMenu}
      onSelect={select}
    />
  );
}
