import { describe, it, expect, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { MapTransactionUseCase } from '../MapTransactionUseCase.js';
import type {
  TransactionRepository,
  MappingRepository,
  TransferRepository,
  PlanActualsRefreshPort,
} from '../../../../domain/transactions/ports.js';
import {
  TransactionNotFoundError,
  AlreadyTransferError,
} from '../../../../domain/transactions/errors.js';
import type { Transaction, Transfer } from '../../../../domain/transactions/entities.js';
import type { TransactionId, PlannedItemId, UserId, HouseholdId, PlanId } from '@power-budget/core';

const txId = 'tx-1' as unknown as TransactionId;
const plannedItemId = 'pi-1' as unknown as PlannedItemId;
const userId = 'u-1' as unknown as UserId;
const householdId = 'hh-1' as unknown as HouseholdId;
const planId = 'plan-1' as unknown as PlanId;

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
  let refreshPort: ReturnType<typeof mock<PlanActualsRefreshPort>>;
  let useCase: MapTransactionUseCase;

  beforeEach(() => {
    txRepo = mock<TransactionRepository>();
    mappingRepo = mock<MappingRepository>();
    transferRepo = mock<TransferRepository>();
    refreshPort = mock<PlanActualsRefreshPort>();
    useCase = new MapTransactionUseCase(txRepo, mappingRepo, transferRepo, refreshPort);
  });

  it('throws TransactionNotFoundError when transaction does not exist', async () => {
    txRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute(baseInput)).rejects.toThrow(TransactionNotFoundError);
  });

  it('throws AlreadyTransferError when transaction is already a transfer', async () => {
    txRepo.findById.mockResolvedValue(fakeTx);
    transferRepo.findByTransaction.mockResolvedValue(fakeTransfer);

    await expect(useCase.execute(baseInput)).rejects.toThrow(AlreadyTransferError);
  });

  it('maps transaction and schedules refresh', async () => {
    txRepo.findById.mockResolvedValue(fakeTx);
    transferRepo.findByTransaction.mockResolvedValue(null);
    mappingRepo.set.mockResolvedValue(undefined);
    refreshPort.scheduleRefresh.mockResolvedValue(undefined);

    await useCase.execute(baseInput);

    expect(mappingRepo.set).toHaveBeenCalledWith(txId, plannedItemId, userId);
    expect(refreshPort.scheduleRefresh).toHaveBeenCalledWith(planId);
  });

  it('unmaps transaction (plannedItemId = null) and schedules refresh', async () => {
    txRepo.findById.mockResolvedValue(fakeTx);
    transferRepo.findByTransaction.mockResolvedValue(null);
    mappingRepo.set.mockResolvedValue(undefined);
    refreshPort.scheduleRefresh.mockResolvedValue(undefined);

    await useCase.execute({ ...baseInput, plannedItemId: null });

    expect(mappingRepo.set).toHaveBeenCalledWith(txId, null, userId);
    expect(refreshPort.scheduleRefresh).toHaveBeenCalledWith(planId);
  });
});
