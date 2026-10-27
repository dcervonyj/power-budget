import React from 'react';
import { FormattedMessage } from 'react-intl';
import { Link } from 'react-router-dom';
import type { AcceptInviteError } from '../../../application/household/AcceptInvite.js';
import { Button } from '../../components/Button.js';
import { ErrorBanner } from '../../components/shared/ErrorBanner.js';
import '../../glass/controls/controls.css';
import { LINK_BUTTON_STYLE } from '../../components/household/householdStyles.js';

export interface AcceptInviteViewProps {
  readonly error: AcceptInviteError | null;
  readonly busy: boolean;
  /** False when the link carries no token. */
  readonly canAccept: boolean;
  readonly onAccept: () => void;
}

const STACK_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--pb-glass-space-lg)',
  color: 'var(--pb-glass-fg)',
};

const TITLE_STYLE: React.CSSProperties = {
  margin: 0,
  fontSize: 'var(--pb-glass-type-heading-web)',
  fontWeight: 600,
};

const EXPLAINER_STYLE: React.CSSProperties = {
  margin: 0,
  fontSize: 'var(--pb-glass-type-body-web)',
  color: 'var(--pb-glass-dim)',
};

const ACTIONS_STYLE: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 'var(--pb-glass-space-md)',
  alignItems: 'center',
};

/** The content of the invite page, inside the auth card (props only). */
export function AcceptInviteView({
  error,
  busy,
  canAccept,
  onAccept,
}: AcceptInviteViewProps): React.JSX.Element {
  return (
    <div style={STACK_STYLE}>
      <h1 style={TITLE_STYLE}>
        <FormattedMessage id="acceptInvite.title" defaultMessage="Join a household" />
      </h1>
      <p style={EXPLAINER_STYLE}>
        <FormattedMessage
          id="acceptInvite.explainer"
          defaultMessage="Your partner invited you to share a household budget. You will see the household's plans, and each of you keeps your accounts private; categories show only what their privacy level allows."
        />
      </p>
      {error !== null && <ErrorBanner message={<AcceptErrorText error={error} />} />}
      <div style={ACTIONS_STYLE}>
        <Button loading={busy} disabled={!canAccept} onClick={onAccept}>
          <FormattedMessage id="acceptInvite.accept" defaultMessage="Accept invite" />
        </Button>
        <Link to="/dashboard" className="pbg-ctl" style={LINK_BUTTON_STYLE}>
          <FormattedMessage id="acceptInvite.notNow" defaultMessage="Not now" />
        </Link>
      </div>
    </div>
  );
}

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
