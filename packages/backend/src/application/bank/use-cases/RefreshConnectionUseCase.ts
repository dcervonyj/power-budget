import type { UserId, HouseholdId, BankConnectionId } from '@power-budget/core';
import type { BankConnectionRepository } from '../../../domain/bank/ports.js';
import {
  BankConnectionNotFoundError,
  BankConnectionForbiddenError,
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
  constructor(private readonly connectionRepo: BankConnectionRepository) {}

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

    // MVP: sync is triggered inline; in production this enqueues a BullMQ job
    return { jobId: null };
  }
}
