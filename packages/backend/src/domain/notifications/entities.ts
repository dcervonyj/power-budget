import type { HouseholdId, IsoDate, Money, UserId } from '@power-budget/core';

export type NotificationKind =
  'over_budget' | 'weekly_digest' | 'reconnect_reminder' | 'magic_link' | 'household_invite';

/**
 * Payload keys that carry a secret (a sign-in link or its raw token). They are
 * removed from the outbox row once the notification is sent or given up on.
 */
export const SECRET_PAYLOAD_KEYS: readonly string[] = ['link', 'token'];

/** Sends per outbox row before it is marked failed for good. */
export const MAX_DISPATCH_ATTEMPTS = 5;

export interface NotificationOutbox {
  readonly id: string;
  readonly householdId: HouseholdId | null;
  /** Null for an address-only recipient (an invitee without an account). */
  readonly recipientUserId: UserId | null;
  /** Set when recipientUserId is null. */
  readonly recipientEmail: string | null;
  readonly recipientLocale: string | null;
  readonly kind: NotificationKind;
  readonly dedupeKey: string;
  readonly payload: Record<string, unknown>;
  readonly createdAt: Date;
  readonly sentAt: Date | null;
  readonly failedAt: Date | null;
  readonly attempts: number;
}

export interface NewNotificationOutbox {
  readonly id: string;
  readonly householdId?: HouseholdId | null;
  readonly recipientUserId: UserId;
  readonly kind: NotificationKind;
  readonly dedupeKey: string;
  readonly payload: Record<string, unknown>;
}

export interface OverBudgetPayload {
  readonly name: string;
  readonly category: string;
  readonly amount: string;
  readonly planName: string;
  readonly currency: string;
}

export interface WeeklyDigestPayload {
  readonly name: string;
  readonly planName: string;
  readonly totalSpent: string;
  readonly totalPlanned: string;
  readonly currency: string;
  readonly periodStart: string;
  readonly periodEnd: string;
}

export interface MagicLinkPayload {
  readonly link: string;
}

/** `link` carries the raw invite token and is stripped once the email is sent. */
export interface HouseholdInvitePayload {
  readonly link: string;
  readonly inviterName: string;
  readonly householdName: string;
}

export interface ReconnectReminderPayload {
  readonly name: string;
  readonly connectionName: string;
  readonly daysUntilExpiry: number;
}

export interface HouseholdMemberRow {
  readonly householdId: HouseholdId;
  readonly userId: UserId;
  readonly email: string;
  readonly displayName: string;
  readonly locale: string;
  readonly emailBouncing: boolean;
}

export interface ExpiringConnectionRow {
  readonly connectionId: string;
  readonly householdId: HouseholdId;
  readonly userId: UserId;
  readonly email: string;
  readonly displayName: string;
  readonly locale: string;
  readonly bankId: string;
  readonly expiresAt: Date;
  readonly emailBouncing: boolean;
}

/** The numbers a weekly digest shows: the recipient's active plan so far. */
export interface WeeklyDigestSummary {
  readonly planName: string;
  readonly totalSpent: Money;
  readonly totalPlanned: Money;
  readonly periodStart: IsoDate;
  readonly periodEnd: IsoDate;
}
