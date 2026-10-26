import type { HouseholdId } from '@power-budget/core';
import type { HouseholdPurgeRepository, HouseholdPurgeResult } from '../../../domain/auth/ports.js';

export interface PurgeFailure {
  readonly householdId: HouseholdId;
  readonly error: unknown;
}

export interface PurgeDeletedHouseholdsOutput {
  readonly purged: readonly HouseholdPurgeResult[];
  readonly failed: readonly PurgeFailure[];
}

/**
 * Hard-deletes every household whose 30-day grace period (DATA_DELETION_RUNBOOK) has passed.
 * One household failing does not stop the others; it stays scheduled and is retried by the
 * next run.
 */
export class PurgeDeletedHouseholdsUseCase {
  static readonly BATCH_SIZE = 50;

  constructor(private readonly purgeRepo: HouseholdPurgeRepository) {}

  async execute(now: Date): Promise<PurgeDeletedHouseholdsOutput> {
    const dueIds = await this.purgeRepo.findDueHouseholdIds(
      now,
      PurgeDeletedHouseholdsUseCase.BATCH_SIZE,
    );
    const purged: HouseholdPurgeResult[] = [];
    const failed: PurgeFailure[] = [];

    for (const householdId of dueIds) {
      try {
        const result = await this.purgeRepo.purge(householdId, now);
        if (result !== null) {
          purged.push(result);
        }
      } catch (error) {
        failed.push({ householdId, error });
      }
    }

    return { purged, failed };
  }
}
