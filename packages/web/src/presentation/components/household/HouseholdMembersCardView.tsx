import React, { useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import type {
  HouseholdInviteResponseDto,
  HouseholdMemberResponseDto,
} from '@power-budget/shared-app/contract';
import type {
  HouseholdInviteError,
  HouseholdInviteNotice,
} from '../../../application/household/HouseholdStore.js';
import { AvatarPair } from '../../glass/atoms/Avatar.js';
import { StatusTag } from '../../glass/atoms/StatusTag.js';
import { GlassPanel } from '../../glass/material/GlassPanel.js';
import { ROW_STYLE } from '../../glass/rows/rowStyles.js';
import { formatIsoDate } from '../../i18n/formatAmount.js';
import { Button } from '../Button.js';
import { ErrorBanner } from '../shared/ErrorBanner.js';
import { Input } from '../Input.js';
import {
  CAPTION_STYLE,
  CARD_HEADER_STYLE,
  CARD_TITLE_STYLE,
  PANEL_STYLE,
  PLAIN_LIST_STYLE,
} from './householdStyles.js';

export interface HouseholdMembersCardViewProps {
  readonly members: readonly HouseholdMemberResponseDto[];
  readonly invites: readonly HouseholdInviteResponseDto[];
  readonly userId: string;
  readonly isOwner: boolean;
  readonly canInvite: boolean;
  readonly inviteBusy: boolean;
  readonly inviteError: HouseholdInviteError | null;
  readonly inviteNotice: HouseholdInviteNotice | null;
  /** Resolves true when the invite went out, so the form can clear. */
  readonly onInvite: (email: string) => Promise<boolean>;
  readonly onResend: (inviteId: string) => void;
  readonly onRevoke: (inviteId: string) => void;
}

const MEMBER_ROW_STYLE: React.CSSProperties = {
  ...ROW_STYLE,
  flexDirection: 'row',
  alignItems: 'center',
  flexWrap: 'wrap',
};

const TEXT_STYLE: React.CSSProperties = {
  flex: '1 1 180px',
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  overflowWrap: 'anywhere',
};

const NAME_STYLE: React.CSSProperties = {
  fontSize: 'var(--pb-glass-type-label-web)',
  fontWeight: 'var(--pb-glass-type-label-weight)',
};

const ACTIONS_STYLE: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 'var(--pb-glass-space-xs)',
};

/** Members with their role and, for the owner, the invite form and the open invite (props only). */
export function HouseholdMembersCardView(props: HouseholdMembersCardViewProps): React.JSX.Element {
  const { members, invites, isOwner, canInvite, inviteError, inviteNotice } = props;
  const you = members.find((member) => member.userId === props.userId);
  const partner = members.find((member) => member.userId !== props.userId);

  return (
    <GlassPanel
      material="frosted"
      depth={1}
      rise={0}
      decor={{ specular: true }}
      contentStyle={PANEL_STYLE}
    >
      <section aria-labelledby="household-members-title" style={{ display: 'contents' }}>
        <div style={CARD_HEADER_STYLE}>
          <h2 id="household-members-title" style={CARD_TITLE_STYLE}>
            <FormattedMessage id="household.members.title" defaultMessage="Members" />
          </h2>
          {you !== undefined && (
            <AvatarPair
              primary={{ name: personName(you) }}
              secondary={partner === undefined ? undefined : { name: personName(partner) }}
              size={36}
            />
          )}
        </div>

        <ul style={PLAIN_LIST_STYLE}>
          {members.map((member) => (
            <li key={member.userId}>
              <MemberRow member={member} isYou={member.userId === props.userId} />
            </li>
          ))}
        </ul>

        {isOwner && invites.length > 0 && (
          <ul style={PLAIN_LIST_STYLE}>
            {invites.map((invite) => (
              <li key={invite.id}>
                <InviteRow
                  invite={invite}
                  busy={props.inviteBusy}
                  onResend={props.onResend}
                  onRevoke={props.onRevoke}
                />
              </li>
            ))}
          </ul>
        )}

        {canInvite && (
          <InviteForm
            hasOpenInvite={invites.length > 0}
            busy={props.inviteBusy}
            onInvite={props.onInvite}
          />
        )}

        {!isOwner && members.length < 2 && (
          <span style={CAPTION_STYLE}>
            <FormattedMessage
              id="household.invite.ownerOnly"
              defaultMessage="Only the household owner can invite a partner."
            />
          </span>
        )}

        {inviteError !== null && <ErrorBanner message={<InviteErrorText error={inviteError} />} />}
        {inviteNotice !== null && <InviteNotice notice={inviteNotice} />}
      </section>
    </GlassPanel>
  );
}

