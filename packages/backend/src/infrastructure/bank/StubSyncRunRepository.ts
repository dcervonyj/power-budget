import { SyncRunId } from '@power-budget/core';
import { uuidv7 } from 'uuidv7';
import type { SyncRunRepository } from '../../domain/bank/ports.js';

export class StubSyncRunRepository implements SyncRunRepository {
  async start(): Promise<SyncRunId> {
    return SyncRunId.of(uuidv7());
  }

  async finish(): Promise<void> {
    // no-op in stub
  }

  async lastSuccessfulAt(): Promise<Date | null> {
    return null;
  }
}
