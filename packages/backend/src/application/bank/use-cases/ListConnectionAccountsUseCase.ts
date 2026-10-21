import type { BankConnectionId, HouseholdId, UserId } from '@power-budget/core';
import type { BankAccount } from '../../../domain/bank/entities.js';
import { BankConnectionNotFoundError } from '../../../domain/bank/errors.js';
import type {
  BankAccountRepository,
  BankConnectionRepository,
} from '../../../domain/bank/ports.js';

export interface ListConnectionAccountsInput {
  readonly connectionId: BankConnectionId;
  readonly householdId: HouseholdId;
  readonly userId: UserId;
}

/**
 * Bank accounts of one of the caller's own connections. A partner's connection reads as
 * not found: accounts are private to their owner (PRODUCT §4.9).
 */
export class ListConnectionAccountsUseCase {
  constructor(
    private readonly connectionRepo: BankConnectionRepository,
    private readonly accountRepo: BankAccountRepository,
  ) {}

  async execute(input: ListConnectionAccountsInput): Promise<BankAccount[]> {
    const scope = { householdId: input.householdId };
    const connection = await this.connectionRepo.findById(input.connectionId, scope);
    if (connection === null || connection.userId !== input.userId) {
      throw new BankConnectionNotFoundError();
    }

    return this.accountRepo.listByConnection(input.connectionId, scope);
  }
}
