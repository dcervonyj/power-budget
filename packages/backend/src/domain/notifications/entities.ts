import type { HouseholdId, UserId } from '@power-budget/core';

export type NotificationKind = 'over_budget' | 'weekly_digest' | 'reconnect_reminder';

export interface NotificationOutbox {
  readonly id: string;
  readonly householdId: HouseholdId | null;
  readonly recipientUserId: UserId;
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
