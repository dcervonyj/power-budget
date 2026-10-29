import { describe, expect, it, vi } from 'vitest';
import { BankAccountId, HouseholdId, IsoDate, TransactionId, UserId } from '@power-budget/core';
import { createMock } from '@golevelup/ts-vitest';
import { DrizzleTransactionRepository } from '../DrizzleTransactionRepository.js';
import { NO_BANK_DETAILS, type NewTransaction } from '../../../domain/transactions/entities.js';
import { testUuid } from '../../../test/doubles/testUuid.js';

const BASE_ROW: NewTransaction = {
  id: TransactionId.of('01900000-5c5d-7e7d-8413-10854ca054d0'),
  householdId: HouseholdId.of('01900000-3a12-768a-84e1-7ff1aae8835b'),
  accountId: BankAccountId.of(testUuid('acc-1')),
  externalId: 'ext-123',
  occurredOn: IsoDate.of('2024-01-01'),
  amount: { amountMinor: 1000n, currency: 'USD' },
  description: 'Test',
  merchant: null,
  source: 'bank_sync',
  sourceKind: null,
  status: 'booked',
  bank: NO_BANK_DETAILS,
  ignored: false,
};

const OWNER = UserId.of('00000000-0000-7000-8000-000000000001');

type Db = ConstructorParameters<typeof DrizzleTransactionRepository>[0];

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

    const repo = new DrizzleTransactionRepository(createMock<Db>(mockDb));
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

    const repo = new DrizzleTransactionRepository(createMock<Db>(mockDb));
    const created = await repo.insertBankBatch([bankRow('a', 'e1'), bankRow('b', 'e2')], OWNER);

    expect(created).toBe(1);
    expect(mockDb.execute).toHaveBeenCalledTimes(1);
  });

  it('insertBankBatch runs no statement for an empty batch', async () => {
    const mockDb = { execute: vi.fn() };

    const created = await new DrizzleTransactionRepository(createMock<Db>(mockDb)).insertBankBatch(
      [],
      OWNER,
    );

    expect(created).toBe(0);
    expect(mockDb.execute).not.toHaveBeenCalled();
  });
});
