import type { HttpClient } from '@power-budget/shared-app';

export type BulkAction = 'transfer' | 'ignore';

const CONCURRENCY = 10;

/**
 * Bulk actions on transactions, shaped to the current API.
 *
 * `POST /transactions/bulk` takes `{ ids, op, payload }` but only applies `op: 'map'`;
 * it answers 204 for `transfer` and `ignore` without changing anything (audit H25).
 * Until the backend implements them, those two go through the per-transaction
 * endpoints, which do work.
 */
export class BulkTransactionActions {
  constructor(private readonly http: HttpClient) {}

  async map(ids: ReadonlyArray<string>, plannedItemId: string): Promise<void> {
    await this.http.post('/transactions/bulk', {
      ids: Array.from(ids),
      op: 'map',
      payload: { plannedItemId },
    });
  }

  async apply(action: BulkAction, ids: ReadonlyArray<string>): Promise<void> {
    for (let start = 0; start < ids.length; start += CONCURRENCY) {
      const batch = ids.slice(start, start + CONCURRENCY);
      await Promise.all(batch.map(this.requestFor(action)));
    }
  }

  private requestFor(action: BulkAction): (id: string) => Promise<unknown> {
    switch (action) {
      case 'transfer':
        return this.markTransfer.bind(this);
      case 'ignore':
        return this.ignore.bind(this);
    }
  }

  private markTransfer(id: string): Promise<unknown> {
    return this.http.post(`/transactions/${id}/transfer`, {});
  }

  private ignore(id: string): Promise<unknown> {
    return this.http.patch(`/transactions/${id}`, { ignored: true });
  }
}
