import React from 'react';
import { View } from 'react-native';
import { makeStyles } from '../theme/index.js';
import { AccountMenuView } from './AccountMenuView.js';
import type { AccountMenuEntry } from './AccountMenuView.js';
import { GlassHeader } from './GlassHeader.js';
import { ShellBackground } from './ShellBackground.js';
import { TabBarView } from './TabBarView.js';
import type { TabBarItem } from './TabBarView.js';

// Fixture copy lives in constants so the gallery stays free of JSX literals.
const ITEMS: readonly TabBarItem[] = [
  { key: 'overview', label: 'Overview', icon: 'dashboard', focused: true },
  { key: 'transactions', label: 'Transactions', icon: 'transactions', focused: false },
  {
    key: 'toSort',
    label: 'To sort',
    icon: 'tag',
    focused: false,
    badge: 12,
  },
  { key: 'plan', label: 'Plan', icon: 'plan', focused: false },
];
const ENTRIES: readonly AccountMenuEntry[] = [
  { key: 'settings', label: 'Settings', icon: 'settings' },
  { key: 'categories', label: 'Categories', icon: 'categories' },
  { key: 'household', label: 'Household', icon: 'users' },
  { key: 'banks', label: 'Banks', icon: 'bank' },
  { key: 'audit', label: 'Audit log', icon: 'clock' },
];
const TEXT = {
  tabBar: 'Main navigation',
  add: 'Add expense',
  back: 'Back',
  account: 'Account menu',
  overview: 'Overview',
  transaction: 'Transaction',
} as const;

const useStyles = makeStyles(() => ({
  stage: { minHeight: 640, justifyContent: 'space-between', overflow: 'hidden' },
  fill: { flex: 1 },
}));

/** Tab bar: Overview selected, a count on To sort, the centre Add expense button. */
export function TabBar(): React.JSX.Element {
  const styles = useStyles();

  return (
    <ShellBackground>
      <View style={styles.stage}>
        <View style={styles.fill} />
        <TabBarView
          items={ITEMS}
          tabBarLabel={TEXT.tabBar}
          addLabel={TEXT.add}
          bottomInset={16}
          onSelect={noop}
          onAdd={noop}
        />
      </View>
    </ShellBackground>
  );
}

/** Tab header with the account menu button, and a stack header with a back button. */
export function Headers(): React.JSX.Element {
  const styles = useStyles();

  return (
    <ShellBackground>
      <View style={styles.stage}>
        <GlassHeader
          title={TEXT.overview}
          backLabel={TEXT.back}
          topInset={24}
          right={
            <AccountMenuView
              buttonLabel={TEXT.account}
              entries={ENTRIES}
              open={false}
              onOpen={noop}
              onClose={noop}
              onSelect={noop}
            />
          }
        />
        <GlassHeader title={TEXT.transaction} backLabel={TEXT.back} onBack={noop} />
        <View style={styles.fill} />
      </View>
    </ShellBackground>
  );
}

/** The account menu opened from the header. */
export function AccountMenuOpen(): React.JSX.Element {
  const styles = useStyles();

  return (
    <ShellBackground>
      <View style={styles.stage}>
        <GlassHeader
          title={TEXT.overview}
          backLabel={TEXT.back}
          topInset={24}
          right={
            <AccountMenuView
              buttonLabel={TEXT.account}
              entries={ENTRIES}
              open
              onOpen={noop}
              onClose={noop}
              onSelect={noop}
            />
          }
        />
      </View>
    </ShellBackground>
  );
}

function noop(): void {
  // Fixture: no navigation.
}
