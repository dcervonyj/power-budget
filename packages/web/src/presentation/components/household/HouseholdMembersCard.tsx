import React, { useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { observer } from 'mobx-react-lite';
import type { HouseholdInviteResponseDto } from '@power-budget/shared-app/contract';
import { useTheme } from '../ThemeContext.js';
import { Button } from '../Button.js';
import { Input } from '../Input.js';
import { formatIsoDate } from '../../i18n/formatAmount.js';
import type {
  HouseholdInviteError,
  HouseholdInviteNotice,
  HouseholdStore,
} from '../../../application/household/HouseholdStore.js';

export interface HouseholdMembersCardProps {
  readonly store: HouseholdStore;
}

function InviteErrorText({ error }: { error: HouseholdInviteError }): React.JSX.Element {
  switch (error) {
    case 'household_full':
      return (
        <FormattedMessage
          id="household.invite.error.full"
          defaultMessage="Your household already has two members."
        />
      );
    case 'invite_self':
      return (
        <FormattedMessage
          id="household.invite.error.self"
          defaultMessage="You cannot invite yourself."
        />
      );
    case 'too_many_requests':
      return (
        <FormattedMessage
          id="household.invite.error.tooMany"
          defaultMessage="Too many invites. Please wait a little and try again."
        />
      );
    case 'invalid_email':
      return (
        <FormattedMessage
          id="household.invite.error.email"
          defaultMessage="Enter a valid email address."
        />
      );
    case 'failed':
      return (
        <FormattedMessage
          id="household.invite.error.failed"
          defaultMessage="The invite could not be sent. Please try again."
        />
      );
  }
}

function InviteNoticeText({ notice }: { notice: HouseholdInviteNotice }): React.JSX.Element {
  switch (notice) {
    case 'sent':
      return <FormattedMessage id="household.invite.notice.sent" defaultMessage="Invite sent." />;
    case 'resent':
      return (
        <FormattedMessage
          id="household.invite.notice.resent"
          defaultMessage="Invite sent again. The previous link no longer works."
        />
      );
    case 'revoked':
      return (
        <FormattedMessage id="household.invite.notice.revoked" defaultMessage="Invite revoked." />
      );
  }
}

const InviteRow = observer(function InviteRow({
  store,
  invite,
}: {
  store: HouseholdStore;
  invite: HouseholdInviteResponseDto;
}): React.JSX.Element {
  const theme = useTheme();
  const intl = useIntl();
  const expires = formatIsoDate(invite.expiresAt.slice(0, 10), intl.locale);

  return (
    <li
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: theme.space.md,
        padding: `${String(theme.space.sm)}px 0`,
        borderTop: `1px solid ${theme.color.border.subtle}`,
      }}
    >
      <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: theme.fontSize.sm, color: theme.color.text.primary }}>
          {invite.email}
        </span>
        <span
          style={{
            fontSize: theme.fontSize.xs,
            color:
              invite.status === 'expired' ? theme.color.status.warning : theme.color.text.secondary,
          }}
        >
          {invite.status === 'expired' ? (
            <FormattedMessage
              id="household.invite.expired"
              defaultMessage="Invite expired on {date}"
              values={{ date: expires }}
            />
          ) : (
            <FormattedMessage
              id="household.invite.pending"
              defaultMessage="Invite pending, valid until {date}"
              values={{ date: expires }}
            />
          )}
        </span>
      </div>
      <Button
        variant="secondary"
        disabled={store.inviteBusy}
        onClick={() => {
          void store.resendInvite(invite.id);
        }}
      >
        <FormattedMessage id="household.invite.resend" defaultMessage="Resend invite" />
      </Button>
      <Button
        variant="danger"
        disabled={store.inviteBusy}
        onClick={() => {
          void store.revokeInvite(invite.id);
        }}
      >
        <FormattedMessage id="household.invite.revoke" defaultMessage="Revoke invite" />
      </Button>
    </li>
  );
});

