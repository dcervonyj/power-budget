import { uuidv7 } from 'uuidv7';
import type { SyncRunId } from '@power-budget/core';
import type { SyncRunRepository } from '../../domain/bank/ports.js';

export class StubSyncRunRepository implements SyncRunRepository {
  async start(): Promise<SyncRunId> {
    return uuidv7() as SyncRunId;
  }

  async finish(): Promise<void> {
    // no-op in stub
  }

  async lastSuccessfulAt(): Promise<Date | null> {
    return null;
  }
}
