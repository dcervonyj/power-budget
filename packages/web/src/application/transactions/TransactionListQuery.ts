import type { Transaction } from '../../domain/transactions/Transaction.js';
import type { TransactionFilters } from '../../presentation/components/TransactionFilterBar.js';
import type {
  ListTransactionsQueryDto,
  TransactionPageDto,
} from '@power-budget/shared-app/contract';
import { TransactionMapper } from '../../infrastructure/api/TransactionMapper.js';

const LIMIT = 50;

/**
 * The `GET /transactions` query of the list filters, typed by the API contract. Every filter runs
 * in SQL under the keyset cursor (CLN-023, CLN-050), so each page is a full page of matches and
 * the list never pages through the history to fill the screen (audit PERF-07).
 */
export function toListQuery(f: TransactionFilters, cursor?: string): ListTransactionsQueryDto {
  return {
    ...(f.from ? { from: f.from } : {}),
    ...(f.to ? { to: f.to } : {}),
    ...(f.q ? { q: f.q } : {}),
    ...(f.status === 'unmapped' ? { unmappedOnly: true } : {}),
    ...(f.status === 'mapped' ? { mapped: true } : {}),
    ...(f.status === 'transfer' ? { transfer: true } : {}),
    ...(f.booking ? { status: f.booking } : {}),
    ...(f.category ? { categoryId: f.category } : {}),
    ...(f.currency ? { currency: f.currency } : {}),
    ...(f.source ? { source: f.source } : {}),
    limit: LIMIT,
    ...(cursor ? { cursor } : {}),
  };
}

export function buildQuery(f: TransactionFilters, cursor?: string): string {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(toListQuery(f, cursor))) {
    params.set(name, String(value));
  }

  return params.toString();
}

/** The page as the API filtered it; nothing is dropped on the client. */
export function toTransactions(page: TransactionPageDto): Transaction[] {
  return page.items.map((dto) => TransactionMapper.fromListItem(dto));
}
