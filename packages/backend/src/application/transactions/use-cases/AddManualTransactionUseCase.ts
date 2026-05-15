import type { HouseholdId, CurrencyCode, IsoDate, BankAccountId } from '@power-budget/core';
import { TransactionId } from '@power-budget/core';
import type { TransactionRepository } from '../../../domain/transactions/ports.js';
import type { Transaction, NewManualTransaction } from '../../../domain/transactions/entities.js';

export interface AddManualTransactionInput {
  readonly householdId: HouseholdId;
  readonly accountId: BankAccountId;
  readonly occurredOn: string;
  readonly amountMinor: bigint;
  readonly currency: string;
  readonly description: string;
  readonly merchant: string | null;
  readonly notes: string | null;
}

export class AddManualTransactionUseCase {
  constructor(
    private readonly transactionRepo: TransactionRepository,
    private readonly generateId: () => string,
  ) {}

  async execute(input: AddManualTransactionInput): Promise<Transaction> {
    const newTx: NewManualTransaction = {
      id: TransactionId.of(this.generateId()),
      householdId: input.householdId,
      accountId: input.accountId,
      occurredOn: input.occurredOn as IsoDate,
      amount: { amountMinor: input.amountMinor, currency: input.currency as CurrencyCode },
      description: input.description,
      merchant: input.merchant,
      notes: input.notes,
    };

    return this.transactionRepo.insertManual(newTx);
  }
}
