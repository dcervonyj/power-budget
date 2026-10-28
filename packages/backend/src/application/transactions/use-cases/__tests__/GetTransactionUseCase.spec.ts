import { describe, it, expect, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { GetTransactionUseCase } from '../GetTransactionUseCase.js';
import type {
  TransactionRepository,
  MappingRepository,
  TransferRepository,
} from '../../../../domain/transactions/ports.js';
import { TransactionNotFoundError } from '../../../../domain/transactions/errors.js';
import { TransactionId, HouseholdId, UserId } from '@power-budget/core';
import {
  makeTransaction,
  makeTransactionMapping,
  makeTransfer,
} from '../../../../test/doubles/transactions.js';

const txId = TransactionId.of('01900000-2321-7f77-806b-ac43756e0a3f');
const householdId = HouseholdId.of('01900000-b56d-7643-8d0f-31b1680a84b6');
const viewer = UserId.of('01900000-9dff-7fe4-8508-52c20c8876f6');

const fakeTx = makeTransaction({ id: txId, householdId });
const fakeMapping = makeTransactionMapping({ transactionId: txId });
const fakeTransfer = makeTransfer();

describe('GetTransactionUseCase', () => {
  let txRepo: ReturnType<typeof mock<TransactionRepository>>;
  let mappingRepo: ReturnType<typeof mock<MappingRepository>>;
  let transferRepo: ReturnType<typeof mock<TransferRepository>>;
  let useCase: GetTransactionUseCase;

  beforeEach(() => {
    txRepo = mock<TransactionRepository>();
    mappingRepo = mock<MappingRepository>();
    transferRepo = mock<TransferRepository>();
    useCase = new GetTransactionUseCase(txRepo, mappingRepo, transferRepo);
  });

  it('throws TransactionNotFoundError when not found', async () => {
    txRepo.findOwnedById.mockResolvedValue(null);

    await expect(useCase.execute(txId, householdId, viewer)).rejects.toThrow(
      TransactionNotFoundError,
    );
  });

  it('returns transaction with mapping and transfer', async () => {
    txRepo.findOwnedById.mockResolvedValue(fakeTx);
    mappingRepo.findByTransaction.mockResolvedValue(fakeMapping);
    transferRepo.findByTransaction.mockResolvedValue(fakeTransfer);

    const result = await useCase.execute(txId, householdId, viewer);

    expect(result.transaction).toBe(fakeTx);
    expect(result.mapping).toBe(fakeMapping);
    expect(result.transfer).toBe(fakeTransfer);
  });

  it('fetches mapping and transfer in parallel', async () => {
    txRepo.findOwnedById.mockResolvedValue(fakeTx);
    mappingRepo.findByTransaction.mockResolvedValue(null);
    transferRepo.findByTransaction.mockResolvedValue(null);

    const result = await useCase.execute(txId, householdId, viewer);

    expect(txRepo.findOwnedById).toHaveBeenCalledWith(txId, viewer, { householdId });
    expect(mappingRepo.findByTransaction).toHaveBeenCalledWith(txId, { householdId });
    expect(transferRepo.findByTransaction).toHaveBeenCalledWith(txId, { householdId });
    expect(result.mapping).toBeNull();
    expect(result.transfer).toBeNull();
  });
});
