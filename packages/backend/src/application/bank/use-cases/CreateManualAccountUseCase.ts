import { BankAccountId } from '@power-budget/core';
import type { CurrencyCode, HouseholdId, UserId } from '@power-budget/core';
import type { ManualAccount } from '../../../domain/bank/entities.js';
import type { IdGenerator } from '../../../domain/shared/ports.js';
import type { AccountRepository } from '../../../domain/bank/ports.js';

export interface CreateManualAccountInput {
  readonly userId: UserId;
  readonly householdId: HouseholdId;
  readonly name: string;
  readonly currency: CurrencyCode;
}

/** A cash wallet (or any off-bank account) for manual transactions, owned by the caller. */
export class CreateManualAccountUseCase {
  constructor(
    private readonly accountRepo: AccountRepository,
    private readonly ids: IdGenerator,
  ) {}

  execute(input: CreateManualAccountInput): Promise<ManualAccount> {
    return this.accountRepo.createManual(
      {
        id: BankAccountId.of(this.ids.next()),
        householdId: input.householdId,
        ownerUserId: input.userId,
        name: input.name.trim(),
        currency: input.currency,
      },
      { householdId: input.householdId },
    );
  }
}
