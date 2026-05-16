import type { IsoDateTime } from '@power-budget/core';
import type { PlanRepository } from '../../domain/ports.js';
import { ClosePeriodSnapshotUseCase } from './ClosePeriodSnapshotUseCase.js';
import type { PeriodCloseResult } from '../models/index.js';
export type { PeriodCloseResult };

export class PeriodCloseUseCase {
  constructor(
    private readonly planRepo: PlanRepository,
    private readonly closePeriodSnapshot: ClosePeriodSnapshotUseCase,
  ) {}

  async execute(now: Date = new Date()): Promise<PeriodCloseResult> {
    const yesterday = new Date(now);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);

    const plans = await this.planRepo.findByPeriodEnd(yesterday);
    const closedAt = now.toISOString() as IsoDateTime;

    let processed = 0;
    for (const plan of plans) {
      try {
        await this.closePeriodSnapshot.execute({
          planId: plan.id,
          householdId: plan.householdId,
          closedAt,
        });
        processed++;
      } catch (err) {
        // Log but continue — idempotent on re-run
        console.error(
          `[PeriodCloseUseCase] Failed to close plan ${plan.id}: ${(err as Error).message}`,
        );
      }
    }

    return { plansProcessed: processed };
  }
}
