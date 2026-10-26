import React from 'react';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import type { NavigationProp } from '@react-navigation/native';
import type { IconName } from '../glass/atoms/iconPaths.js';
import { TabBarView } from './TabBarView.js';
import type { TabBarItem } from './TabBarView.js';
import { useShellLabels } from './useShellLabels.js';
import type { ShellLabels, ShellTabKey } from './useShellLabels.js';
import type { AppStackParamList } from './types.js';

interface TabSpec {
  readonly key: ShellTabKey;
  readonly icon: IconName;
}

/** Navigator `tabBar` option: React Navigation calls it as a function, so hooks live in GlassTabBar. */
export function renderGlassTabBar(props: BottomTabBarProps): React.JSX.Element {
  return <GlassTabBar {...props} />;
}

/** The tab bar for the app tabs. The badge on a tab comes from its `tabBarBadge` option. */
export function GlassTabBar({
  state,
  descriptors,
  navigation,
  insets,
}: BottomTabBarProps): React.JSX.Element {
  const labels = useShellLabels();
  const items: TabBarItem[] = [];
  for (const [index, route] of state.routes.entries()) {
    const spec = specFor(route.name);
    if (spec !== undefined) {
      items.push(
        toItem(labels, spec, route.key, state.index === index, descriptors[route.key]?.options),
      );
    }
  }

  function select(key: string): void {
    const route = state.routes.find((candidate) => candidate.key === key);
    if (route === undefined) {
      return;
    }
    const event = navigation.emit({ type: 'tabPress', target: key, canPreventDefault: true });
    if (!event.defaultPrevented && state.routes[state.index]?.key !== key) {
      navigation.navigate(route.name, route.params);
    }
  }

  function add(): void {
    navigation.getParent<NavigationProp<AppStackParamList>>()?.navigate('AddExpense');
  }

  return (
    <TabBarView
      items={items}
      tabBarLabel={labels.tabBar()}
      addLabel={labels.addExpense()}
      bottomInset={insets.bottom}
      onSelect={select}
      onAdd={add}
    />
  );
}

function toItem(
  labels: ShellLabels,
  spec: TabSpec,
  key: string,
  focused: boolean,
  options: { readonly tabBarBadge?: number | string } | undefined,
): TabBarItem {
  const badge = typeof options?.tabBarBadge === 'number' ? options.tabBarBadge : undefined;
  return {
    key,
    label: labels.tab(spec.key),
    icon: spec.icon,
    focused,
    badge,
  };
}

/** Visible tabs by route name; routes not listed here (Settings) stay out of the bar. */
function specFor(routeName: string): TabSpec | undefined {
  switch (routeName) {
    case 'Dashboard':
      return { key: 'overview', icon: 'dashboard' };
    case 'Transactions':
      return { key: 'transactions', icon: 'transactions' };
    case 'ToSort':
      return { key: 'toSort', icon: 'tag' };
    case 'Plans':
      return { key: 'plan', icon: 'plan' };
    default:
      return undefined;
  }
}
