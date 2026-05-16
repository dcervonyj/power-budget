import type { PlanId, HouseholdId } from '@power-budget/core';
import type {
  PlanRepository,
  HouseholdScope,
  UnplannedTransactionReader,
  UnplannedTransactionPage,
} from '../../../domain/plans/ports.js';

export interface GetUnplannedTransactionsInput {
  readonly planId: PlanId;
  readonly householdId: HouseholdId;
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
    const scope: HouseholdScope = { householdId: input.householdId };

    const plan = await this.planRepo.findById(input.planId, scope);
    if (plan === null) {
      throw new Error(`PLAN_NOT_FOUND: Plan ${input.planId} not found in household ${input.householdId}`);
    }

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
