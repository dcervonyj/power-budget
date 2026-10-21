import { LeftoverSnapshotId, Money, isSupportedCurrency } from '@power-budget/core';
import type {
  CurrencyCode,
  PlanId,
  HouseholdId,
  IsoDateTime,
  LeftoverEntry,
  PlannedItemActuals,
  PlanActualsView,
} from '@power-budget/core';
import type { Plan } from '../../../domain/plans/entities.js';
import type {
  PlanRepository,
  PlanActualsReader,
  LeftoverSnapshotRepository,
  HouseholdScope,
} from '../../../domain/plans/ports.js';

export interface ClosePeriodSnapshotInput {
  readonly planId: PlanId;
  readonly householdId: HouseholdId;
  readonly closedAt: IsoDateTime;
}

export class ClosePeriodSnapshotUseCase {
  constructor(
    private readonly planRepo: PlanRepository,
    private readonly actualsReader: PlanActualsReader,
    private readonly leftoverSnapshotRepo: LeftoverSnapshotRepository,
    private readonly generateId: () => string,
  ) {}

  async execute(input: ClosePeriodSnapshotInput): Promise<void> {
    const scope: HouseholdScope = { householdId: input.householdId };

    const plan = await this.planRepo.findById(input.planId, scope);
    if (plan === null) {
      throw new Error(
        `PLAN_NOT_FOUND: Plan ${input.planId} not found in household ${input.householdId}`,
      );
    }

    const currency = this.baseCurrencyOf(plan);
    const view = await this.actualsReader.read(plan, new Date(input.closedAt));
    const entries = this.buildLeftoverEntries(view, input.planId);

    await this.leftoverSnapshotRepo.save({
      id: LeftoverSnapshotId.of(this.generateId()),
      planId: input.planId,
      householdId: input.householdId,
      periodEnd: plan.period.end,
      closedAt: input.closedAt,
      leftover: this.sumLeftover(entries, currency),
      entries,
    });
  }

  /** Leftover is unspent planned expense only: income lines never count. */
  private buildLeftoverEntries(view: PlanActualsView, planId: PlanId): LeftoverEntry[] {
    return view.expenseLines.map((line) => this.toLeftoverEntry(line, view, planId));
  }

  /** Throws CurrencyMismatchError when a line is not in the plan's base currency. */
  private sumLeftover(entries: readonly LeftoverEntry[], currency: CurrencyCode): Money {
    let total = Money.zero(currency);
    for (const entry of entries) {
      total = Money.add(total, entry.leftover);
    }

    return total;
  }

  private baseCurrencyOf(plan: Plan): CurrencyCode {
    if (!isSupportedCurrency(plan.baseCurrency)) {
      throw new Error(
        `UNSUPPORTED_CURRENCY: Plan ${plan.id} has base currency ${plan.baseCurrency}`,
      );
    }

    return plan.baseCurrency;
  }

  private toLeftoverEntry(
    line: PlannedItemActuals,
    view: PlanActualsView,
    planId: PlanId,
  ): LeftoverEntry {
    // Never negative (over budget), never above the plan (refunds beyond the spend).
    const spentMinor = line.actual.amountMinor > 0n ? line.actual.amountMinor : 0n;
    const remainingMinor = line.planned.amountMinor - spentMinor;
    const leftoverMinor = remainingMinor > 0n ? remainingMinor : 0n;

    return {
      snapshotId: LeftoverSnapshotId.of(this.generateId()),
      planId,
      plannedItemId: line.plannedItemId,
      categoryId: line.categoryId,
      plannedAmount: line.planned,
      actualAmount: line.actual,
      leftover: { amountMinor: leftoverMinor, currency: line.remaining.currency },
      asOf: view.asOf,
    };
  }
}
