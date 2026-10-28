import { describe, expect, it, vi } from 'vitest';
import { HouseholdId, TransactionId, UserId } from '@power-budget/core';
import { DrizzleTransactionRepository } from '../DrizzleTransactionRepository.js';
import { NO_BANK_DETAILS } from '../../../domain/transactions/entities.js';
import { testUuid } from '../../../test/doubles/testUuid.js';

const BASE_ROW = {
  id: TransactionId.of('01900000-5c5d-7e7d-8413-10854ca054d0'),
  householdId: HouseholdId.of('01900000-3a12-768a-84e1-7ff1aae8835b'),
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

const OWNER = UserId.of('00000000-0000-7000-8000-000000000001');

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
    const result = await repo.findById(TransactionId.of('01900000-2321-7f77-806b-ac43756e0a3f'), {
      householdId: HouseholdId.of('01900000-3a12-768a-84e1-7ff1aae8835b'),
    });

    expect(result).toBeNull();
  });

  function bankRow(id: string, externalId: string) {
    return {
      ...BASE_ROW,
      id: TransactionId.of(testUuid(id)),
      externalId,
    };
  }

  it('insertBankBatch writes the batch with one statement and counts the created rows', async () => {
    const mockDb = {
      execute: vi.fn().mockResolvedValue({ rows: [{ id: 'a' }] }),
      transaction: vi.fn(),
    };
    mockDb.transaction.mockImplementation((work: (tx: unknown) => unknown) => work(mockDb));

    const repo = new DrizzleTransactionRepository(mockDb as never);
    const created = await repo.insertBankBatch([bankRow('a', 'e1'), bankRow('b', 'e2')], OWNER);

    expect(created).toBe(1);
    expect(mockDb.execute).toHaveBeenCalledTimes(1);
  });

  it('insertBankBatch runs no statement for an empty batch', async () => {
    const mockDb = { execute: vi.fn() };

    const created = await new DrizzleTransactionRepository(mockDb as never).insertBankBatch(
      [],
      OWNER,
    );

    expect(created).toBe(0);
    expect(mockDb.execute).not.toHaveBeenCalled();
  });
});
