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
import type { TransactionId, UserId, HouseholdId } from '@power-budget/core';

const txId = 'tx-1' as unknown as TransactionId;
const userId = 'u-1' as unknown as UserId;
const householdId = 'hh-1' as unknown as HouseholdId;

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
    txRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute(baseInput)).rejects.toThrow(TransactionNotFoundError);
  });

  it('throws AlreadyMappedError when transaction has an existing mapping', async () => {
    txRepo.findById.mockResolvedValue(fakeTx);
    mappingRepo.findByTransaction.mockResolvedValue(fakeMapping);

    await expect(useCase.execute(baseInput)).rejects.toThrow(AlreadyMappedError);
  });

  it('marks transaction as transfer', async () => {
    txRepo.findById.mockResolvedValue(fakeTx);
    mappingRepo.findByTransaction.mockResolvedValue(null);
    transferRepo.mark.mockResolvedValue(
      'tr-1' as unknown as ReturnType<typeof transferRepo.mark> extends Promise<infer R>
        ? R
        : never,
    );

    await useCase.execute(baseInput);

    expect(transferRepo.mark).toHaveBeenCalledWith(txId, null, userId);
  });
});
