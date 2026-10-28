import type { TransactionListItemDto, TransactionPageDto } from '@power-budget/shared-app/contract';

/** A safety stop: more pages than this stay behind "Load more". */
export const MAX_EAGER_PAGES = 40;

export interface LoadedTransactions {
  readonly items: TransactionListItemDto[];
  /** Cursor of the next unloaded page; null once everything is loaded. */
  readonly nextCursor: string | null;
}

/**
 * Loads pages until the end, so the counts and the "waiting to sort" total cover every
 * transaction and not only the first page.
 */
export async function loadAllPages(
  fetchPage: (cursor?: string) => Promise<TransactionPageDto>,
  maxPages: number = MAX_EAGER_PAGES,
): Promise<LoadedTransactions> {
  return collect(fetchPage, undefined, [], maxPages);
}

async function collect(
  fetchPage: (cursor?: string) => Promise<TransactionPageDto>,
  cursor: string | undefined,
  collected: TransactionListItemDto[],
  remaining: number,
): Promise<LoadedTransactions> {
  const page = await fetchPage(cursor);
  const items = [...collected, ...page.items];
  if (page.nextCursor === null || remaining <= 1) {
    return { items, nextCursor: page.nextCursor };
  }

  return collect(fetchPage, page.nextCursor, items, remaining - 1);
}
