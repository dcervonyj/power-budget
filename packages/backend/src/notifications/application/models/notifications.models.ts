import type { HouseholdId, UserId } from '@power-budget/core';
import type { NotificationKind } from '../../domain/entities.js';

export interface EnqueueNotificationInput {
  readonly recipientUserId: UserId;
  readonly householdId?: HouseholdId | null;
  readonly kind: NotificationKind;
  readonly dedupeKey: string;
  readonly payload: Record<string, unknown>;
}

export interface OverBudgetInput {
  readonly recipientUserId: UserId;
  readonly householdId: HouseholdId;
  readonly categoryName: string;
  readonly planName: string;
  readonly actualAmountFormatted: string;
  readonly plannedAmountFormatted: string;
  readonly currency: string;
  readonly recipientName: string;
  /** ISO date like 2025-01 to scope dedupe to a period */
  readonly period: string;
}