function personName(member: HouseholdMemberResponseDto): string {
  return member.displayName !== '' ? member.displayName : member.email;
}

function MemberRow({
  member,
  isYou,
}: {
  member: HouseholdMemberResponseDto;
  isYou: boolean;
}): React.JSX.Element {
  const intl = useIntl();
  const owner = member.role === 'owner';

  return (
    <div style={MEMBER_ROW_STYLE}>
      <div style={TEXT_STYLE}>
        <span style={NAME_STYLE}>
          {personName(member)}
          {isYou && (
            <span style={{ color: 'var(--pb-glass-dim)', marginInlineStart: 8 }}>
              <FormattedMessage id="household.members.you" defaultMessage="(you)" />
            </span>
          )}
        </span>
        {member.displayName !== '' && <span style={CAPTION_STYLE}>{member.email}</span>}
      </div>
      <StatusTag
        kind="neutral"
        icon="users"
        label={
          owner
            ? intl.formatMessage({ id: 'household.members.owner', defaultMessage: 'Owner' })
            : intl.formatMessage({ id: 'household.members.member', defaultMessage: 'Member' })
        }
      />
    </div>
  );
}

function InviteRow({
  invite,
  busy,
  onResend,
  onRevoke,
}: {
  invite: HouseholdInviteResponseDto;
  busy: boolean;
  onResend: (inviteId: string) => void;
  onRevoke: (inviteId: string) => void;
}): React.JSX.Element {
  const intl = useIntl();
  const expired = invite.status === 'expired';
  const date = formatIsoDate(invite.expiresAt.slice(0, 10), intl.locale);

  return (
    <div style={MEMBER_ROW_STYLE}>
      <div style={TEXT_STYLE}>
        <span style={NAME_STYLE}>{invite.email}</span>
        <span>
          <StatusTag
            kind={expired ? 'over' : 'neutral'}
            icon={expired ? 'warning' : 'clock'}
            label={
              expired
                ? intl.formatMessage(
                    { id: 'household.invite.expired', defaultMessage: 'Invite expired on {date}' },
                    { date },
                  )
                : intl.formatMessage(
                    {
                      id: 'household.invite.pending',
                      defaultMessage: 'Invite pending, valid until {date}',
                    },
                    { date },
                  )
            }
          />
        </span>
      </div>
      <div style={ACTIONS_STYLE}>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => {
            onResend(invite.id);
          }}
        >
          <FormattedMessage id="household.invite.resend" defaultMessage="Resend invite" />
        </Button>
        <Button
          variant="danger"
          disabled={busy}
          onClick={() => {
            onRevoke(invite.id);
          }}
        >
          <FormattedMessage id="household.invite.revoke" defaultMessage="Revoke invite" />
        </Button>
      </div>
    </div>
  );
}

function InviteForm({
  hasOpenInvite,
  busy,
  onInvite,
}: {
  hasOpenInvite: boolean;
  busy: boolean;
  onInvite: (email: string) => Promise<boolean>;
}): React.JSX.Element {
  const intl = useIntl();
  const [email, setEmail] = useState('');

  function handleSubmit(event: React.FormEvent): void {
    event.preventDefault();
    void onInvite(email).then((sent) => {
      if (sent) {
        setEmail('');
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--pb-glass-space-sm)' }}
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
        <Button type="submit" loading={busy}>
          {hasOpenInvite ? (
            <FormattedMessage id="household.invite.replace" defaultMessage="Send a new invite" />
          ) : (
            <FormattedMessage id="household.invite.send" defaultMessage="Invite partner" />
          )}
        </Button>
      </div>
      <span style={CAPTION_STYLE}>
        <FormattedMessage
          id="household.invite.limit"
          defaultMessage="A household has at most 2 members. The link in the email is valid for 7 days; a new invite replaces the open one."
        />
      </span>
    </form>
  );
}

function InviteNotice({ notice }: { notice: HouseholdInviteNotice }): React.JSX.Element {
  return (
    <div role="status">
      <StatusTag kind="ok" label={useNoticeLabel(notice)} />
    </div>
  );
}

function useNoticeLabel(notice: HouseholdInviteNotice): string {
  const intl = useIntl();
  switch (notice) {
    case 'sent':
      return intl.formatMessage({
        id: 'household.invite.notice.sent',
        defaultMessage: 'Invite sent.',
      });
    case 'resent':
      return intl.formatMessage({
        id: 'household.invite.notice.resent',
        defaultMessage: 'Invite sent again. The previous link no longer works.',
      });
    case 'revoked':
      return intl.formatMessage({
        id: 'household.invite.notice.revoked',
        defaultMessage: 'Invite revoked.',
      });
  }
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
