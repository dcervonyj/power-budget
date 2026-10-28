import { Injectable, Logger } from '@nestjs/common';
import type { HouseholdExportId, HouseholdId } from '@power-budget/core';
import type { HouseholdExportQueuePort } from '../../domain/auth/ports.js';

/**
 * Export jobs are NOT enqueued until a processor exists (CLN-056, decision D6, recommended
 * answer: stop enqueueing until the GDPR export ticket ships the processor). A job on the
 * `household-export` queue would never be consumed and would stay in the 25 MB noeviction
 * Redis forever. The export row is still created (status `pending`), so that ticket can
 * pick up pending rows; swap this adapter for a BullMQ one together with the processor.
 */
@Injectable()
export class DeferredHouseholdExportQueue implements HouseholdExportQueuePort {
  private readonly logger = new Logger(DeferredHouseholdExportQueue.name);

  enqueue(payload: { exportId: HouseholdExportId; householdId: HouseholdId }): Promise<void> {
    this.logger.warn(
      `Household export ${payload.exportId} stays pending: no export processor yet (not enqueued)`,
    );

    return Promise.resolve();
  }
}
