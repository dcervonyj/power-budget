import { describe, it, expect } from 'vitest';
import { createMock } from '@golevelup/ts-vitest';
import { HouseholdId, PlanId, PlannedItemId, TransactionId, UserId } from '@power-budget/core';
import type {
  MappingRepository,
  TransactionRepository,
  TransferRepository,
} from '../../../../domain/transactions/ports.js';
import { TransactionNotFoundError } from '../../../../domain/transactions/errors.js';
import type { LearnMerchantRuleUseCase } from '../../../categorisation/LearnMerchantRuleUseCase.js';
import { BulkMapTransactionsUseCase } from '../BulkMapTransactionsUseCase.js';
import { UnmarkTransferUseCase } from '../UnmarkTransferUseCase.js';
import { makeTransaction } from '../../../../test/doubles/transactions.js';

const HOUSEHOLD = HouseholdId.of('01900000-0000-7000-8000-0000000000b1');
const USER = UserId.of('01900000-0000-7000-8000-0000000000b2');
const TX_1 = TransactionId.of('01900000-0000-7000-8000-0000000000b3');
const TX_2 = TransactionId.of('01900000-0000-7000-8000-0000000000b4');
const ITEM = PlannedItemId.of('01900000-0000-7000-8000-0000000000b5');
const PLAN = PlanId.of('01900000-0000-7000-8000-0000000000b6');
const scope = { householdId: HOUSEHOLD };

describe('UnmarkTransferUseCase', () => {
  it("unmarks the caller's own transaction", async () => {
    const txRepo = createMock<TransactionRepository>();
    const transferRepo = createMock<TransferRepository>();
    txRepo.findOwnedById.mockResolvedValue(makeTransaction({ id: TX_1 }));

    await new UnmarkTransferUseCase(txRepo, transferRepo).execute({
      transactionId: TX_1,
      householdId: HOUSEHOLD,
      userId: USER,
    });

    expect(txRepo.findOwnedById).toHaveBeenCalledWith(TX_1, USER, scope);
    expect(transferRepo.unmark).toHaveBeenCalledWith(TX_1, scope);
  });

  it("rejects a transaction that is not the caller's own", async () => {
    const txRepo = createMock<TransactionRepository>();
    const transferRepo = createMock<TransferRepository>();
    txRepo.findOwnedById.mockResolvedValue(null);

    await expect(
      new UnmarkTransferUseCase(txRepo, transferRepo).execute({
        transactionId: TX_1,
        householdId: HOUSEHOLD,
        userId: USER,
      }),
    ).rejects.toThrow(TransactionNotFoundError);
    expect(transferRepo.unmark).not.toHaveBeenCalled();
  });
});

describe('BulkMapTransactionsUseCase', () => {
  const input = {
    mappings: [
      { transactionId: TX_1, plannedItemId: ITEM },
      { transactionId: TX_2, plannedItemId: ITEM },
      { transactionId: TX_1, plannedItemId: ITEM },
    ],
    by: USER,
    householdId: HOUSEHOLD,
    planId: PLAN,
  };

  it('maps the batch when every transaction is the caller’s own', async () => {
    const txRepo = createMock<TransactionRepository>();
    const mappingRepo = createMock<MappingRepository>();
    txRepo.findOwnedIds.mockResolvedValue([TX_1, TX_2]);

    await new BulkMapTransactionsUseCase(
      txRepo,
      mappingRepo,
      createMock<LearnMerchantRuleUseCase>(),
    ).execute(input);

    expect(txRepo.findOwnedIds).toHaveBeenCalledWith([TX_1, TX_2], USER, scope);
    expect(mappingRepo.bulkSet).toHaveBeenCalledWith(input.mappings, USER, scope);
  });

  it('teaches merchant memory for each mapped transaction', async () => {
    const txRepo = createMock<TransactionRepository>();
    const mappingRepo = createMock<MappingRepository>();
    const memory = createMock<LearnMerchantRuleUseCase>();
    const tx1 = makeTransaction({ id: TX_1 });
    const tx2 = makeTransaction({ id: TX_2 });
    txRepo.findOwnedIds.mockResolvedValue([TX_1, TX_2]);
    txRepo.findById.mockImplementation(async (id) => (id === TX_1 ? tx1 : tx2));

    await new BulkMapTransactionsUseCase(txRepo, mappingRepo, memory).execute({
      ...input,
      mappings: input.mappings.slice(0, 2),
    });

    expect(memory.learnFromMapping).toHaveBeenCalledTimes(2);
    expect(memory.learnFromMapping).toHaveBeenCalledWith({
      transaction: tx1,
      plannedItemId: ITEM,
      by: USER,
      householdId: HOUSEHOLD,
    });
    expect(memory.learnFromMapping).toHaveBeenCalledWith({
      transaction: tx2,
      plannedItemId: ITEM,
      by: USER,
      householdId: HOUSEHOLD,
    });
  });

  it('keeps the saved mappings when loading a transaction for learning fails', async () => {
    const txRepo = createMock<TransactionRepository>();
    const mappingRepo = createMock<MappingRepository>();
    const memory = createMock<LearnMerchantRuleUseCase>();
    txRepo.findOwnedIds.mockResolvedValue([TX_1, TX_2]);
    txRepo.findById.mockRejectedValue(new Error('boom'));

    await new BulkMapTransactionsUseCase(txRepo, mappingRepo, memory).execute(input);

    expect(mappingRepo.bulkSet).toHaveBeenCalledWith(input.mappings, USER, scope);
    expect(memory.learnFromMapping).not.toHaveBeenCalled();
  });

  it('rejects the whole batch when one transaction is not the caller’s own', async () => {
    const txRepo = createMock<TransactionRepository>();
    const mappingRepo = createMock<MappingRepository>();
    txRepo.findOwnedIds.mockResolvedValue([TX_1]);

    await expect(
      new BulkMapTransactionsUseCase(
        txRepo,
        mappingRepo,
        createMock<LearnMerchantRuleUseCase>(),
      ).execute(input),
    ).rejects.toThrow(TransactionNotFoundError);
    expect(mappingRepo.bulkSet).not.toHaveBeenCalled();
  });

  it('does nothing for an empty batch', async () => {
    const txRepo = createMock<TransactionRepository>();
    const mappingRepo = createMock<MappingRepository>();

    await new BulkMapTransactionsUseCase(
      txRepo,
      mappingRepo,
      createMock<LearnMerchantRuleUseCase>(),
    ).execute({ ...input, mappings: [] });

    expect(txRepo.findOwnedIds).not.toHaveBeenCalled();
    expect(mappingRepo.bulkSet).not.toHaveBeenCalled();
  });
});
