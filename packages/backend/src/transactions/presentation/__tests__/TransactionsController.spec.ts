import { describe, it, expect, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { NotFoundException } from '@nestjs/common';
import type { HouseholdId, UserId, TransactionId } from '@power-budget/core';
import { TransactionsController } from '../TransactionsController.js';
import { ListTransactionsUseCase } from '../../application/use-cases/ListTransactionsUseCase.js';
import { GetTransactionUseCase } from '../../application/use-cases/GetTransactionUseCase.js';
import { AddManualTransactionUseCase } from '../../application/use-cases/AddManualTransactionUseCase.js';
import { MapTransactionUseCase } from '../../application/use-cases/MapTransactionUseCase.js';
import { BulkMapTransactionsUseCase } from '../../application/use-cases/BulkMapTransactionsUseCase.js';
import { MarkAsTransferUseCase } from '../../application/use-cases/MarkAsTransferUseCase.js';
import { UnmarkTransferUseCase } from '../../application/use-cases/UnmarkTransferUseCase.js';
import { PatchTransactionUseCase } from '../../application/use-cases/PatchTransactionUseCase.js';
import { TransactionNotFoundError } from '../../domain/errors.js';
import type { AuthenticatedUser } from '../../../auth/presentation/decorators/CurrentUser.js';

const TEST_HOUSEHOLD_ID = '01900000-0000-7000-8000-000000000001' as HouseholdId;
const TEST_USER_ID = '01900000-0000-7000-8000-000000000002' as UserId;
const TEST_TX_ID = '01900000-0000-7000-8000-000000000003' as TransactionId;

function makeUser(householdId: HouseholdId | null = TEST_HOUSEHOLD_ID): AuthenticatedUser {
  return { userId: TEST_USER_ID, householdId };
}

describe('TransactionsController', () => {
  let controller: TransactionsController;
  let listTransactions: ReturnType<typeof mock<ListTransactionsUseCase>>;
  let getTransaction: ReturnType<typeof mock<GetTransactionUseCase>>;
  let addManualTransaction: ReturnType<typeof mock<AddManualTransactionUseCase>>;
  let mapTransaction: ReturnType<typeof mock<MapTransactionUseCase>>;
  let bulkMapTransactions: ReturnType<typeof mock<BulkMapTransactionsUseCase>>;
  let markAsTransfer: ReturnType<typeof mock<MarkAsTransferUseCase>>;
  let unmarkTransfer: ReturnType<typeof mock<UnmarkTransferUseCase>>;
  let patchTransaction: ReturnType<typeof mock<PatchTransactionUseCase>>;

  beforeEach(() => {
    listTransactions = mock<ListTransactionsUseCase>();
    getTransaction = mock<GetTransactionUseCase>();
    addManualTransaction = mock<AddManualTransactionUseCase>();
    mapTransaction = mock<MapTransactionUseCase>();
    bulkMapTransactions = mock<BulkMapTransactionsUseCase>();
    markAsTransfer = mock<MarkAsTransferUseCase>();
    unmarkTransfer = mock<UnmarkTransferUseCase>();
    patchTransaction = mock<PatchTransactionUseCase>();

    controller = new TransactionsController(
      listTransactions,
      getTransaction,
      addManualTransaction,
      mapTransaction,
      bulkMapTransactions,
      markAsTransfer,
      unmarkTransfer,
      patchTransaction,
    );
  });

  describe('GET /transactions', () => {
    it('returns empty list when user has no household', async () => {
      const result = await controller.list({} as never, makeUser(null));
      expect(result).toEqual({ items: [], nextCursor: null, hasMore: false });
    });

    it('calls ListTransactionsUseCase with householdId and query params', async () => {
      const txList = { items: [], nextCursor: null, hasMore: false };
      listTransactions.execute.mockResolvedValue(txList as never);

      await controller.list({ accountId: 'acc-1', limit: 20 } as never, makeUser());

      expect(listTransactions.execute).toHaveBeenCalledWith(
        expect.objectContaining({ householdId: TEST_HOUSEHOLD_ID }),
      );
    });

    it('forwards pagination cursor to use case', async () => {
      listTransactions.execute.mockResolvedValue({
        items: [],
        nextCursor: null,
        hasMore: false,
      } as never);

      await controller.list({ cursor: 'c-1', limit: 10 } as never, makeUser());

      expect(listTransactions.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({ cursor: 'c-1', limit: 10 }),
        }),
      );
    });
  });

  describe('GET /transactions/:id', () => {
    it('calls GetTransactionUseCase and returns result', async () => {
      const tx = { id: TEST_TX_ID, description: 'Coffee' };
      getTransaction.execute.mockResolvedValue(tx as never);

      const result = await controller.getOne(TEST_TX_ID, makeUser());

      expect(getTransaction.execute).toHaveBeenCalledWith(TEST_TX_ID, TEST_HOUSEHOLD_ID);
      expect(result).toEqual(tx);
    });

    it('throws NotFoundException when transaction not found', async () => {
      getTransaction.execute.mockRejectedValue(new TransactionNotFoundError());

      await expect(controller.getOne(TEST_TX_ID, makeUser())).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('POST /transactions (manual)', () => {
    it('calls AddManualTransactionUseCase with householdId and dto fields', async () => {
      const created = { id: TEST_TX_ID };
      addManualTransaction.execute.mockResolvedValue(created as never);

      const dto = {
        accountId: 'acc-1',
        occurredOn: '2024-01-15',
        amountMinor: 500,
        currency: 'PLN',
        description: 'Coffee',
      };
      const result = await controller.addManual(dto as never, makeUser());

      expect(addManualTransaction.execute).toHaveBeenCalledWith(
        expect.objectContaining({ householdId: TEST_HOUSEHOLD_ID, currency: 'PLN' }),
      );
      expect(result).toEqual(created);
    });
  });

  describe('PATCH /transactions/:id', () => {
    it('calls PatchTransactionUseCase and passes householdId', async () => {
      patchTransaction.execute.mockResolvedValue({ id: TEST_TX_ID } as never);

      await controller.patch(TEST_TX_ID, { notes: 'test note' } as never, makeUser());

      expect(patchTransaction.execute).toHaveBeenCalledWith(
        expect.objectContaining({ householdId: TEST_HOUSEHOLD_ID }),
      );
    });

    it('throws NotFoundException when transaction not found', async () => {
      patchTransaction.execute.mockRejectedValue(new TransactionNotFoundError());
      await expect(controller.patch(TEST_TX_ID, {} as never, makeUser())).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('POST /transactions/bulk', () => {
    it('calls BulkMapTransactionsUseCase when op is map and payload has plannedItemId', async () => {
      bulkMapTransactions.execute.mockResolvedValue(undefined);

      await controller.bulkMap(
        {
          op: 'map',
          ids: [TEST_TX_ID],
          payload: { plannedItemId: 'item-1' },
        } as never,
        makeUser(),
      );

      expect(bulkMapTransactions.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          mappings: [expect.objectContaining({ transactionId: TEST_TX_ID })],
        }),
      );
    });

    it('returns without calling use case when user has no household', async () => {
      await controller.bulkMap({ op: 'map', ids: [TEST_TX_ID] } as never, makeUser(null));
      expect(bulkMapTransactions.execute).not.toHaveBeenCalled();
    });
  });

  describe('POST /transactions/:id/transfer', () => {
    it('calls MarkAsTransferUseCase with transactionId and householdId', async () => {
      markAsTransfer.execute.mockResolvedValue(undefined);

      await controller.markTransfer(TEST_TX_ID, {} as never, makeUser());

      expect(markAsTransfer.execute).toHaveBeenCalledWith(
        expect.objectContaining({ transactionId: TEST_TX_ID, householdId: TEST_HOUSEHOLD_ID }),
      );
    });

    it('throws NotFoundException when transaction not found', async () => {
      markAsTransfer.execute.mockRejectedValue(new TransactionNotFoundError());
      await expect(
        controller.markTransfer(TEST_TX_ID, {} as never, makeUser()),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('DELETE /transactions/:id/transfer', () => {
    it('calls UnmarkTransferUseCase with transactionId', async () => {
      unmarkTransfer.execute.mockResolvedValue(undefined);

      await controller.unmarkTransferHandler(TEST_TX_ID, makeUser());

      expect(unmarkTransfer.execute).toHaveBeenCalledWith(
        expect.objectContaining({ transactionId: TEST_TX_ID }),
      );
    });
  });
});
