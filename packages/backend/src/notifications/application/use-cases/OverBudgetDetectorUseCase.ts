import type { HouseholdId, UserId } from '@power-budget/core';
import type { EnqueueNotificationUseCase } from './EnqueueNotificationUseCase.js';
import type { OverBudgetInput } from '../models/index.js';
export type { OverBudgetInput };

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
