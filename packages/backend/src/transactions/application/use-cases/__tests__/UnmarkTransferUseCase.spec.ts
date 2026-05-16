import { describe, it, expect, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { HouseholdId, TransactionId } from '@power-budget/core';
import type { TransactionRepository, TransferRepository } from '../../../domain/ports.js';
import type { Transaction } from '../../../domain/entities.js';
import { UnmarkTransferUseCase } from '../UnmarkTransferUseCase.js';
import { TransactionNotFoundError } from '../../../domain/errors.js';

const HOUSEHOLD_ID = '01900000-0000-7000-8000-000000000001' as HouseholdId;
const TX_ID = '01900000-0000-7000-8000-000000000010' as TransactionId;

const FAKE_TX = { id: TX_ID, householdId: HOUSEHOLD_ID } as unknown as Transaction;

describe('UnmarkTransferUseCase', () => {
  let transactionRepo: ReturnType<typeof mock<TransactionRepository>>;
  let transferRepo: ReturnType<typeof mock<TransferRepository>>;
  let useCase: UnmarkTransferUseCase;

  beforeEach(() => {
    transactionRepo = mock<TransactionRepository>();
    transferRepo = mock<TransferRepository>();
    useCase = new UnmarkTransferUseCase(transactionRepo, transferRepo);
  });

  it('unmarks the transfer for an existing transaction', async () => {
    transactionRepo.findById.mockResolvedValue(FAKE_TX);
    transferRepo.unmark.mockResolvedValue(undefined);

    await useCase.execute({ transactionId: TX_ID, householdId: HOUSEHOLD_ID });

    expect(transferRepo.unmark).toHaveBeenCalledWith(TX_ID);
  });

  it('throws TransactionNotFoundError when transaction does not exist', async () => {
    transactionRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ transactionId: TX_ID, householdId: HOUSEHOLD_ID }),
    ).rejects.toThrow(TransactionNotFoundError);
  });

  it('does not call transferRepo when transaction is not found', async () => {
    transactionRepo.findById.mockResolvedValue(null);

    await useCase.execute({ transactionId: TX_ID, householdId: HOUSEHOLD_ID }).catch(() => {});

    expect(transferRepo.unmark).not.toHaveBeenCalled();
  });

  it('looks up transaction using household scope', async () => {
    transactionRepo.findById.mockResolvedValue(FAKE_TX);
    transferRepo.unmark.mockResolvedValue(undefined);

    await useCase.execute({ transactionId: TX_ID, householdId: HOUSEHOLD_ID });

    expect(transactionRepo.findById).toHaveBeenCalledWith(TX_ID, { householdId: HOUSEHOLD_ID });
  });
});
