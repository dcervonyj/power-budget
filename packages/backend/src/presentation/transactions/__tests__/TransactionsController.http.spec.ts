import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { HouseholdId, UserId } from '@power-budget/core';
import { TransactionsController } from '../TransactionsController.js';
import { AddManualTransactionUseCase } from '../../../application/transactions/use-cases/AddManualTransactionUseCase.js';
import { BulkActOnTransactionsUseCase } from '../../../application/transactions/use-cases/BulkActOnTransactionsUseCase.js';
import { BulkMapTransactionsUseCase } from '../../../application/transactions/use-cases/BulkMapTransactionsUseCase.js';
import { GetTransactionUseCase } from '../../../application/transactions/use-cases/GetTransactionUseCase.js';
import { ListTransactionsUseCase } from '../../../application/transactions/use-cases/ListTransactionsUseCase.js';
import { MapTransactionUseCase } from '../../../application/transactions/use-cases/MapTransactionUseCase.js';
import { MarkAsTransferUseCase } from '../../../application/transactions/use-cases/MarkAsTransferUseCase.js';
import { PatchTransactionUseCase } from '../../../application/transactions/use-cases/PatchTransactionUseCase.js';
import { UnmarkTransferUseCase } from '../../../application/transactions/use-cases/UnmarkTransferUseCase.js';
import { TransactionNotFoundError } from '../../../domain/transactions/errors.js';
import {
  bearerFor,
  createHttpTestApp,
  type HttpTestApp,
} from '../../../test/http/createHttpTestApp.js';

const ALICE = '01900000-0000-7000-8000-00000000000a' as UserId;
const ALICE_HOUSEHOLD = '01900000-0000-7000-8000-0000000000a1' as HouseholdId;
// Passes ParseUUIDPipe and @IsUUID() (any hex UUID) but is no id the core id types accept.
const NIL_ID = '00000000-0000-0000-0000-000000000000';
const V4_ID = '3b241101-e2bb-4255-8caf-4136c566a962';

describe('TransactionsController ids (HTTP)', () => {
  let app: HttpTestApp;
  let list: ReturnType<typeof mock<ListTransactionsUseCase>>;
  let get: ReturnType<typeof mock<GetTransactionUseCase>>;
  let bulkMap: ReturnType<typeof mock<BulkMapTransactionsUseCase>>;
  let unmark: ReturnType<typeof mock<UnmarkTransferUseCase>>;

  beforeEach(async () => {
    list = mock<ListTransactionsUseCase>();
    get = mock<GetTransactionUseCase>();
    bulkMap = mock<BulkMapTransactionsUseCase>();
    unmark = mock<UnmarkTransferUseCase>();
    get.execute.mockRejectedValue(new TransactionNotFoundError());
    unmark.execute.mockRejectedValue(new TransactionNotFoundError());
    app = await createHttpTestApp({
      controllers: [TransactionsController],
      providers: [
        { provide: ListTransactionsUseCase, useValue: list },
        { provide: GetTransactionUseCase, useValue: get },
        { provide: AddManualTransactionUseCase, useValue: mock<AddManualTransactionUseCase>() },
        { provide: MapTransactionUseCase, useValue: mock<MapTransactionUseCase>() },
        { provide: BulkMapTransactionsUseCase, useValue: bulkMap },
        { provide: BulkActOnTransactionsUseCase, useValue: mock<BulkActOnTransactionsUseCase>() },
        { provide: MarkAsTransferUseCase, useValue: mock<MarkAsTransferUseCase>() },
        { provide: UnmarkTransferUseCase, useValue: unmark },
        { provide: PatchTransactionUseCase, useValue: mock<PatchTransactionUseCase>() },
      ],
    });
  });

  afterEach(async () => {
    await app.close();
  });

  const headers = () => ({ authorization: bearerFor(ALICE, ALICE_HOUSEHOLD) });

  it.each([NIL_ID, V4_ID])('GET /transactions/%s answers 404 TRANSACTION_NOT_FOUND', async (id) => {
    const res = await app.inject({ method: 'GET', url: `/transactions/${id}`, headers: headers() });

    expect(res.statusCode).toBe(404);
  });

  it('DELETE /transactions/:id/transfer answers 404 for an id the core type rejects', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/transactions/${NIL_ID}/transfer`,
      headers: headers(),
    });

    expect(res.statusCode).toBe(404);
    expect(unmark.execute).not.toHaveBeenCalled();
  });

  it('GET /transactions with an unknown-shaped account id answers an empty page, not 500', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/transactions?accountId=${NIL_ID}`,
      headers: headers(),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ items: [], nextCursor: null, hasMore: false });
    expect(list.execute).not.toHaveBeenCalled();
  });

  it('GET /transactions with a month 13 date answers 400, not 500', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/transactions?from=2024-13-45',
      headers: headers(),
    });

    expect(res.statusCode).toBe(400);
  });

  it.each(['2024-02-31', '2024-13-45'])(
    'GET /transactions?from=%s answers 400, not 500',
    async (from) => {
      const res = await app.inject({
        method: 'GET',
        url: `/transactions?from=${from}`,
        headers: headers(),
      });

      expect(res.statusCode).toBe(400);
      expect(list.execute).not.toHaveBeenCalled();
    },
  );

  it('POST /transactions answers 404 bank_account_not_found for an account id the core type rejects', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/transactions',
      headers: headers(),
      payload: {
        accountId: NIL_ID,
        occurredOn: '2024-06-15',
        amountMinor: '100',
        currency: 'PLN',
        description: 'x',
      },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('bank_account_not_found');
  });

  it('POST /transactions/bulk answers 404 for a planned item id the core type rejects', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/transactions/bulk',
      headers: headers(),
      payload: { op: 'map', ids: [V4_ID], payload: { plannedItemId: NIL_ID } },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('planned_item_not_found');
    expect(bulkMap.execute).not.toHaveBeenCalled();
  });
});
