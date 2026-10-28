import React from 'react';
import { defineMessages, FormattedMessage, useIntl, type MessageDescriptor } from 'react-intl';
import { NavLink } from 'react-router-dom';
import { Button } from '../../components/Button.js';
import '../../glass/controls/controls.css';
import { HEADER_STYLE, PAGE_STYLE, TITLE_STYLE } from '../app/planStyles.js';

export interface SettingsViewProps {
  readonly signingOut: boolean;
  readonly onSignOut: () => void;
  /** The active tab. */
  readonly children: React.ReactNode;
}

const TAB_MESSAGES = defineMessages({
  profile: { id: 'settings.tab.profile', defaultMessage: 'Profile' },
  appearance: { id: 'settings.tab.appearance', defaultMessage: 'Appearance' },
  locale: { id: 'settings.tab.locale', defaultMessage: 'Language' },
  currency: { id: 'settings.tab.currency', defaultMessage: 'Currency' },
  data: { id: 'settings.tab.data', defaultMessage: 'Data & Privacy' },
});

interface SettingsTabLink {
  readonly to: string;
  readonly label: MessageDescriptor;
}

// No notifications tab: the API has no notification-preferences endpoint yet.
const TABS: readonly SettingsTabLink[] = [
  { to: 'profile', label: TAB_MESSAGES.profile },
  { to: 'appearance', label: TAB_MESSAGES.appearance },
  { to: 'locale', label: TAB_MESSAGES.locale },
  { to: 'currency', label: TAB_MESSAGES.currency },
  { to: 'data', label: TAB_MESSAGES.data },
];

const NAV_STYLE: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 'var(--pb-glass-space-xs)',
};

function tabStyle(active: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    minHeight: 44,
    padding: '0 var(--pb-glass-space-md)',
    borderRadius: 'var(--pb-glass-radius-chip)',
    background: active ? 'var(--pb-glass-light-solid)' : 'var(--pb-glass-clear)',
    boxShadow: active ? 'inset 0 0 0 1px var(--pb-glass-light-edge)' : 'var(--pb-glass-clear-rim)',
    color: active ? 'var(--pb-glass-accent-ink)' : 'var(--pb-glass-fg)',
    fontSize: 'var(--pb-glass-type-small-web)',
    fontWeight: 'var(--pb-glass-type-label-weight)',
    textDecoration: 'none',
    whiteSpace: 'nowrap',
  };
}

function renderTab(tab: SettingsTabLink): React.JSX.Element {
  return (
    <NavLink
      key={tab.to}
      to={tab.to}
      className="pbg-ctl"
      style={({ isActive }) => tabStyle(isActive)}
    >
      <FormattedMessage {...tab.label} />
    </NavLink>
  );
}

export function SettingsView({
  signingOut,
  onSignOut,
  children,
}: SettingsViewProps): React.JSX.Element {
  const intl = useIntl();

  return (
    <div style={{ ...PAGE_STYLE, maxWidth: 760 }}>
      <header style={HEADER_STYLE}>
        <h1 style={TITLE_STYLE}>
          <FormattedMessage id="settings.title" defaultMessage="Settings" />
        </h1>
        <Button variant="secondary" loading={signingOut} onClick={onSignOut}>
          <FormattedMessage id="settings.signOut" defaultMessage="Log out" />
        </Button>
      </header>

      <nav
        aria-label={intl.formatMessage({
          id: 'settings.tabs.label',
          defaultMessage: 'Settings sections',
        })}
        style={NAV_STYLE}
      >
        {TABS.map(renderTab)}
      </nav>

      {children}
    </div>
  );
}
