import { appShellStore, signOut } from '../../composition.js';
import React, { Suspense, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ROUTE_PATHS } from '../../infrastructure/navigation/routePaths.js';
import type { ShellSync } from '../../application/shell/ShellStore.js';
import { deriveSyncChipState } from '../glass/atoms/syncChipState.js';
import { useLocaleChoice } from '../components/LocaleSwitcher.js';
import { useTheme } from '../theme/ThemeProvider.js';
import { AppShellView, type ShellSyncChip } from './AppShellView.js';
import { ShellLoading } from './ShellLoading.js';
import { activeNavItem } from './shellNav.js';
import { useShellRefresh } from './useShellRefresh.js';

/**
 * Layout route of the signed-in app (DSN-017): keeps the shell data current (`useShellRefresh`)
 * and renders the current screen in `main`.
 */
export const AppShell = observer(function AppShell(): React.JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();
  const { preference, setPreference } = useTheme();
  const { locale, changeLocale } = useLocaleChoice();
  const [signingOut, setSigningOut] = useState(false);
  useShellRefresh(appShellStore, location.pathname);

  async function handleSignOut(): Promise<void> {
    setSigningOut(true);
    // CLN-034: revokes the refresh token, clears the tokens and resets every session store.
    await signOut.execute();
    navigate(ROUTE_PATHS.login, { replace: true });
  }

  function openBanks(): void {
    navigate(ROUTE_PATHS.bankConnections);
  }

  return (
    <AppShellView
      active={activeNavItem(location.pathname, location.search)}
      toSortCount={appShellStore.toSortCount}
      syncChips={syncChipsOf(appShellStore.sync, openBanks)}
      account={{
        me: appShellStore.me,
        partner: appShellStore.partner,
        themePreference: preference,
        onThemeChange: setPreference,
        locale,
        onLocaleChange: changeLocale,
        onSignOut: () => {
          void handleSignOut();
        },
        signingOut,
      }}
    >
      <Suspense fallback={<ShellLoading />}>
        <Outlet />
      </Suspense>
    </AppShellView>
  );
});

/** The viewer's own sync only: a partner's connections are not readable by the API. */
function syncChipsOf(sync: ShellSync, openBanks: () => void): ShellSyncChip[] {
  switch (sync.kind) {
    case 'none':
      return [];
    case 'renew':
      return [{ key: 'own', state: { kind: 'renew' }, viewer: 'owner', onPress: openBanks }];
    case 'synced':
      return [
        {
          key: 'own',
          state: deriveSyncChipState(sync.lastSyncedAt, new Date()),
          viewer: 'owner',
        },
      ];
  }
}
