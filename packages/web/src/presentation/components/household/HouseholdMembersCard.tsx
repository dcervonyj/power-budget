import React from 'react';
import { observer } from 'mobx-react-lite';
import type { HouseholdStore } from '../../../application/household/HouseholdStore.js';
import { HouseholdMembersCardView } from './HouseholdMembersCardView.js';

export interface HouseholdMembersCardProps {
  readonly store: HouseholdStore;
}

/** Members with their role, and for the owner the invite form and the open invite. */
export const HouseholdMembersCard = observer(function HouseholdMembersCard({
  store,
}: HouseholdMembersCardProps): React.JSX.Element {
  async function invite(email: string): Promise<boolean> {
    await store.sendInvite(email);

    return store.inviteError === null;
  }

  function resend(inviteId: string): void {
    void store.resendInvite(inviteId);
  }

  function revoke(inviteId: string): void {
    void store.revokeInvite(inviteId);
  }

  return (
    <HouseholdMembersCardView
      members={store.members}
      invites={store.invites}
      userId={store.userId}
      isOwner={store.isOwner}
      canInvite={store.canInvite}
      inviteBusy={store.inviteBusy}
      inviteError={store.inviteError}
      inviteNotice={store.inviteNotice}
      onInvite={invite}
      onResend={resend}
      onRevoke={revoke}
    />
  );
});
