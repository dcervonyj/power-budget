import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { Button } from '../components/Button.js';
import { Input } from '../components/Input.js';
import { GlassPanel } from '../glass/material/GlassPanel.js';
import { AppShellView, type AppShellViewProps } from './AppShellView.js';
import { AuthLayoutView } from './AuthLayoutView.js';
import { LocaleSelect } from './LocaleSelect.js';
import type { AccountMenuProps } from './AccountMenu.js';

/** Sample copy (D7 spec data); gallery only. */
const TEXT = {
  title: 'October',
  caption: '22 Oct 2026 · 10 days left',
  panel: 'Planned vs spent',
  login: 'Log in',
};

function noop(): void {
  // Gallery fixtures do not react to input.
}

const ACCOUNT: AccountMenuProps = {
  me: { userId: 'user-anna', name: 'Anna Kowalska' },
  partner: { userId: 'user-marek', name: 'Marek Nowak' },
  themePreference: 'system',
  onThemeChange: noop,
  locale: 'en',
  onLocaleChange: noop,
  onSignOut: noop,
  signingOut: false,
};

/** Cancels the gallery page padding, so the shell fills the viewport as in the app. */
const FULL_BLEED: React.CSSProperties = { margin: 'calc(-1 * var(--pb-glass-space-3xl))' };

const CONTENT: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--pb-glass-space-lg)',
  maxWidth: 1280,
  margin: '0 auto',
  padding: '0 var(--pb-glass-space-lg)',
};

function SampleScreen(): React.JSX.Element {
  return (
    <div style={CONTENT}>
      <GlassPanel material="frosted" depth={1} contentStyle={{ padding: 28, minHeight: 220 }}>
        <h1 style={{ margin: 0, fontSize: 'var(--pb-glass-type-title-web)', fontWeight: 600 }}>
          {TEXT.title}
        </h1>
        <p style={{ margin: '8px 0 0', color: 'var(--pb-glass-dim)' }}>{TEXT.caption}</p>
      </GlassPanel>
      <GlassPanel material="frosted" depth={2} contentStyle={{ padding: 28, minHeight: 320 }}>
        <p style={{ margin: 0, color: 'var(--pb-glass-dim)' }}>{TEXT.panel}</p>
      </GlassPanel>
    </div>
  );
}

function ShellFixture(props: Omit<AppShellViewProps, 'children'>): React.JSX.Element {
  return (
    <MemoryRouter>
      <div style={FULL_BLEED}>
        <AppShellView {...props}>
          <SampleScreen />
        </AppShellView>
      </div>
    </MemoryRouter>
  );
}

/** Overview active, 3 to sort, own bank synced 25 minutes ago, you and your partner. */
export function Overview(): React.JSX.Element {
  return (
    <ShellFixture
      active="overview"
      toSortCount={3}
      syncChips={[{ key: 'own', state: { kind: 'bank-age', ageMinutes: 25 }, viewer: 'owner' }]}
      account={ACCOUNT}
    />
  );
}

/** Account menu open on Transactions; the bank needs a new consent. */
export function AccountMenuOpen(): React.JSX.Element {
  return (
    <ShellFixture
      active="transactions"
      toSortCount={12}
      syncChips={[{ key: 'own', state: { kind: 'renew' }, viewer: 'owner', onPress: noop }]}
      account={{ ...ACCOUNT, defaultOpen: true }}
    />
  );
}

/** Auth layout: the frosted card on the ambient field with a login form. */
export function AuthCard(): React.JSX.Element {
  return (
    <MemoryRouter>
      <div style={FULL_BLEED}>
        <AuthLayoutView language={<LocaleSelect id="gallery-locale" locale="en" onChange={noop} />}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h1 style={{ margin: 0, fontSize: 'var(--pb-glass-type-title-web)', fontWeight: 600 }}>
              {TEXT.login}
            </h1>
            <Input id="gallery-email" type="email" label="Email" value="" onChange={noop} />
            <Input
              id="gallery-password"
              type="password"
              label="Password"
              value=""
              onChange={noop}
            />
            <Button type="button">{TEXT.login}</Button>
          </div>
        </AuthLayoutView>
      </div>
    </MemoryRouter>
  );
}
