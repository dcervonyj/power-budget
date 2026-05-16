import { LeftoverSnapshotId } from '@power-budget/core';
import type {
  PlanId,
  HouseholdId,
  IsoDateTime,
  LeftoverEntry,
  PlannedItemActuals,
  PlanActualsView,
} from '@power-budget/core';
import type {
  PlanRepository,
  PlanActualsReader,
  LeftoverSnapshotRepository,
  HouseholdScope,
} from '../../domain/ports.js';
import type { ClosePeriodSnapshotInput } from '../models/index.js';
export type { ClosePeriodSnapshotInput };

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

    const view = await this.actualsReader.read(input.planId, new Date(input.closedAt));
    const entries = this.buildLeftoverEntries(view, input.planId);

    await this.leftoverSnapshotRepo.save({
      id: LeftoverSnapshotId.of(this.generateId()),
      planId: input.planId,
      householdId: input.householdId,
      closedAt: input.closedAt,
      entries,
    });
  }

  private buildLeftoverEntries(view: PlanActualsView, planId: PlanId): LeftoverEntry[] {
    const allLines = [...view.incomeLines, ...view.expenseLines];

    return allLines.map((line) => this.toLeftoverEntry(line, view, planId));
  }

  private toLeftoverEntry(
    line: PlannedItemActuals,
    view: PlanActualsView,
    planId: PlanId,
  ): LeftoverEntry {
    const leftoverMinor = line.remaining.amountMinor > 0n ? line.remaining.amountMinor : 0n;

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
