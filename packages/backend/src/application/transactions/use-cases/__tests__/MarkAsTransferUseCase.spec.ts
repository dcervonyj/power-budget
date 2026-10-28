import { describe, it, expect, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { MarkAsTransferUseCase } from '../MarkAsTransferUseCase.js';
import type {
  TransactionRepository,
  MappingRepository,
  TransferRepository,
} from '../../../../domain/transactions/ports.js';
import {
  TransactionNotFoundError,
  AlreadyMappedError,
} from '../../../../domain/transactions/errors.js';
import type { Transaction, TransactionMapping } from '../../../../domain/transactions/entities.js';
import { TransactionId, UserId, HouseholdId } from '@power-budget/core';

const txId = TransactionId.of('01900000-2321-7f77-806b-ac43756e0a3f');
const userId = UserId.of('01900000-8ccf-7eb7-88be-5e5b937e1768');
const householdId = HouseholdId.of('01900000-b56d-7643-8d0f-31b1680a84b6');

const fakeTx = { id: txId, householdId } as unknown as Transaction;
const fakeMapping = { id: 'mapping-1', transactionId: txId } as unknown as TransactionMapping;

const baseInput = {
  transactionId: txId,
  counterpartId: null,
  by: userId,
  householdId,
};

describe('MarkAsTransferUseCase', () => {
  let txRepo: ReturnType<typeof mock<TransactionRepository>>;
  let mappingRepo: ReturnType<typeof mock<MappingRepository>>;
  let transferRepo: ReturnType<typeof mock<TransferRepository>>;
  let useCase: MarkAsTransferUseCase;

  beforeEach(() => {
    txRepo = mock<TransactionRepository>();
    mappingRepo = mock<MappingRepository>();
    transferRepo = mock<TransferRepository>();
    useCase = new MarkAsTransferUseCase(txRepo, mappingRepo, transferRepo);
  });

  it('throws TransactionNotFoundError when transaction does not exist', async () => {
    txRepo.findOwnedById.mockResolvedValue(null);

    await expect(useCase.execute(baseInput)).rejects.toThrow(TransactionNotFoundError);
  });

  it('throws AlreadyMappedError when transaction has an existing mapping', async () => {
    txRepo.findOwnedById.mockResolvedValue(fakeTx);
    mappingRepo.findByTransaction.mockResolvedValue(fakeMapping);

    await expect(useCase.execute(baseInput)).rejects.toThrow(AlreadyMappedError);
  });

  it('marks transaction as transfer', async () => {
    txRepo.findOwnedById.mockResolvedValue(fakeTx);
    mappingRepo.findByTransaction.mockResolvedValue(null);
    transferRepo.mark.mockResolvedValue(
      'tr-1' as unknown as ReturnType<typeof transferRepo.mark> extends Promise<infer R>
        ? R
        : never,
    );

    await useCase.execute(baseInput);

    expect(transferRepo.mark).toHaveBeenCalledWith(txId, null, userId, { householdId });
  });

  it("rejects a counterpart that is not on the caller's own accounts and writes nothing", async () => {
    const counterpartId = TransactionId.of('01900000-e139-7d2a-82db-37e4ac17ab34');
    txRepo.findOwnedById.mockImplementation(async (id) => (id === txId ? fakeTx : null));

    await expect(useCase.execute({ ...baseInput, counterpartId })).rejects.toThrow(
      TransactionNotFoundError,
    );

    expect(txRepo.findOwnedById).toHaveBeenCalledWith(txId, userId, { householdId });
    expect(txRepo.findOwnedById).toHaveBeenCalledWith(counterpartId, userId, { householdId });
    expect(transferRepo.mark).not.toHaveBeenCalled();
  });
});
