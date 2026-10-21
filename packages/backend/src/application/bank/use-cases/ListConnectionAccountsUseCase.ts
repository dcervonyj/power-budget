import type { BankConnectionId, HouseholdId } from '@power-budget/core';
import type { BankAccount } from '../../../domain/bank/entities.js';
import type { BankAccountRepository } from '../../../domain/bank/ports.js';

export interface ListConnectionAccountsInput {
  readonly connectionId: BankConnectionId;
  readonly householdId: HouseholdId;
}

/** Bank accounts of one connection, limited to the caller's household. */
export class ListConnectionAccountsUseCase {
  constructor(private readonly accountRepo: BankAccountRepository) {}

  execute(input: ListConnectionAccountsInput): Promise<BankAccount[]> {
    return this.accountRepo.listByConnection(input.connectionId, {
      householdId: input.householdId,
    });
  }
}
