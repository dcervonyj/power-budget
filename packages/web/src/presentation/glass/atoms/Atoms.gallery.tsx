import React from 'react';
import type { SupportedLocale } from '@power-budget/core';
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

const ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 'var(--pb-glass-space-lg)',
  marginBottom: 'var(--pb-glass-space-lg)',
};

const HEADING_STYLE: React.CSSProperties = {
  fontWeight: 600,
  fontSize: 'var(--pb-glass-type-heading-web)',
};

/** The stroke icon set. */
export function Icons(): React.JSX.Element {
  return (
    <GallerySection title="Icons">
      <ul
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(112px, 1fr))',
          gap: 'var(--pb-glass-space-md)',
          margin: 0,
          padding: 0,
          listStyle: 'none',
        }}
      >
        {ICON_NAMES.map((name) => (
          <li
            key={name}
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--pb-glass-space-sm)' }}
          >
            <Icon name={name} size={24} />
            <span style={{ fontSize: 'var(--pb-glass-type-small-web)' }}>{name}</span>
          </li>
        ))}
      </ul>
    </GallerySection>
  );
}

/** AmountText at each size, then positive, negative and zero in the four locales. */
export function Amounts(): React.JSX.Element {
  return (
    <GallerySection title="Amounts">
      {SIZES.map((size) => (
        <div key={size} style={ROW_STYLE}>
          <AmountText amount={{ amountMinor: 123456n, currency: 'PLN' }} size={size} locale="pl" />
        </div>
      ))}
      {LOCALES.map((locale) => (
        <div key={locale} style={ROW_STYLE}>
          <span style={{ width: 24 }}>{locale}</span>
          <AmountText
            amount={{ amountMinor: 123456n, currency: 'PLN' }}
            size="amount"
            locale={locale}
          />
          <AmountText
            amount={{ amountMinor: -123456n, currency: 'PLN' }}
            size="amount"
            locale={locale}
          />
          <AmountText amount={{ amountMinor: 0n, currency: 'EUR' }} size="amount" locale={locale} />
        </div>
      ))}
    </GallerySection>
  );
}

/** Status tags: ok, over, neutral. */
export function StatusTags(): React.JSX.Element {
  return (
    <GallerySection title="Status tags">
      <div style={ROW_STYLE}>
        <StatusTag kind="ok" label="Under plan" />
        <StatusTag kind="over" label="Over by 62,50 zł" />
        <StatusTag kind="neutral" label="Paid" icon="paid" />
        <StatusTag kind="neutral" label="Pending" />
        <StatusTag kind="neutral" label="Locked" icon="lock" />
      </div>
    </GallerySection>
  );
}

/** Every sync chip state, owner and partner wording. */
export function SyncChips(): React.JSX.Element {
  return (
    <GallerySection title="Sync chips">
      {(['owner', 'partner'] as const).map((viewer) => (
        <div key={viewer} style={ROW_STYLE}>
          {SYNC_STATES.map((state, index) => (
            <SyncChip key={`${state.kind}-${String(index)}`} state={state} viewer={viewer} />
          ))}
        </div>
      ))}
    </GallerySection>
  );
}

/** Avatar and AvatarPair, with initials. */
export function Avatars(): React.JSX.Element {
  return (
    <GallerySection title="Avatars">
      <div style={ROW_STYLE}>
        <Avatar person={{ name: 'Anna Kowalska' }} />
        <Avatar person={{ name: 'Marek Nowak' }} tone="secondary" />
        <Avatar person={{ name: 'Олена' }} size={48} />
        <AvatarPair primary={{ name: 'Anna Kowalska' }} secondary={{ name: 'Marek Nowak' }} />
        <AvatarPair primary={{ name: 'Anna Kowalska' }} />
      </div>
    </GallerySection>
  );
}

function GallerySection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section aria-label={title}>
      <h2 style={HEADING_STYLE}>{title}</h2>
      {children}
    </section>
  );
}
