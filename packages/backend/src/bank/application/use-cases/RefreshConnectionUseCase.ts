import type { UserId, HouseholdId, BankConnectionId } from '@power-budget/core';
import type { BankConnectionRepository, BankSyncQueuePort } from '../../domain/ports.js';
import { BankConnectionNotFoundError, BankConnectionForbiddenError } from '../../domain/errors.js';

export interface RefreshConnectionInput {
  readonly connectionId: BankConnectionId;
  readonly householdId: HouseholdId;
  readonly userId: UserId;
}

export interface RefreshConnectionOutput {
  readonly jobId: string | null;
}

export class RefreshConnectionUseCase {
  constructor(
    private readonly connectionRepo: BankConnectionRepository,
    private readonly syncQueue: BankSyncQueuePort,
  ) {}

  async execute(input: RefreshConnectionInput): Promise<RefreshConnectionOutput> {
    const connection = await this.connectionRepo.findById(input.connectionId, {
      householdId: input.householdId,
    });
    if (connection === null) {
      throw new BankConnectionNotFoundError();
    }
    if (connection.userId !== input.userId) {
      throw new BankConnectionForbiddenError();
    }

    const { jobId } = await this.syncQueue.enqueue({
      connectionId: input.connectionId,
      householdId: input.householdId,
    });
    return { jobId };
  }
}
