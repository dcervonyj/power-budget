import { describe, it, expect } from 'vitest';
import { createMock } from '@golevelup/ts-vitest';
import { HouseholdId, TransactionId, UserId } from '@power-budget/core';
import type {
  TransactionRepository,
  TransferRepository,
} from '../../../../domain/transactions/ports.js';
import {
  AlreadyMappedError,
  TransactionNotFoundError,
} from '../../../../domain/transactions/errors.js';
import { BulkActOnTransactionsUseCase } from '../BulkActOnTransactionsUseCase.js';

const HOUSEHOLD = HouseholdId.of('01900000-0000-7000-8000-0000000000c1');
const USER = UserId.of('01900000-0000-7000-8000-0000000000c2');
const TX_1 = TransactionId.of('01900000-0000-7000-8000-0000000000c3');
const TX_2 = TransactionId.of('01900000-0000-7000-8000-0000000000c4');
const scope = { householdId: HOUSEHOLD };

function setup(owned: TransactionId[]): {
  txRepo: ReturnType<typeof createMock<TransactionRepository>>;
  transferRepo: ReturnType<typeof createMock<TransferRepository>>;
  useCase: BulkActOnTransactionsUseCase;
} {
  const txRepo = createMock<TransactionRepository>();
  const transferRepo = createMock<TransferRepository>();
  txRepo.findOwnedIds.mockResolvedValue(owned);

  return { txRepo, transferRepo, useCase: new BulkActOnTransactionsUseCase(txRepo, transferRepo) };
}

describe('BulkActOnTransactionsUseCase', () => {
  it('marks every own transaction as a transfer, each id once', async () => {
    const { txRepo, transferRepo, useCase } = setup([TX_1, TX_2]);

    await useCase.execute({
      action: 'transfer',
      transactionIds: [TX_1, TX_2, TX_1],
      by: USER,
      householdId: HOUSEHOLD,
    });

    expect(txRepo.findOwnedIds).toHaveBeenCalledWith([TX_1, TX_2], USER, scope);
    expect(transferRepo.bulkMarkStandalone).toHaveBeenCalledWith([TX_1, TX_2], USER, scope);
    expect(txRepo.setIgnored).not.toHaveBeenCalled();
  });

  it('ignores every own transaction in one call', async () => {
    const { txRepo, transferRepo, useCase } = setup([TX_1, TX_2]);

    await useCase.execute({
      action: 'ignore',
      transactionIds: [TX_1, TX_2],
      by: USER,
      householdId: HOUSEHOLD,
    });

    expect(txRepo.setIgnored).toHaveBeenCalledWith([TX_1, TX_2], true, scope);
    expect(transferRepo.bulkMarkStandalone).not.toHaveBeenCalled();
  });

  it.each(['transfer', 'ignore'] as const)(
    '%s: rejects the whole batch when one id is not the caller’s own',
    async (action) => {
      const { txRepo, transferRepo, useCase } = setup([TX_1]);

      await expect(
        useCase.execute({
          action,
          transactionIds: [TX_1, TX_2],
          by: USER,
          householdId: HOUSEHOLD,
        }),
      ).rejects.toThrow(TransactionNotFoundError);
      expect(transferRepo.bulkMarkStandalone).not.toHaveBeenCalled();
      expect(txRepo.setIgnored).not.toHaveBeenCalled();
    },
  );

  it('passes on ALREADY_MAPPED from the transfer repository', async () => {
    const { transferRepo, useCase } = setup([TX_1]);
    transferRepo.bulkMarkStandalone.mockRejectedValue(new AlreadyMappedError());

    await expect(
      useCase.execute({
        action: 'transfer',
        transactionIds: [TX_1],
        by: USER,
        householdId: HOUSEHOLD,
      }),
    ).rejects.toThrow(AlreadyMappedError);
  });

  it('does nothing for an empty batch', async () => {
    const { txRepo, transferRepo, useCase } = setup([]);

    await useCase.execute({
      action: 'ignore',
      transactionIds: [],
      by: USER,
      householdId: HOUSEHOLD,
    });

    expect(txRepo.findOwnedIds).not.toHaveBeenCalled();
    expect(txRepo.setIgnored).not.toHaveBeenCalled();
    expect(transferRepo.bulkMarkStandalone).not.toHaveBeenCalled();
  });
});
