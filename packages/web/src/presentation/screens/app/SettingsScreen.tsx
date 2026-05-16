import React, { useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { FormattedMessage } from 'react-intl';
import { useTheme } from '../../components/ThemeContext.js';
import { settingsStore } from '../../../application/settings/SettingsStore.js';

const TABS = [
  { to: 'profile', labelId: 'settings.tab.profile', defaultMessage: 'Profile' },
  { to: 'locale', labelId: 'settings.tab.locale', defaultMessage: 'Language' },
  { to: 'currency', labelId: 'settings.tab.currency', defaultMessage: 'Currency' },
  { to: 'notifications', labelId: 'settings.tab.notifications', defaultMessage: 'Notifications' },
  { to: 'data', labelId: 'settings.tab.data', defaultMessage: 'Data & Privacy' },
] as const;

export function SettingsScreen(): React.JSX.Element {
  const theme = useTheme();

  useEffect(() => {
    void settingsStore.loadProfile();
  }, []);

  return (
    <div
      style={{
        maxWidth: 720,
        margin: '0 auto',
        padding: `${theme.space['2xl']}px ${theme.space.lg}px`,
        color: theme.color.text.primary,
      }}
    >
      <h1
        style={{
          margin: `0 0 ${theme.space.xl}px`,
          fontSize: theme.fontSize['2xl'],
          fontWeight: theme.fontWeight.semibold,
        }}
      >
        <FormattedMessage id="settings.title" defaultMessage="Settings" />
      </h1>

      {/* Tab bar */}
      <nav
        role="tablist"
        style={{
          display: 'flex',
          gap: theme.space.xs,
          borderBottom: `2px solid ${theme.color.border.subtle}`,
          marginBottom: theme.space.xl,
          overflowX: 'auto',
        }}
      >
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            role="tab"
            style={({ isActive }) => ({
              padding: `${theme.space.sm}px ${theme.space.md}px`,
              fontSize: theme.fontSize.md,
              fontWeight: isActive ? theme.fontWeight.semibold : theme.fontWeight.regular,
              color: isActive ? theme.color.accent.default : theme.color.text.secondary,
              borderBottom: isActive
                ? `2px solid ${theme.color.accent.default}`
                : '2px solid transparent',
              marginBottom: -2,
              textDecoration: 'none',
              whiteSpace: 'nowrap',
              transition: 'color 0.15s, border-color 0.15s',
            })}
          >
            <FormattedMessage id={tab.labelId} defaultMessage={tab.defaultMessage} />
          </NavLink>
        ))}
      </nav>

      {/* Tab content */}
      <Outlet />
    </div>
  );
}
