import { describe, expect, it, vi } from 'vitest';
import type { HouseholdId, TransactionId } from '@power-budget/core';
import { DrizzleTransactionRepository } from '../DrizzleTransactionRepository.js';

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

  it('returns null when upsertByExternalId finds existing row', async () => {
    const existing = [{ id: 'existing-id' }];
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue(existing),
    };

    const repo = new DrizzleTransactionRepository(mockDb as never);
    const result = await repo.upsertByExternalId({
      id: 'new-id' as TransactionId,
      householdId: 'h-1' as HouseholdId,
      accountId: 'acc-1' as import('@power-budget/core').BankAccountId,
      externalId: 'ext-123',
      occurredOn: '2024-01-01' as import('@power-budget/core').IsoDate,
      amount: { amountMinor: 1000n, currency: 'USD' as import('@power-budget/core').CurrencyCode },
      description: 'Test',
      merchant: null,
      source: 'bank_sync',
    });

    expect(result).toEqual({ id: 'existing-id', created: false });
  });
});
