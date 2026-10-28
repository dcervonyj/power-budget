import { describe, expect, it } from 'vitest';
import { RecordingHttpClient } from '../../../../../../../shared-app/src/test/RecordingHttpClient.js';
import { AddExpenseApi } from '../AddExpenseApi.js';
import type { NewExpense } from '../AddExpenseApi.js';

const EXPENSE: NewExpense = {
  accountId: 'acc-1',
  occurredOn: '2026-10-22',
  spentMinor: 8400n,
  currency: 'PLN',
  description: 'Groceries',
  plannedItemId: 'item-groceries',
};

describe('AddExpenseApi', () => {
  it('posts the expense as a negative integer string, then maps it to the planned item', async () => {
    const http = new RecordingHttpClient();
    http.respondWith({ id: 'tx-1' }, {});
    const api = new AddExpenseApi(http);

    const created = await api.create(EXPENSE);
    await api.map(created.id, 'item-groceries');

    expect(created.id).toBe('tx-1');
    expect(http.calls).toEqual([
      {
        method: 'POST',
        url: '/transactions',
        body: {
          accountId: 'acc-1',
          occurredOn: '2026-10-22',
          amountMinor: '-8400',
          currency: 'PLN',
          description: 'Groceries',
        },
      },
      {
        method: 'PATCH',
        url: '/transactions/tx-1/mapping',
        body: { plannedItemId: 'item-groceries' },
      },
    ]);
  });

  it('leaves an unplanned expense unmapped', async () => {
    const http = new RecordingHttpClient();
    http.respondWith({ id: 'tx-2' });

    await new AddExpenseApi(http).create({ ...EXPENSE, plannedItemId: null });

    expect(http.calls.map((call) => call.method)).toEqual(['POST']);
  });

  it('keeps cents exact for amounts a float would blur', async () => {
    const http = new RecordingHttpClient();
    http.respondWith({ id: 'tx-3' });

    await new AddExpenseApi(http).create({
      ...EXPENSE,
      spentMinor: 9007199254740993n,
      plannedItemId: null,
    });

    expect(http.calls[0]?.body).toMatchObject({ amountMinor: '-9007199254740993' });
  });

  it('undoes by ignoring the transaction', async () => {
    const http = new RecordingHttpClient();
    http.respondWith({});

    await new AddExpenseApi(http).undo('tx-1');

    expect(http.calls).toEqual([
      { method: 'PATCH', url: '/transactions/tx-1', body: { ignored: true } },
    ]);
  });

  it('lists the accounts', async () => {
    const http = new RecordingHttpClient();
    http.respondWith([{ id: 'acc-1' }]);

    const accounts = await new AddExpenseApi(http).accounts();

    expect(accounts).toHaveLength(1);
    expect(http.calls).toEqual([{ method: 'GET', url: '/accounts' }]);
  });
});
