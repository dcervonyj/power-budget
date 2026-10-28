import { describe, it, expect, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { MapTransactionUseCase } from '../MapTransactionUseCase.js';
import type {
  TransactionRepository,
  MappingRepository,
  TransferRepository,
} from '../../../../domain/transactions/ports.js';
import {
  TransactionNotFoundError,
  AlreadyTransferError,
} from '../../../../domain/transactions/errors.js';
import type { Transaction, Transfer } from '../../../../domain/transactions/entities.js';
import type { LearnMerchantRuleUseCase } from '../../../categorisation/LearnMerchantRuleUseCase.js';
import { TransactionId, PlannedItemId, UserId, HouseholdId, PlanId } from '@power-budget/core';

const txId = TransactionId.of('01900000-2321-7f77-806b-ac43756e0a3f');
const plannedItemId = PlannedItemId.of('01900000-fe68-73ab-8c0d-d36470d21b91');
const userId = UserId.of('01900000-8ccf-7eb7-88be-5e5b937e1768');
const householdId = HouseholdId.of('01900000-b56d-7643-8d0f-31b1680a84b6');
const planId = PlanId.of('01900000-9df3-7cd5-8459-d2fb1d3f0b7c');

const fakeTx = { id: txId, householdId } as unknown as Transaction;
const fakeTransfer = { id: 'tr-1' } as unknown as Transfer;

const baseInput = {
  transactionId: txId,
  plannedItemId,
  by: userId,
  householdId,
  planId,
};

describe('MapTransactionUseCase', () => {
  let txRepo: ReturnType<typeof mock<TransactionRepository>>;
  let mappingRepo: ReturnType<typeof mock<MappingRepository>>;
  let transferRepo: ReturnType<typeof mock<TransferRepository>>;
  let merchantMemory: ReturnType<typeof mock<LearnMerchantRuleUseCase>>;
  let useCase: MapTransactionUseCase;

  beforeEach(() => {
    txRepo = mock<TransactionRepository>();
    mappingRepo = mock<MappingRepository>();
    transferRepo = mock<TransferRepository>();
    merchantMemory = mock<LearnMerchantRuleUseCase>();
    useCase = new MapTransactionUseCase(txRepo, mappingRepo, transferRepo, merchantMemory);
  });

  it('throws TransactionNotFoundError when transaction does not exist', async () => {
    txRepo.findOwnedById.mockResolvedValue(null);

    await expect(useCase.execute(baseInput)).rejects.toThrow(TransactionNotFoundError);
  });

  it('throws AlreadyTransferError when transaction is already a transfer', async () => {
    txRepo.findOwnedById.mockResolvedValue(fakeTx);
    transferRepo.findByTransaction.mockResolvedValue(fakeTransfer);

    await expect(useCase.execute(baseInput)).rejects.toThrow(AlreadyTransferError);
  });

  it('maps the transaction', async () => {
    txRepo.findOwnedById.mockResolvedValue(fakeTx);
    transferRepo.findByTransaction.mockResolvedValue(null);
    mappingRepo.set.mockResolvedValue(undefined);

    await useCase.execute(baseInput);

    expect(mappingRepo.set).toHaveBeenCalledWith(txId, plannedItemId, userId, { householdId });
  });

  it('teaches merchant memory when it maps to a planned item', async () => {
    txRepo.findOwnedById.mockResolvedValue(fakeTx);
    transferRepo.findByTransaction.mockResolvedValue(null);

    await useCase.execute(baseInput);

    expect(merchantMemory.learnFromMapping).toHaveBeenCalledWith({
      transaction: fakeTx,
      plannedItemId,
      by: userId,
      householdId,
    });
  });

  it('learns nothing from an unmap', async () => {
    txRepo.findOwnedById.mockResolvedValue(fakeTx);
    transferRepo.findByTransaction.mockResolvedValue(null);

    await useCase.execute({ ...baseInput, plannedItemId: null });

    expect(merchantMemory.learnFromMapping).not.toHaveBeenCalled();
  });

  it('unmaps the transaction (plannedItemId = null)', async () => {
    txRepo.findOwnedById.mockResolvedValue(fakeTx);
    transferRepo.findByTransaction.mockResolvedValue(null);
    mappingRepo.set.mockResolvedValue(undefined);

    await useCase.execute({ ...baseInput, plannedItemId: null });

    expect(mappingRepo.set).toHaveBeenCalledWith(txId, null, userId, { householdId });
  });
});
