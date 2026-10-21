import type { HouseholdId, UserId } from '@power-budget/core';
import type { Account } from '../../../domain/bank/entities.js';
import type { AccountRepository } from '../../../domain/bank/ports.js';

export interface ListAccountsInput {
  readonly userId: UserId;
  readonly householdId: HouseholdId;
}

/**
 * The caller's own accounts, bank and manual. A partner's accounts are never listed:
 * accounts are private to their owner and sharing happens only through categories
 * (PRODUCT §4.9).
 */
export class ListAccountsUseCase {
  constructor(private readonly accountRepo: AccountRepository) {}

  execute(input: ListAccountsInput): Promise<Account[]> {
    return this.accountRepo.listOwned(input.userId, { householdId: input.householdId });
  }
}
