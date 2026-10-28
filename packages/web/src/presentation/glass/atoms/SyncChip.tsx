import React from 'react';
import { defineMessages, useIntl, type IntlShape, type MessageDescriptor } from 'react-intl';
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

const BANK_AGE_OWNER: BankAgeMessages = defineMessages({
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
});

const BANK_AGE_PARTNER: BankAgeMessages = defineMessages({
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
});

const HOUR_MINUTES = 60;
const DAY_MINUTES = 24 * HOUR_MINUTES;

/** Sync state chip: icon plus words, clear glass. */
export function SyncChip({ state, viewer = 'owner', onPress }: SyncChipProps): React.JSX.Element {
  const intl = useIntl();
  const text = syncChipText(intl, state, viewer);
  const tone = toneOf(state);
  const style: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 'var(--pb-glass-space-sm)',
    minHeight: 28,
    padding: '4px 12px',
    border: 0,
    borderRadius: 'var(--pb-glass-radius-chip)',
    background: 'var(--pb-glass-clear)',
    boxShadow: 'var(--pb-glass-clear-rim)',
    color: tone,
    fontSize: 'var(--pb-glass-type-small-web)',
    lineHeight: 1.3,
  };
  const content = (
    <>
      <SyncChipMark state={state} />
      {text}
    </>
  );

  if (onPress === undefined) {
    return (
      <span data-state={state.kind} style={style}>
        {content}
      </span>
    );
  }

  return (
    <button
      type="button"
      data-state={state.kind}
      onClick={onPress}
      style={{ ...style, cursor: 'pointer' }}
    >
      {content}
    </button>
  );
}

function SyncChipMark({ state }: { state: SyncChipState }): React.JSX.Element {
  if (state.kind === 'live') {
    return (
      <span
        aria-hidden="true"
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: 'var(--pb-glass-ok)',
          animation: 'd7-live 2.4s ease-in-out infinite',
        }}
      />
    );
  }

  return <Icon name={iconOf(state)} size={16} />;
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

function toneOf(state: SyncChipState): string {
  switch (state.kind) {
    case 'live':
      return 'var(--pb-glass-fg)';
    case 'renew':
    case 'stale':
      return 'var(--pb-glass-over)';
    case 'bank-age':
    case 'updating':
    case 'cooldown':
      return 'var(--pb-glass-dim)';
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
  if (ageMinutes >= DAY_MINUTES) {
    return intl.formatMessage(viewer === 'owner' ? BANK_AGE_OWNER.days : BANK_AGE_PARTNER.days, {
      count: Math.floor(ageMinutes / DAY_MINUTES),
    });
  }
  if (ageMinutes >= HOUR_MINUTES) {
    return intl.formatMessage(viewer === 'owner' ? BANK_AGE_OWNER.hours : BANK_AGE_PARTNER.hours, {
      count: Math.floor(ageMinutes / HOUR_MINUTES),
    });
  }

  return intl.formatMessage(
    viewer === 'owner' ? BANK_AGE_OWNER.minutes : BANK_AGE_PARTNER.minutes,
    {
      count: ageMinutes,
    },
  );
}
