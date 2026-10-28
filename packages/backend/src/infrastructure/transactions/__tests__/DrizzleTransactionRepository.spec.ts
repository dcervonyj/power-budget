import { describe, expect, it, vi } from 'vitest';
import type { HouseholdId, TransactionId } from '@power-budget/core';
import { DrizzleTransactionRepository } from '../DrizzleTransactionRepository.js';
import { NO_BANK_DETAILS } from '../../../domain/transactions/entities.js';

const BASE_ROW = {
  id: 'new-id' as TransactionId,
  householdId: 'h-1' as HouseholdId,
  accountId: 'acc-1' as import('@power-budget/core').BankAccountId,
  externalId: 'ext-123',
  occurredOn: '2024-01-01' as import('@power-budget/core').IsoDate,
  amount: { amountMinor: 1000n, currency: 'USD' as import('@power-budget/core').CurrencyCode },
  description: 'Test',
  merchant: null,
  source: 'bank_sync' as const,
  sourceKind: null,
  status: 'booked' as const,
  bank: NO_BANK_DETAILS,
  ignored: false,
};

describe('DrizzleTransactionRepository', () => {
  it('returns null when findById gets no rows', async () => {
    // Arrange: chain terminates with empty array
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
    };

    const repo = new DrizzleTransactionRepository(mockDb as never);
    const result = await repo.findById('tx-1' as TransactionId, {
      householdId: 'h-1' as HouseholdId,
    });

    expect(result).toBeNull();
  });

  function bankRow(id: string, externalId: string) {
    return {
      ...BASE_ROW,
      id: id as TransactionId,
      externalId,
    };
  }

  it('insertBankBatch writes the batch with one insert and counts the created rows', async () => {
    const mockDb = {
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      onConflictDoNothing: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ id: 'a' }]),
    };

    const repo = new DrizzleTransactionRepository(mockDb as never);
    const created = await repo.insertBankBatch([bankRow('a', 'e1'), bankRow('b', 'e2')]);

    expect(created).toBe(1);
    expect(mockDb.insert).toHaveBeenCalledTimes(1);
    expect(mockDb.values.mock.calls[0]![0]).toHaveLength(2);
    expect(mockDb.onConflictDoNothing).toHaveBeenCalledTimes(1);
  });

  it('insertBankBatch runs no statement for an empty batch', async () => {
    const mockDb = { insert: vi.fn() };

    const created = await new DrizzleTransactionRepository(mockDb as never).insertBankBatch([]);

    expect(created).toBe(0);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });
});
