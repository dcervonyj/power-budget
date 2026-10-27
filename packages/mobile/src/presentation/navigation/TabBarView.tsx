import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { makeStyles, useGlass } from '../theme/index.js';
import { GlassPanel } from '../glass/material/GlassPanel.js';
import { Icon } from '../glass/atoms/Icon.js';
import type { IconName } from '../glass/atoms/iconPaths.js';
import { CountBadge } from '../glass/controls/CountBadge.js';
import { LABEL_FONT, TOUCH_TARGET } from '../glass/controls/fonts.js';

export interface TabBarItem {
  readonly key: string;
  readonly label: string;
  readonly icon: IconName;
  readonly focused: boolean;
  readonly badge?: number;
}

export interface TabBarViewProps {
  readonly items: readonly TabBarItem[];
  readonly tabBarLabel: string;
  readonly addLabel: string;
  readonly bottomInset?: number;
  readonly onSelect: (key: string) => void;
  readonly onAdd: () => void;
}

const ADD_SIZE = 56;
const ICON_SIZE = 22;
const LABEL_SIZE = 11;

const useStyles = makeStyles((glass) => ({
  wrap: { paddingHorizontal: glass.space.sm, paddingTop: glass.space.xxs },
  panel: { borderRadius: glass.radius.mobilePanel },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 0,
    paddingVertical: glass.space.xxs,
  },
  tab: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    minHeight: TOUCH_TARGET + glass.space.xs,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  iconWrap: { alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 0, right: '18%' },
  label: { fontFamily: LABEL_FONT, fontSize: LABEL_SIZE, maxWidth: '100%', textAlign: 'center' },
  addSlot: { width: ADD_SIZE + glass.space.xxs },
  addLayer: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  add: {
    width: ADD_SIZE,
    height: ADD_SIZE,
    borderRadius: ADD_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: glass.colors.lightSolid,
    marginTop: -glass.space.md,
  },
  pressed: { transform: [{ scale: 0.97 }] },
}));

/**
 * D7 mobile tab bar: one tinted glass panel (one BlurView) with the tabs split around a centre
 * "Add expense" button. Pure view; `GlassTabBar` feeds it from React Navigation.
 */
export function TabBarView({
  items,
  tabBarLabel,
  addLabel,
  bottomInset = 0,
  onSelect,
  onAdd,
}: TabBarViewProps): React.JSX.Element {
  const styles = useStyles();
  const glass = useGlass();
  const half = Math.ceil(items.length / 2);

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(bottomInset, glass.space.xs) }]}>
      <GlassPanel material="tinted" depth={1} style={styles.panel}>
        <View>
          <View accessibilityRole="tablist" accessibilityLabel={tabBarLabel} style={styles.row}>
            {items.slice(0, half).map((item) => renderTab(item, onSelect))}
            <View style={styles.addSlot} />
            {items.slice(half).map((item) => renderTab(item, onSelect))}
          </View>
          <View pointerEvents="box-none" style={styles.addLayer}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={addLabel}
              onPress={onAdd}
              style={({ pressed }) => [styles.add, pressed && styles.pressed]}
            >
              <Icon name="add" size={28} color={glass.colors.accentInk} />
            </Pressable>
          </View>
        </View>
      </GlassPanel>
    </View>
  );
}

function renderTab(item: TabBarItem, onSelect: (key: string) => void): React.JSX.Element {
  return <TabButton key={item.key} item={item} onSelect={onSelect} />;
}

function TabButton({
  item,
  onSelect,
}: {
  readonly item: TabBarItem;
  readonly onSelect: (key: string) => void;
}): React.JSX.Element {
  const styles = useStyles();
  const glass = useGlass();
  const color = item.focused ? glass.colors.accent : glass.colors.fg;

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: item.focused }}
      onPress={() => {
        onSelect(item.key);
      }}
      style={styles.tab}
    >
      <View style={styles.iconWrap}>
        <Icon name={item.icon} size={ICON_SIZE} color={color} />
      </View>
      <Text numberOfLines={1} style={[styles.label, { color }]}>
        {item.label}
      </Text>
      {item.badge === undefined || item.badge <= 0 ? null : (
        <View style={styles.badge}>
          <CountBadge count={item.badge} />
        </View>
      )}
    </Pressable>
  );
}
