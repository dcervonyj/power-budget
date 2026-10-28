import type { HouseholdInviteId } from '@power-budget/core';
import type { HouseholdInvite } from '../../../domain/auth/entities.js';

/** What the owner sees of an open invite. Never the token or its hash. */
export interface HouseholdInviteView {
  readonly id: HouseholdInviteId;
  readonly email: string;
  readonly status: 'pending' | 'expired';
  readonly expiresAt: Date;
  readonly createdAt: Date;
}

export function toHouseholdInviteView(invite: HouseholdInvite, now: Date): HouseholdInviteView {
  return {
    id: invite.id,
    email: invite.email,
    status: invite.expiresAt.getTime() > now.getTime() ? 'pending' : 'expired',
    expiresAt: invite.expiresAt,
    createdAt: invite.createdAt,
  };
}
