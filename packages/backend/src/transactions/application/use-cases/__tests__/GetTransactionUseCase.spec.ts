import { describe, it, expect, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { GetTransactionUseCase } from '../GetTransactionUseCase.js';
import type {
  TransactionRepository,
  MappingRepository,
  TransferRepository,
} from '../../../domain/ports.js';
import { TransactionNotFoundError } from '../../../domain/errors.js';
import type { Transaction, TransactionMapping, Transfer } from '../../../domain/entities.js';
import type { TransactionId, HouseholdId } from '@power-budget/core';

const txId = 'tx-1' as unknown as TransactionId;
const householdId = 'hh-1' as unknown as HouseholdId;

const fakeTx = { id: txId, householdId } as unknown as Transaction;
const fakeMapping = { id: 'mapping-1', transactionId: txId } as unknown as TransactionMapping;
const fakeTransfer = { id: 'tr-1' } as unknown as Transfer;

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
    txRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute(txId, householdId)).rejects.toThrow(TransactionNotFoundError);
  });

  it('returns transaction with mapping and transfer', async () => {
    txRepo.findById.mockResolvedValue(fakeTx);
    mappingRepo.findByTransaction.mockResolvedValue(fakeMapping);
    transferRepo.findByTransaction.mockResolvedValue(fakeTransfer);

    const result = await useCase.execute(txId, householdId);

    expect(result.transaction).toBe(fakeTx);
    expect(result.mapping).toBe(fakeMapping);
    expect(result.transfer).toBe(fakeTransfer);
  });

  it('fetches mapping and transfer in parallel', async () => {
    txRepo.findById.mockResolvedValue(fakeTx);
    mappingRepo.findByTransaction.mockResolvedValue(null);
    transferRepo.findByTransaction.mockResolvedValue(null);

    const result = await useCase.execute(txId, householdId);

    expect(mappingRepo.findByTransaction).toHaveBeenCalledWith(txId);
    expect(transferRepo.findByTransaction).toHaveBeenCalledWith(txId);
    expect(result.mapping).toBeNull();
    expect(result.transfer).toBeNull();
  });
});
