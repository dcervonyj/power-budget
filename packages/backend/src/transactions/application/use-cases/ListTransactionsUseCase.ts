import type { HouseholdId } from '@power-budget/core';
import type { TransactionRepository } from '../../domain/ports.js';
import type { Transaction, TransactionQuery, Page } from '../../domain/entities.js';

export interface ListTransactionsInput {
  readonly query: TransactionQuery;
  readonly householdId: HouseholdId;
}

export class ListTransactionsUseCase {
  constructor(private readonly transactionRepo: TransactionRepository) {}

  async execute(input: ListTransactionsInput): Promise<Page<Transaction>> {
    return this.transactionRepo.list(input.query, { householdId: input.householdId });
  }
}
