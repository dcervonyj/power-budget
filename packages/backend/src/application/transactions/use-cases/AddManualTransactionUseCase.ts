import type { HouseholdId, CurrencyCode, IsoDate, BankAccountId, UserId } from '@power-budget/core';
import { TransactionId } from '@power-budget/core';
import type { TransactionRepository } from '../../../domain/transactions/ports.js';
import type { Transaction, NewManualTransaction } from '../../../domain/transactions/entities.js';
import {
  BankAccountNotFoundError,
  TransactionCurrencyMismatchError,
} from '../../../domain/transactions/errors.js';

export interface AddManualTransactionInput {
  readonly householdId: HouseholdId;
  /** The caller: a manual transaction goes on one of their own accounts only. */
  readonly userId: UserId;
  readonly accountId: BankAccountId;
  readonly occurredOn: IsoDate;
  readonly amountMinor: bigint;
  readonly currency: CurrencyCode;
  readonly description: string;
  readonly merchant: string | null;
  readonly notes: string | null;
}

export class AddManualTransactionUseCase {
  constructor(
    private readonly transactionRepo: TransactionRepository,
    private readonly generateId: () => string,
  ) {}

  /**
   * Throws BankAccountNotFoundError for an account of another household or of the
   * partner (accounts are private), TransactionCurrencyMismatchError when the amount is
   * not in the account currency.
   */
  async execute(input: AddManualTransactionInput): Promise<Transaction> {
    const scope = { householdId: input.householdId };
    const account = await this.transactionRepo.findOwnedAccount(
      input.accountId,
      input.userId,
      scope,
    );
    if (account === null) {
      throw new BankAccountNotFoundError();
    }
    if (account.currency !== input.currency) {
      throw new TransactionCurrencyMismatchError();
    }

    const newTx: NewManualTransaction = {
      id: TransactionId.of(this.generateId()),
      householdId: input.householdId,
      accountId: input.accountId,
      occurredOn: input.occurredOn,
      amount: { amountMinor: input.amountMinor, currency: input.currency },
      description: input.description,
      merchant: input.merchant,
      notes: input.notes,
    };

    return this.transactionRepo.insertManual(newTx);
  }
}
