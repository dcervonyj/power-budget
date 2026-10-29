import { describe, it, expect, beforeEach } from 'vitest';
import { createMock } from '@golevelup/ts-vitest';
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
import { TransactionId, TransferId, UserId, HouseholdId } from '@power-budget/core';
import { makeTransaction, makeTransactionMapping } from '../../../../test/doubles/transactions.js';
import { testUuid } from '../../../../test/doubles/testUuid.js';

const txId = TransactionId.of('01900000-2321-7f77-806b-ac43756e0a3f');
const userId = UserId.of('01900000-8ccf-7eb7-88be-5e5b937e1768');
const householdId = HouseholdId.of('01900000-b56d-7643-8d0f-31b1680a84b6');

const fakeTx = makeTransaction({ id: txId, householdId });
const fakeMapping = makeTransactionMapping({ transactionId: txId });

const baseInput = {
  transactionId: txId,
  counterpartId: null,
  by: userId,
  householdId,
};

describe('MarkAsTransferUseCase', () => {
  let txRepo: ReturnType<typeof createMock<TransactionRepository>>;
  let mappingRepo: ReturnType<typeof createMock<MappingRepository>>;
  let transferRepo: ReturnType<typeof createMock<TransferRepository>>;
  let useCase: MarkAsTransferUseCase;

  beforeEach(() => {
    txRepo = createMock<TransactionRepository>();
    mappingRepo = createMock<MappingRepository>();
    transferRepo = createMock<TransferRepository>();
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
    transferRepo.mark.mockResolvedValue(TransferId.of(testUuid('tr-1')));

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
