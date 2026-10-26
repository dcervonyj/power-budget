import React from 'react';
import { Text, View } from 'react-native';
import type { SupportedLocale } from '@power-budget/core';
import { makeStyles, useGlass } from '../../theme/index.js';
import { AmountText, type AmountTextSize } from './AmountText.js';
import { Avatar, AvatarPair } from './Avatar.js';
import { Icon } from './Icon.js';
import { ICON_NAMES } from './iconPaths.js';
import { StatusTag } from './StatusTag.js';
import { SyncChip } from './SyncChip.js';
import type { SyncChipState } from './syncChipState.js';

const LOCALES: readonly SupportedLocale[] = ['en', 'pl', 'uk', 'ru'];
const SIZES: readonly AmountTextSize[] = ['display', 'hero', 'figure', 'amount', 'inline'];
const SYNC_STATES: readonly SyncChipState[] = [
  { kind: 'live' },
  { kind: 'bank-age', ageMinutes: 25 },
  { kind: 'bank-age', ageMinutes: 300 },
  { kind: 'updating' },
  { kind: 'renew' },
  { kind: 'stale' },
  { kind: 'cooldown', minutesLeft: 4 },
];
const PLN = { amountMinor: 123456n, currency: 'PLN' };

const useStyles = makeStyles((glass) => ({
  section: { gap: glass.space.sm, marginBottom: glass.space.lg },
  heading: {
    color: glass.colors.fg,
    fontFamily: 'Geist_600SemiBold',
    fontSize: glass.type.heading.mobile,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: glass.space.md },
  column: { gap: glass.space.sm, alignItems: 'flex-start' },
  icon: { flexDirection: 'row', alignItems: 'center', gap: glass.space.xs, width: 120 },
  small: {
    color: glass.colors.fg,
    fontFamily: 'Geist_400Regular',
    fontSize: glass.type.small.mobile,
  },
}));

/** The stroke icon set. */
export function Icons(): React.JSX.Element {
  const styles = useStyles();
  const glass = useGlass();

  return (
    <Section title="Icons">
      <View style={styles.row}>
        {ICON_NAMES.map((name) => (
          <View key={name} style={styles.icon}>
            <Icon name={name} size={24} color={glass.colors.fg} />
            <Text style={styles.small}>{name}</Text>
          </View>
        ))}
      </View>
    </Section>
  );
}

/** AmountText at each size, then positive, negative and zero in the four locales. */
export function Amounts(): React.JSX.Element {
  const styles = useStyles();

  return (
    <Section title="Amounts">
      {SIZES.map((size) => (
        <AmountText key={size} amount={PLN} size={size} locale="pl" />
      ))}
      {LOCALES.map((locale) => (
        <View key={locale} style={styles.row}>
          <Text style={styles.small}>{locale}</Text>
          <AmountText amount={PLN} size="amount" locale={locale} />
          <AmountText amount={{ ...PLN, amountMinor: -123456n }} size="amount" locale={locale} />
          <AmountText amount={{ amountMinor: 0n, currency: 'EUR' }} size="amount" locale={locale} />
        </View>
      ))}
    </Section>
  );
}

/** Status tags: ok, over, neutral. */
export function StatusTags(): React.JSX.Element {
  const styles = useStyles();

  return (
    <Section title="Status tags">
      <View style={styles.row}>
        <StatusTag kind="ok" label="Under plan" />
        <StatusTag kind="over" label="Over by 62,50 zł" />
        <StatusTag kind="neutral" label="Paid" icon="paid" />
        <StatusTag kind="neutral" label="Pending" />
        <StatusTag kind="neutral" label="Locked" icon="lock" />
      </View>
    </Section>
  );
}

/** Every sync chip state, owner and partner wording. */
export function SyncChips(): React.JSX.Element {
  const styles = useStyles();

  return (
    <Section title="Sync chips">
      {(['owner', 'partner'] as const).map((viewer) => (
        <View key={viewer} style={styles.column}>
          {SYNC_STATES.map((state, index) => (
            <SyncChip key={`${state.kind}-${String(index)}`} state={state} viewer={viewer} />
          ))}
        </View>
      ))}
    </Section>
  );
}

/** Avatar and AvatarPair, with initials. */
export function Avatars(): React.JSX.Element {
  const styles = useStyles();

  return (
    <Section title="Avatars">
      <View style={styles.row}>
        <Avatar person={{ name: 'Anna Kowalska' }} />
        <Avatar person={{ name: 'Marek Nowak' }} tone="secondary" />
        <Avatar person={{ name: 'Олена' }} size={48} />
        <AvatarPair primary={{ name: 'Anna Kowalska' }} secondary={{ name: 'Marek Nowak' }} />
        <AvatarPair primary={{ name: 'Anna Kowalska' }} />
      </View>
    </Section>
  );
}

function Section({
  title,
  children,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  const styles = useStyles();

  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.heading}>
        {title}
      </Text>
      {children}
    </View>
  );
}
