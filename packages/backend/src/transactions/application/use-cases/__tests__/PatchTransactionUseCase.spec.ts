import { describe, it, expect, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { PatchTransactionUseCase } from '../PatchTransactionUseCase.js';
import type { TransactionRepository } from '../../../domain/ports.js';
import { TransactionNotFoundError } from '../../../domain/errors.js';
import type { Transaction } from '../../../domain/entities.js';
import type { TransactionId, HouseholdId } from '@power-budget/core';

const txId = 'tx-1' as unknown as TransactionId;
const householdId = 'hh-1' as unknown as HouseholdId;

const fakeTx = { id: txId, householdId } as unknown as Transaction;

describe('PatchTransactionUseCase', () => {
  let txRepo: ReturnType<typeof mock<TransactionRepository>>;
  let useCase: PatchTransactionUseCase;

  beforeEach(() => {
    txRepo = mock<TransactionRepository>();
    useCase = new PatchTransactionUseCase(txRepo);
  });

  it('throws TransactionNotFoundError when not found', async () => {
    txRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ transactionId: txId, householdId, patch: { notes: 'note' } }),
    ).rejects.toThrow(TransactionNotFoundError);
  });

  it('patches transaction fields', async () => {
    txRepo.findById.mockResolvedValue(fakeTx);
    txRepo.patch.mockResolvedValue(undefined);

    await useCase.execute({
      transactionId: txId,
      householdId,
      patch: { notes: 'updated', ignored: true },
    });

    expect(txRepo.patch).toHaveBeenCalledWith(txId, { notes: 'updated', ignored: true });
  });
});
