import { describe, it, expect, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { PatchTransactionUseCase } from '../PatchTransactionUseCase.js';
import type { TransactionRepository } from '../../../../domain/transactions/ports.js';
import { TransactionNotFoundError } from '../../../../domain/transactions/errors.js';
import type { Transaction } from '../../../../domain/transactions/entities.js';
import type { TransactionId, HouseholdId, UserId } from '@power-budget/core';

const txId = 'tx-1' as unknown as TransactionId;
const householdId = 'hh-1' as unknown as HouseholdId;
const userId = 'user-1' as unknown as UserId;

const fakeTx = { id: txId, householdId } as unknown as Transaction;

describe('PatchTransactionUseCase', () => {
  let txRepo: ReturnType<typeof mock<TransactionRepository>>;
  let useCase: PatchTransactionUseCase;

  beforeEach(() => {
    txRepo = mock<TransactionRepository>();
    useCase = new PatchTransactionUseCase(txRepo);
  });

  it('throws TransactionNotFoundError when not found', async () => {
    txRepo.findOwnedById.mockResolvedValue(null);

    await expect(
      useCase.execute({ transactionId: txId, householdId, userId, patch: { notes: 'note' } }),
    ).rejects.toThrow(TransactionNotFoundError);
  });

  it('patches transaction fields', async () => {
    txRepo.findOwnedById.mockResolvedValue(fakeTx);
    txRepo.patch.mockResolvedValue(undefined);

    await useCase.execute({
      transactionId: txId,
      householdId,
      userId,
      patch: { notes: 'updated', ignored: true },
    });

    expect(txRepo.findOwnedById).toHaveBeenCalledWith(txId, userId, { householdId });

    expect(txRepo.patch).toHaveBeenCalledWith(
      txId,
      { notes: 'updated', ignored: true },
      { householdId },
    );
  });
});
