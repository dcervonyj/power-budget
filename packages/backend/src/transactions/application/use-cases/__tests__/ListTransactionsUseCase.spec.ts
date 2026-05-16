import { describe, it, expect, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { HouseholdId, TransactionId } from '@power-budget/core';
import type { TransactionRepository } from '../../../domain/ports.js';
import type { Transaction, Page } from '../../../domain/entities.js';
import { ListTransactionsUseCase } from '../ListTransactionsUseCase.js';

const HOUSEHOLD_ID = '01900000-0000-7000-8000-000000000001' as HouseholdId;
const TX_ID = '01900000-0000-7000-8000-000000000010' as TransactionId;

const EMPTY_PAGE: Page<Transaction> = { items: [], nextCursor: null, hasMore: false };

function makeFakePage(count: number): Page<Transaction> {
  return {
    items: Array.from({ length: count }, (_, i) => ({
      id: `tx-${i}` as unknown as TransactionId,
    })) as Transaction[],
    nextCursor: null,
    hasMore: false,
  };
}

describe('ListTransactionsUseCase', () => {
  let transactionRepo: ReturnType<typeof mock<TransactionRepository>>;
  let useCase: ListTransactionsUseCase;

  beforeEach(() => {
    transactionRepo = mock<TransactionRepository>();
    useCase = new ListTransactionsUseCase(transactionRepo);
  });

  it('delegates to transactionRepo.list and returns the page', async () => {
    const page = makeFakePage(3);
    transactionRepo.list.mockResolvedValue(page);

    const result = await useCase.execute({
      query: { householdId: HOUSEHOLD_ID, limit: 20 },
      householdId: HOUSEHOLD_ID,
    });

    expect(result).toBe(page);
  });

  it('returns an empty page when there are no transactions', async () => {
    transactionRepo.list.mockResolvedValue(EMPTY_PAGE);

    const result = await useCase.execute({ query: { householdId: HOUSEHOLD_ID, limit: 20 }, householdId: HOUSEHOLD_ID });

    expect(result.items).toHaveLength(0);
    expect(result.nextCursor).toBeNull();
  });

  it('passes the query and household scope to the repository', async () => {
    transactionRepo.list.mockResolvedValue(EMPTY_PAGE);
    const query = { householdId: HOUSEHOLD_ID, limit: 10, dateFrom: '2025-01-01' as any };

    await useCase.execute({ query, householdId: HOUSEHOLD_ID });

    expect(transactionRepo.list).toHaveBeenCalledWith(query, { householdId: HOUSEHOLD_ID });
  });
});
