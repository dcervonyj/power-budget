import type { HouseholdId, UserId } from '@power-budget/core';
import type { EnqueueNotificationUseCase } from './EnqueueNotificationUseCase.js';

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

export class OverBudgetDetectorUseCase {
  constructor(private readonly enqueueNotification: EnqueueNotificationUseCase) {}

  async execute(input: OverBudgetInput): Promise<void> {
    const dedupeKey = `${input.householdId}:${input.categoryName}:${input.period}`;

    await this.enqueueNotification.execute({
      recipientUserId: input.recipientUserId,
      householdId: input.householdId,
      kind: 'over_budget',
      dedupeKey,
      payload: {
        name: input.recipientName,
        category: input.categoryName,
        amount: input.actualAmountFormatted,
        planName: input.planName,
        currency: input.currency,
      },
    });
  }
}
