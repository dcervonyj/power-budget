import { describe, it, expect, beforeEach } from 'vitest';
import { createMock } from '@golevelup/ts-vitest';
import { PatchTransactionUseCase } from '../PatchTransactionUseCase.js';
import type { TransactionRepository } from '../../../../domain/transactions/ports.js';
import { TransactionNotFoundError } from '../../../../domain/transactions/errors.js';
import { TransactionId, HouseholdId, UserId } from '@power-budget/core';
import { makeTransaction } from '../../../../test/doubles/transactions.js';

const txId = TransactionId.of('01900000-2321-7f77-806b-ac43756e0a3f');
const householdId = HouseholdId.of('01900000-b56d-7643-8d0f-31b1680a84b6');
const userId = UserId.of('01900000-9dff-7fe4-8508-52c20c8876f6');

const fakeTx = makeTransaction({ id: txId, householdId });

describe('PatchTransactionUseCase', () => {
  let txRepo: ReturnType<typeof createMock<TransactionRepository>>;
  let useCase: PatchTransactionUseCase;

  beforeEach(() => {
    txRepo = createMock<TransactionRepository>();
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
