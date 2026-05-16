import React, { useEffect, useState, useCallback, useRef } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import { useLocalObservable } from 'mobx-react-lite';
import { useTheme } from '../../components/ThemeContext.js';
import { SkeletonList } from '../../components/shared/SkeletonList.js';
import { EmptyState } from '../../components/shared/EmptyState.js';
import { ErrorBanner } from '../../components/shared/ErrorBanner.js';
import {
  TransactionFilterBar,
  type TransactionFilters,
} from '../../components/TransactionFilterBar.js';
import { TransactionRow } from '../../components/TransactionRow.js';
import { BulkActionBar } from '../../components/BulkActionBar.js';
import { MappingModal } from '../../components/MappingModal.js';
import { apiClient } from '../../../AppProviders.js';
import type { Transaction } from '../../components/TransactionDetailModal.js';

interface Category {
  id: string;
  name: string;
}

interface TransactionPage {
  items: Transaction[];
  nextCursor: string | null;
}

const LIMIT = 50;

export const TransactionListScreen = observer(function TransactionListScreen(): React.JSX.Element {
  const theme = useTheme();
  const intl = useIntl();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const selection = useLocalObservable(() => ({
    ids: new Set<string>(),
    toggle(id: string): void {
      if (this.ids.has(id)) {
        this.ids.delete(id);
      } else {
        this.ids.add(id);
      }
    },
    selectAll(txIds: string[]): void {
      txIds.forEach((id) => this.ids.add(id));
    },
    clear(): void {
      this.ids.clear();
    },
    get size(): number {
      return this.ids.size;
    },
    get selectedIds(): string[] {
      return Array.from(this.ids);
    },
  }));

  const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);
  const selectAllRef = useRef<HTMLInputElement>(null);

  const filters: TransactionFilters = {
    from: searchParams.get('from') ?? '',
    to: searchParams.get('to') ?? '',
    category: searchParams.get('category') ?? '',
    status: (searchParams.get('status') ?? '') as TransactionFilters['status'],
    currency: searchParams.get('currency') ?? '',
    source: (searchParams.get('source') ?? '') as TransactionFilters['source'],
    q: searchParams.get('q') ?? '',
  };

  const filtersKey = [
    filters.from,
    filters.to,
    filters.category,
    filters.status,
    filters.currency,
    filters.source,
    filters.q,
  ].join('|');

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const buildQuery = useCallback((f: TransactionFilters, cursor?: string): string => {
    const params = new URLSearchParams();
    if (f.from) params.set('from', f.from);
    if (f.to) params.set('to', f.to);
    if (f.category) params.set('categoryId', f.category);
    if (f.status) params.set('status', f.status);
    if (f.currency) params.set('currency', f.currency);
    if (f.source) params.set('source', f.source);
    if (f.q) params.set('q', f.q);
    params.set('limit', String(LIMIT));
    if (cursor) params.set('cursor', cursor);
    return params.toString();
  }, []);

  // Load categories once
  useEffect(() => {
    void apiClient.get<Category[]>('/categories').then((res) => {
      setCategories(res.data);
    });
  }, []);

  // Reset and load first page when filters change
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setTransactions([]);
    setNextCursor(null);

    void (async () => {
      try {
        const res = await apiClient.get<TransactionPage>(
          `/transactions?${buildQuery(filtersRef.current)}`,
        );
        if (cancelled) return;
        const page = res.data;
        setTransactions(page.items ?? []);
        setNextCursor(page.nextCursor ?? null);
      } catch {
        if (!cancelled) {
          setError(
            intl.formatMessage({
              id: 'screen.transactionList.error',
              defaultMessage: 'Failed to load transactions',
            }),
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // filtersKey is a stable primitive that changes only when filters change
  }, [filtersKey, buildQuery, intl]);

  const loadMore = useCallback(async (): Promise<void> => {
    if (loadingMore || !nextCursor) return;
    setLoadingMore(true);
    try {
      const res = await apiClient.get<TransactionPage>(
        `/transactions?${buildQuery(filtersRef.current, nextCursor)}`,
      );
      const page = res.data;
      setTransactions((prev) => [...prev, ...(page.items ?? [])]);
      setNextCursor(page.nextCursor ?? null);
    } catch {
      // silently fail so user can try scrolling again
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, nextCursor, buildQuery]);

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !nextCursor || loadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void loadMore();
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(sentinel);
    return () => {
      observer.disconnect();
    };
  }, [nextCursor, loadingMore, loadMore]);

  const handleFiltersChange = (newFilters: TransactionFilters): void => {
    const params: Record<string, string> = {};
    if (newFilters.from) params['from'] = newFilters.from;
    if (newFilters.to) params['to'] = newFilters.to;
    if (newFilters.category) params['category'] = newFilters.category;
    if (newFilters.status) params['status'] = newFilters.status;
    if (newFilters.currency) params['currency'] = newFilters.currency;
    if (newFilters.source) params['source'] = newFilters.source;
    if (newFilters.q) params['q'] = newFilters.q;
    setSearchParams(params);
  };

  const handleRowClick = (id: string): void => {
    void navigate(`/transactions/${id}`);
  };

  const allSelected =
    transactions.length > 0 && transactions.every((tx) => selection.ids.has(tx.id));
  const someSelected = transactions.some((tx) => selection.ids.has(tx.id));

  // Sync indeterminate state on the select-all checkbox
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected && !allSelected;
    }
  }, [someSelected, allSelected]);

  const handleSelectAll = (): void => {
    if (allSelected) {
      selection.clear();
    } else {
      selection.selectAll(transactions.map((tx) => tx.id));
    }
  };

  return (
    <div
      style={{
        padding: theme.space['2xl'],
        maxWidth: 1000,
        margin: '0 auto',
        color: theme.color.text.primary,
      }}
    >
      <h1
        style={{
          margin: `0 0 ${theme.space.xl}px 0`,
          fontSize: theme.fontSize['2xl'],
          fontWeight: theme.fontWeight.semibold,
        }}
      >
        <FormattedMessage id="screen.transactionList.title" defaultMessage="Transactions" />
      </h1>

      <TransactionFilterBar
        filters={filters}
        onChange={handleFiltersChange}
        categories={categories}
      />

      {loading && <SkeletonList rows={8} rowHeight={56} />}

      {error !== null && !loading && (
        <ErrorBanner
          message={error}
          onRetry={() => {
            setError(null);
            setLoading(true);
            void (async () => {
              try {
                const res = await apiClient.get<TransactionPage>(
                  `/transactions?${buildQuery(filtersRef.current)}`,
                );
                const page = res.data;
                setTransactions(page.items ?? []);
                setNextCursor(page.nextCursor ?? null);
              } catch {
                setError(
                  intl.formatMessage({
                    id: 'screen.transactionList.error',
                    defaultMessage: 'Failed to load transactions',
                  }),
                );
              } finally {
                setLoading(false);
              }
            })();
          }}
        />
      )}

      {!loading && error === null && transactions.length === 0 && (
        <EmptyState
          icon="💸"
          title={
            <FormattedMessage
              id="component.shared.empty.noTransactions"
              defaultMessage="No transactions yet"
            />
          }
        />
      )}

      {transactions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space.sm }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: theme.space.sm,
              paddingLeft: theme.space.sm,
              paddingBottom: theme.space.xs,
            }}
          >
            <input
              ref={selectAllRef}
              type="checkbox"
              aria-label={intl.formatMessage({
                id: 'screen.transactionList.selectAll',
                defaultMessage: 'Select all',
              })}
              checked={allSelected}
              onChange={handleSelectAll}
            />
            <span style={{ color: theme.color.text.secondary, fontSize: theme.fontSize.sm }}>
              <FormattedMessage id="screen.transactionList.selectAll" defaultMessage="Select all" />
            </span>
          </div>

          {transactions.map((tx) => (
            <div key={tx.id} style={{ display: 'flex', alignItems: 'center', gap: theme.space.sm }}>
              <input
                type="checkbox"
                aria-label={intl.formatMessage(
                  {
                    id: 'screen.transactionList.selectRow',
                    defaultMessage: 'Select transaction {id}',
                  },
                  { id: tx.id },
                )}
                checked={selection.ids.has(tx.id)}
                onChange={() => {
                  selection.toggle(tx.id);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <TransactionRow transaction={tx} onClick={handleRowClick} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sentinel div triggers IntersectionObserver for infinite scroll */}
      <div ref={sentinelRef} style={{ height: 1 }} />

      {loadingMore && (
        <p
          style={{
            color: theme.color.text.secondary,
            textAlign: 'center',
            padding: theme.space.lg,
          }}
        >
          <FormattedMessage id="screen.transactionList.loadMore" defaultMessage="Load more" />
        </p>
      )}

      <BulkActionBar
        selectedIds={selection.selectedIds}
        onMapAll={() => {
          setIsMappingModalOpen(true);
        }}
        onClear={() => {
          selection.clear();
        }}
        onActionComplete={() => {
          selection.clear();
        }}
      />

      <MappingModal
        isOpen={isMappingModalOpen}
        selectedIds={selection.selectedIds}
        onClose={() => {
          setIsMappingModalOpen(false);
        }}
        onSuccess={() => {
          selection.clear();
          setIsMappingModalOpen(false);
        }}
      />
    </div>
  );
});
