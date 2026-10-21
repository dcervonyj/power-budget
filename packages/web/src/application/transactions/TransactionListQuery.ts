import type { Transaction } from '../../domain/transactions/Transaction.js';
import type { TransactionFilters } from '../../presentation/components/TransactionFilterBar.js';
import type { TransactionPageDto } from '@power-budget/shared-app/contract';
import { TransactionMapper } from '../../infrastructure/api/TransactionMapper.js';

const LIMIT = 50;

/**
 * `GET /transactions` filters from, to, q, `unmappedOnly` and booking `status` in SQL
 * under the keyset cursor (CLN-023); any other query parameter is a 400. Currency and
 * source have no API filter yet and are filtered on the page.
 */
export function buildQuery(f: TransactionFilters, cursor?: string): string {
  const params = new URLSearchParams();
  if (f.from) {
    params.set('from', f.from);
  }
  if (f.to) {
    params.set('to', f.to);
  }
  if (f.q) {
    params.set('q', f.q);
  }
  if (f.status === 'unmapped') {
    params.set('unmappedOnly', 'true');
  }
  if (f.booking) {
    params.set('status', f.booking);
  }
  params.set('limit', String(LIMIT));
  if (cursor) {
    params.set('cursor', cursor);
  }

  return params.toString();
}

function matchesSource(tx: Transaction, source: TransactionFilters['source']): boolean {
  switch (source) {
    case '':
      return true;
    case 'manual':
      return tx.source === 'manual';
    case 'gocardless':
    case 'wise':
      return tx.source === 'bank_sync';
  }
}

export function toTransactions(page: TransactionPageDto, f: TransactionFilters): Transaction[] {
  return page.items
    .map((dto) => TransactionMapper.fromListItem(dto))
    .filter(
      (tx) => (!f.currency || tx.amount.currency === f.currency) && matchesSource(tx, f.source),
    );
}
