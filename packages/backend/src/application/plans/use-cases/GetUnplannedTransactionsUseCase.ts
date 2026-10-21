import type { PlanId, HouseholdId, UserId } from '@power-budget/core';
import type {
  PlanRepository,
  UnplannedTransactionReader,
  UnplannedTransactionPage,
} from '../../../domain/plans/ports.js';
import { findVisiblePlan } from '../plan-lookup.js';

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
      periodStart: plan.period.start,
      periodEnd: plan.period.end,
      direction: input.direction,
      cursor: input.cursor,
      limit: input.limit,
    });
  }
}
