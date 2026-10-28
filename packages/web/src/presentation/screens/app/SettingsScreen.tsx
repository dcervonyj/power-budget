import { settingsStore, signOut } from '../../../composition.js';
import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { SettingsView } from '../settings/SettingsView.js';

export function SettingsScreen(): React.JSX.Element {
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    void settingsStore.loadProfile();
  }, []);

  async function handleSignOut(): Promise<void> {
    setSigningOut(true);
    await signOut.execute();
    navigate('/login', { replace: true });
  }

  return (
    <SettingsView
      signingOut={signingOut}
      onSignOut={() => {
        void handleSignOut();
      }}
    >
      <Outlet />
    </SettingsView>
  );
}
