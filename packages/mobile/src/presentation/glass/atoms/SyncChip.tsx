import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useIntl, type IntlShape, type MessageDescriptor } from 'react-intl';
import { makeStyles, useGlass, useLoopsEnabled } from '../../theme/index.js';
import { useLoop } from '../light/lightMotion.js';
import { Icon } from './Icon.js';
import type { IconName } from './iconPaths.js';
import type { SyncChipState } from './syncChipState.js';

export type SyncChipViewer = 'owner' | 'partner';

export interface SyncChipProps {
  readonly state: SyncChipState;
  /** Whose connection it is relative to the viewer; changes the wording only. */
  readonly viewer?: SyncChipViewer;
  /** Makes the chip a button (refresh or renew). */
  readonly onPress?: () => void;
}

interface BankAgeMessages {
  readonly minutes: MessageDescriptor;
  readonly hours: MessageDescriptor;
  readonly days: MessageDescriptor;
}

const BANK_AGE_OWNER: BankAgeMessages = {
  minutes: {
    id: 'glass-atoms.sync.bankAge.owner.minutes',
    defaultMessage: 'Your bank updated {count, plural, one {# minute} other {# minutes}} ago',
  },
  hours: {
    id: 'glass-atoms.sync.bankAge.owner.hours',
    defaultMessage: 'Your bank updated {count, plural, one {# hour} other {# hours}} ago',
  },
  days: {
    id: 'glass-atoms.sync.bankAge.owner.days',
    defaultMessage: 'Your bank updated {count, plural, one {# day} other {# days}} ago',
  },
};

const BANK_AGE_PARTNER: BankAgeMessages = {
  minutes: {
    id: 'glass-atoms.sync.bankAge.partner.minutes',
    defaultMessage: "Partner's bank updated {count, plural, one {# minute} other {# minutes}} ago",
  },
  hours: {
    id: 'glass-atoms.sync.bankAge.partner.hours',
    defaultMessage: "Partner's bank updated {count, plural, one {# hour} other {# hours}} ago",
  },
  days: {
    id: 'glass-atoms.sync.bankAge.partner.days',
    defaultMessage: "Partner's bank updated {count, plural, one {# day} other {# days}} ago",
  },
};

const HOUR_MINUTES = 60;
const DAY_MINUTES = 24 * HOUR_MINUTES;
const LIVE_PULSE_MS = 2400;
const LIVE_DIMMEST = 0.45;
const DOT_SIZE = 8;
const ICON_SIZE = 16;
const MIN_HEIGHT = 28;

const useStyles = makeStyles((glass) => ({
  chip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: glass.space.xs,
    minHeight: MIN_HEIGHT,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: glass.radius.chip,
    backgroundColor: glass.colors.clear,
    boxShadow: glass.colors.clearRim,
  },
  text: { fontFamily: 'Geist_400Regular', fontSize: glass.type.small.mobile, flexShrink: 1 },
  dot: { width: DOT_SIZE, height: DOT_SIZE, borderRadius: DOT_SIZE / 2 },
}));

/** Sync state chip: icon plus words, clear glass. */
export function SyncChip({ state, viewer = 'owner', onPress }: SyncChipProps): React.JSX.Element {
  const intl = useIntl();
  const styles = useStyles();
  const glass = useGlass();
  const text = syncChipText(intl, state, viewer);
  const tone = toneOf(state, glass.colors);
  const content = (
    <>
      <SyncChipMark state={state} color={tone} />
      <Text style={[styles.text, { color: tone }]}>{text}</Text>
    </>
  );

  if (onPress === undefined) {
    return (
      <View
        testID={`sync-chip-${state.kind}`}
        accessible
        accessibilityLabel={text}
        style={styles.chip}
      >
        {content}
      </View>
    );
  }

  return (
    <Pressable
      testID={`sync-chip-${state.kind}`}
      accessibilityRole="button"
      accessibilityLabel={text}
      onPress={onPress}
      style={styles.chip}
    >
      {content}
    </Pressable>
  );
}

function SyncChipMark({
  state,
  color,
}: {
  readonly state: SyncChipState;
  readonly color: string;
}): React.JSX.Element {
  if (state.kind === 'live') {
    return <LiveDot />;
  }

  return <Icon name={iconOf(state)} size={ICON_SIZE} color={color} />;
}

/** The green live dot; it pulses (d7-live) unless reduced motion or the app is in the background. */
function LiveDot(): React.JSX.Element {
  const styles = useStyles();
  const glass = useGlass();
  const loops = useLoopsEnabled();
  const progress = useLoop(loops, { durationMs: LIVE_PULSE_MS / 2, reverse: true });
  const pulse = useAnimatedStyle(() => ({ opacity: 1 - (1 - LIVE_DIMMEST) * progress.value }));

  return (
    <Animated.View
      testID="sync-live-dot"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.dot, { backgroundColor: glass.colors.ok }, pulse]}
    />
  );
}

function iconOf(state: SyncChipState): IconName {
  switch (state.kind) {
    case 'live':
    case 'bank-age':
    case 'cooldown':
      return 'clock';
    case 'updating':
      return 'sync';
    case 'renew':
      return 'link-off';
    case 'stale':
      return 'cloud-off';
  }
}

function toneOf(
  state: SyncChipState,
  colors: { readonly fg: string; readonly over: string; readonly dim: string },
): string {
  switch (state.kind) {
    case 'live':
      return colors.fg;
    case 'renew':
    case 'stale':
      return colors.over;
    case 'bank-age':
    case 'updating':
    case 'cooldown':
      return colors.dim;
  }
}

function syncChipText(intl: IntlShape, state: SyncChipState, viewer: SyncChipViewer): string {
  switch (state.kind) {
    case 'live':
      return intl.formatMessage({ id: 'glass-atoms.sync.live', defaultMessage: 'Live' });
    case 'updating':
      return intl.formatMessage({ id: 'glass-atoms.sync.updating', defaultMessage: 'Updating…' });
    case 'renew':
      return intl.formatMessage(
        viewer === 'owner'
          ? { id: 'glass-atoms.sync.renew.owner', defaultMessage: 'Renew bank access' }
          : {
              id: 'glass-atoms.sync.renew.partner',
              defaultMessage: "Partner's bank access needs renewing",
            },
      );
    case 'stale':
      return intl.formatMessage(
        viewer === 'owner'
          ? { id: 'glass-atoms.sync.stale.owner', defaultMessage: 'Bank data is out of date' }
          : {
              id: 'glass-atoms.sync.stale.partner',
              defaultMessage: "Partner's bank data is out of date",
            },
      );
    case 'cooldown':
      return intl.formatMessage(
        {
          id: 'glass-atoms.sync.cooldown',
          defaultMessage:
            'Refresh available in {minutes, plural, one {# minute} other {# minutes}}',
        },
        { minutes: state.minutesLeft },
      );
    case 'bank-age':
      return bankAgeText(intl, state.ageMinutes, viewer);
  }
}

function bankAgeText(intl: IntlShape, ageMinutes: number, viewer: SyncChipViewer): string {
  const messages = viewer === 'owner' ? BANK_AGE_OWNER : BANK_AGE_PARTNER;
  if (ageMinutes >= DAY_MINUTES) {
    return intl.formatMessage(messages.days, { count: Math.floor(ageMinutes / DAY_MINUTES) });
  }
  if (ageMinutes >= HOUR_MINUTES) {
    return intl.formatMessage(messages.hours, { count: Math.floor(ageMinutes / HOUR_MINUTES) });
  }

  return intl.formatMessage(messages.minutes, { count: ageMinutes });
}
