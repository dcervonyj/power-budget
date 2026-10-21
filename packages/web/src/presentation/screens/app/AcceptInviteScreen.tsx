import React, { useState } from 'react';
import { FormattedMessage } from 'react-intl';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTheme } from '../../components/ThemeContext.js';
import { Button } from '../../components/Button.js';
import { householdsApi, tokenStore } from '../../../AppProviders.js';
import {
  AcceptInvite,
  type AcceptInviteError,
} from '../../../application/household/AcceptInvite.js';
import { settingsStore } from '../../../application/settings/SettingsStore.js';

const acceptInvite = new AcceptInvite(householdsApi, tokenStore);

function AcceptErrorText({ error }: { error: AcceptInviteError }): React.JSX.Element {
  switch (error) {
    case 'missing_token':
      return (
        <FormattedMessage
          id="acceptInvite.error.missingToken"
          defaultMessage="This link has no invite in it. Open the link from the email again."
        />
      );
    case 'email_mismatch':
      return (
        <FormattedMessage
          id="acceptInvite.error.emailMismatch"
          defaultMessage="This invite was sent to another email address. Log in with that address to accept it."
        />
      );
    case 'invite_not_found':
      return (
        <FormattedMessage
          id="acceptInvite.error.notFound"
          defaultMessage="This invite is no longer valid. It may have been revoked or replaced by a newer one."
        />
      );
    case 'invite_expired':
      return (
        <FormattedMessage
          id="acceptInvite.error.expired"
          defaultMessage="This invite has expired. Ask your partner to send it again."
        />
      );
    case 'invite_already_used':
      return (
        <FormattedMessage
          id="acceptInvite.error.used"
          defaultMessage="This invite has already been used."
        />
      );
    case 'already_in_household':
      return (
        <FormattedMessage
          id="acceptInvite.error.alreadyInHousehold"
          defaultMessage="You already share a household with someone."
        />
      );
    case 'household_full':
      return (
        <FormattedMessage
          id="acceptInvite.error.full"
          defaultMessage="This household already has two members."
        />
      );
    case 'household_not_empty':
      return (
        <FormattedMessage
          id="acceptInvite.error.notEmpty"
          defaultMessage="Your own household already has plans, bank connections or transactions, so it cannot be left. Joining is only possible from an empty account."
        />
      );
    case 'failed':
      return (
        <FormattedMessage
          id="acceptInvite.error.failed"
          defaultMessage="The invite could not be accepted. Please try again."
        />
      );
  }
}

/**
 * `/invite/accept?token=`: the link of the household invite email. The visitor is
 * signed in (RequireAuth sends them through login and back); accepting swaps in the
 * access token of the joined household.
 */
export function AcceptInviteScreen(): React.JSX.Element {
  const theme = useTheme();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AcceptInviteError | null>(
    token === '' ? 'missing_token' : null,
  );

  const handleAccept = async (): Promise<void> => {
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
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: theme.space.lg,
        padding: theme.space.xl,
        maxWidth: 520,
        margin: `${String(theme.space['3xl'])}px auto`,
        borderRadius: theme.radius.lg,
        backgroundColor: theme.color.surface.raised,
        border: `1px solid ${theme.color.border.subtle}`,
        color: theme.color.text.primary,
      }}
    >
      <h1 style={{ margin: 0, fontSize: theme.fontSize.xl, fontWeight: theme.fontWeight.semibold }}>
        <FormattedMessage id="acceptInvite.title" defaultMessage="Join a household" />
      </h1>
      <p style={{ margin: 0, fontSize: theme.fontSize.sm, color: theme.color.text.secondary }}>
        <FormattedMessage
          id="acceptInvite.explainer"
          defaultMessage="Your partner invited you to share a household budget. You will see the household's plans, and each of you keeps your accounts private; categories show only what their privacy level allows."
        />
      </p>
      {error !== null && (
        <p
          role="alert"
          style={{ margin: 0, fontSize: theme.fontSize.sm, color: theme.color.status.danger }}
        >
          <AcceptErrorText error={error} />
        </p>
      )}
      <div style={{ display: 'flex', gap: theme.space.md, alignItems: 'center' }}>
        <Button
          loading={busy}
          disabled={token === ''}
          onClick={() => {
            void handleAccept();
          }}
        >
          <FormattedMessage id="acceptInvite.accept" defaultMessage="Accept invite" />
        </Button>
        <Link
          to="/dashboard"
          style={{ fontSize: theme.fontSize.sm, color: theme.color.accent.default }}
        >
          <FormattedMessage id="acceptInvite.notNow" defaultMessage="Not now" />
        </Link>
      </div>
    </div>
  );
}
