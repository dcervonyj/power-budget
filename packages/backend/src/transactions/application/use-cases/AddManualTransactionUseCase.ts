import type { HouseholdId, CurrencyCode, IsoDate, BankAccountId } from '@power-budget/core';
import { TransactionId } from '@power-budget/core';
import type { TransactionRepository } from '../../domain/ports.js';
import type { Transaction, NewManualTransaction } from '../../domain/entities.js';
import type { AddManualTransactionInput } from '../models/index.js';
export type { AddManualTransactionInput };

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
