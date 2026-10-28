import { acceptInvite, settingsStore } from '../../../composition.js';
import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { AcceptInviteError } from '../../../application/household/AcceptInvite.js';
import { AcceptInviteView } from './AcceptInviteView.js';

/**
 * `/invite/accept?token=`: the link of the household invite email, shown in the auth
 * layout. The visitor is signed in (RequireAuth sends them through login and back);
 * accepting swaps in the access token of the joined household.
 */
export function AcceptInviteScreen(): React.JSX.Element {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rawToken = searchParams.get('token');
  const token = rawToken === null ? '' : rawToken;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AcceptInviteError | null>(
    token === '' ? 'missing_token' : null,
  );

  async function handleAccept(): Promise<void> {
    setBusy(true);
    setError(null);
    const outcome = await acceptInvite.execute(token);
    if (outcome.kind === 'joined') {
      await settingsStore.loadProfile();
      void navigate('/household', { replace: true });

      return;
    }
    setError(outcome.error);
    setBusy(false);
  }

  function accept(): void {
    void handleAccept();
  }

  return <AcceptInviteView error={error} busy={busy} canAccept={token !== ''} onAccept={accept} />;
}