/** Members with their role, and for the owner the invite form and the open invite. */
export const HouseholdMembersCard = observer(function HouseholdMembersCard({
  store,
}: HouseholdMembersCardProps): React.JSX.Element {
  const theme = useTheme();
  const intl = useIntl();
  const [email, setEmail] = useState('');

  return (
    <section
      aria-labelledby="household-members-title"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: theme.space.md,
        padding: theme.space.lg,
        borderRadius: theme.radius.lg,
        backgroundColor: theme.color.surface.raised,
        border: `1px solid ${theme.color.border.subtle}`,
      }}
    >
      <h2
        id="household-members-title"
        style={{
          margin: 0,
          fontSize: theme.fontSize.md,
          fontWeight: theme.fontWeight.semibold,
          color: theme.color.text.primary,
        }}
      >
        <FormattedMessage id="household.members.title" defaultMessage="Members" />
      </h2>

      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {store.members.map((member) => (
          <li
            key={member.userId}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: theme.space.md,
              padding: `${String(theme.space.sm)}px 0`,
              borderTop: `1px solid ${theme.color.border.subtle}`,
            }}
          >
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: theme.fontSize.sm, color: theme.color.text.primary }}>
                {member.displayName !== '' ? member.displayName : member.email}
                {member.userId === store.userId && (
                  <span style={{ color: theme.color.text.secondary, marginLeft: theme.space.sm }}>
                    <FormattedMessage id="household.members.you" defaultMessage="(you)" />
                  </span>
                )}
              </span>
              {member.displayName !== '' && (
                <span style={{ fontSize: theme.fontSize.xs, color: theme.color.text.secondary }}>
                  {member.email}
                </span>
              )}
            </div>
            <span
              style={{
                fontSize: theme.fontSize.xs,
                fontWeight: theme.fontWeight.semibold,
                color:
                  member.role === 'owner' ? theme.color.accent.default : theme.color.text.secondary,
                border: `1px solid ${theme.color.border.strong}`,
                borderRadius: theme.radius.pill,
                padding: `2px ${String(theme.space.sm)}px`,
              }}
            >
              {member.role === 'owner' ? (
                <FormattedMessage id="household.members.owner" defaultMessage="Owner" />
              ) : (
                <FormattedMessage id="household.members.member" defaultMessage="Member" />
              )}
            </span>
          </li>
        ))}
      </ul>

      {store.isOwner && store.invites.length > 0 && (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {store.invites.map((invite) => (
            <InviteRow key={invite.id} store={store} invite={invite} />
          ))}
        </ul>
      )}

      {store.canInvite && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void store.sendInvite(email).then(() => {
              if (store.inviteError === null) {
                setEmail('');
              }
            });
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: theme.space.sm }}
        >
          <Input
            id="household-invite-email"
            type="email"
            label={intl.formatMessage({
              id: 'household.invite.emailLabel',
              defaultMessage: "Partner's email",
            })}
            placeholder={intl.formatMessage({
              id: 'household.invite.emailPlaceholder',
              defaultMessage: 'partner@example.com',
            })}
            value={email}
            onChange={setEmail}
          />
          <div>
            <Button type="submit" loading={store.inviteBusy}>
              {store.invites.length > 0 ? (
                <FormattedMessage
                  id="household.invite.replace"
                  defaultMessage="Send a new invite"
                />
              ) : (
                <FormattedMessage id="household.invite.send" defaultMessage="Invite partner" />
              )}
            </Button>
          </div>
          <span style={{ fontSize: theme.fontSize.xs, color: theme.color.text.secondary }}>
            <FormattedMessage
              id="household.invite.limit"
              defaultMessage="A household has at most 2 members. The link in the email is valid for 7 days; a new invite replaces the open one."
            />
          </span>
        </form>
      )}

      {!store.isOwner && store.members.length < 2 && (
        <span style={{ fontSize: theme.fontSize.xs, color: theme.color.text.secondary }}>
          <FormattedMessage
            id="household.invite.ownerOnly"
            defaultMessage="Only the household owner can invite a partner."
          />
        </span>
      )}

      {store.inviteError !== null && (
        <span
          role="alert"
          style={{ fontSize: theme.fontSize.sm, color: theme.color.status.danger }}
        >
          <InviteErrorText error={store.inviteError} />
        </span>
      )}
      {store.inviteNotice !== null && (
        <span
          role="status"
          style={{ fontSize: theme.fontSize.sm, color: theme.color.status.success }}
        >
          <InviteNoticeText notice={store.inviteNotice} />
        </span>
      )}
    </section>
  );
});
