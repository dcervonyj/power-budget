import type { PlanId, HouseholdId, UserId } from '@power-budget/core';
import type {
  PlanRepository,
  UnplannedTransactionReader,
  UnplannedTransactionPage,
} from '../../../domain/plans/ports.js';
import { findVisiblePlan } from '../plan-lookup.js';

export const UNPLANNED_DEFAULT_LIMIT = 50;
export const UNPLANNED_MAX_LIMIT = 200;

export interface GetUnplannedTransactionsInput {
  readonly planId: PlanId;
  readonly householdId: HouseholdId;
  readonly userId: UserId;
  readonly direction: 'income' | 'expense';
  readonly cursor?: string;
  readonly limit?: number;
}

export class GetUnplannedTransactionsUseCase {
  constructor(
    private readonly planRepo: PlanRepository,
    private readonly unplannedReader: UnplannedTransactionReader,
  ) {}

  async execute(input: GetUnplannedTransactionsInput): Promise<UnplannedTransactionPage> {
    // A partner's personal plan is not visible either (PLAN_NOT_FOUND).
    const plan = await findVisiblePlan(this.planRepo, input);

    return this.unplannedReader.list({
      householdId: input.householdId,
      // Accounts and transactions are private to their owner (PRODUCT §4.9): the
      // partner's unplanned transactions only count in the dashboard totals.
      ownerUserId: input.userId,
      periodStart: plan.period.start,
      periodEnd: plan.period.end,
      direction: input.direction,
      cursor: input.cursor,
      limit: this.clampLimit(input.limit),
    });
  }

  private clampLimit(limit: number | undefined): number {
    if (limit === undefined || !Number.isInteger(limit) || limit < 1) {
      return UNPLANNED_DEFAULT_LIMIT;
    }

    return Math.min(limit, UNPLANNED_MAX_LIMIT);
  }
}
