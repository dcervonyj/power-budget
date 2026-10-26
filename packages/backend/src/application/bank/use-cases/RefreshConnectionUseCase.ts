import type { UserId, HouseholdId, BankConnectionId } from '@power-budget/core';
import type { BankConnectionRepository, BankSyncQueuePort } from '../../../domain/bank/ports.js';
import {
  BankConnectionNotFoundError,
  BankConnectionForbiddenError,
  BankConnectionInvalidStateError,
} from '../../../domain/bank/errors.js';

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
    // A disconnected, expired or not yet consented connection must not sync (BE-BUGS-08).
    if (connection.status !== 'active' || connection.encryptedConsent === null) {
      throw new BankConnectionInvalidStateError(
        `Cannot refresh a connection with status: ${connection.status}`,
      );
    }

    const { jobId } = await this.syncQueue.enqueue({
      connectionId: input.connectionId,
      householdId: input.householdId,
      trigger: 'manual',
      attended: true,
    });

    return { jobId };
  }
}
