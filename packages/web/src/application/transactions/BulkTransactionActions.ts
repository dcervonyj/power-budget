import type { HttpClient } from '@power-budget/shared-app';
import type { BulkMapDto } from '@power-budget/shared-app/contract';

export type BulkAction = 'transfer' | 'ignore';

/** `POST /transactions/bulk` takes at most this many ids. */
const MAX_IDS = 500;

/**
 * Bulk actions on transactions through `POST /transactions/bulk`. The API applies each
 * request all or nothing: one id that is not the caller's own is a 404 (nothing written),
 * and `transfer` with a mapped transaction is a 409 `already_mapped`.
 */
export class BulkTransactionActions {
  constructor(private readonly http: HttpClient) {}

  async map(ids: ReadonlyArray<string>, plannedItemId: string): Promise<void> {
    // BulkMapDto types `payload` as an empty object (spec gap), so the body is not
    // annotated with it; the backend reads `payload.plannedItemId`.
    await this.http.post('/transactions/bulk', {
      ids: Array.from(ids),
      op: 'map',
      payload: { plannedItemId },
    });
  }

  /** More than MAX_IDS ids go in several requests; each one is all or nothing. */
  async apply(action: BulkAction, ids: ReadonlyArray<string>): Promise<void> {
    for (let start = 0; start < ids.length; start += MAX_IDS) {
      const body: BulkMapDto = { ids: ids.slice(start, start + MAX_IDS), op: action };
      await this.http.post('/transactions/bulk', body);
    }
  }
}
