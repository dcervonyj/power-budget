import { IsoDate, IsoDateTime } from '@power-budget/core';
import type { PlanId } from '@power-budget/core';
import type { PlanRepository } from '../../../domain/plans/ports.js';
import { ClosePeriodSnapshotUseCase } from './ClosePeriodSnapshotUseCase.js';

export interface PeriodCloseResult {
  readonly plansProcessed: number;
}

/** Some plans could not be closed. The job fails so BullMQ retries; closed plans are skipped then. */
export class PeriodCloseFailedError extends Error {
  constructor(
    readonly failures: ReadonlyMap<PlanId, Error>,
    readonly plansProcessed: number,
  ) {
    super(
      `PERIOD_CLOSE_FAILED: ${failures.size} plan(s) not closed (${[...failures.keys()].join(', ')}); ` +
        `${plansProcessed} closed. First error: ${[...failures.values()][0]?.message ?? 'unknown'}`,
    );
    this.name = 'PeriodCloseFailedError';
  }
}

export class PeriodCloseUseCase {
  constructor(
    private readonly planRepo: PlanRepository,
    private readonly closePeriodSnapshot: ClosePeriodSnapshotUseCase,
  ) {}

  /**
   * Closes every plan whose period ended before `day` (the job's UTC day) and has no snapshot yet,
   * so a missed or late run is healed by the next one.
   */
  async execute(day: IsoDate, now: Date = new Date()): Promise<PeriodCloseResult> {
    const plans = await this.planRepo.findDueForClose(day);
    const closedAt = IsoDateTime.of(now.toISOString());

    let processed = 0;
    const failures = new Map<PlanId, Error>();
    for (const plan of plans) {
      // One bad plan must not stop the others; snapshots are idempotent on re-run.
      try {
        await this.closePeriodSnapshot.execute({
          planId: plan.id,
          householdId: plan.householdId,
          closedAt,
        });
        processed++;
      } catch (err) {
        failures.set(plan.id, err instanceof Error ? err : new Error(String(err)));
      }
    }

    if (failures.size > 0) {
      throw new PeriodCloseFailedError(failures, processed);
    }

    return { plansProcessed: processed };
  }
}
