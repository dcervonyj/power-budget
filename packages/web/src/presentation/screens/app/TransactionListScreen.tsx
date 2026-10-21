import React, { useEffect, useState, useCallback, useRef } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import { useLocalObservable } from 'mobx-react-lite';
import { useTheme } from '../../components/ThemeContext.js';
import { SkeletonList } from '../../components/shared/SkeletonList.js';
import { EmptyState } from '../../components/shared/EmptyState.js';
import { ErrorBanner } from '../../components/shared/ErrorBanner.js';
import { Toast } from '../../components/shared/Toast.js';
import {
  TransactionFilterBar,
  toBooking,
  toMappingFilter,
  type TransactionFilters,
} from '../../components/TransactionFilterBar.js';
import { TransactionRow } from '../../components/TransactionRow.js';
import { BulkActionBar } from '../../components/BulkActionBar.js';
import { Button } from '../../components/Button.js';
import { Modal } from '../../components/Modal.js';
import { MappingModal } from '../../components/MappingModal.js';
import { ManualTransactionForm } from '../../components/ManualTransactionForm.js';
import { TransactionMapModal } from '../../components/TransactionMapModal.js';
import { TransactionDetailModal } from '../../components/TransactionDetailModal.js';
import { apiClient, categoriesApi, plansApi } from '../../../AppProviders.js';
import { fetchCategoryNames } from '../../../infrastructure/api/CategoryNames.js';
import {
  loadPlannedItems,
  type PlannedItemLabel,
} from '../../../application/transactions/PlannedItemLabels.js';
import { mappingViewOf } from '../../../application/transactions/MappingView.js';
import type { Transaction } from '../../../domain/transactions/Transaction.js';
import type { CategoryDto, TransactionPageDto } from '@power-budget/shared-app/contract';
import {
  buildQuery,
  toTransactions,
} from '../../../application/transactions/TransactionListQuery.js';

export interface TransactionListScreenProps {
  /** Opens the detail modal over the list (route /transactions/:id). */
  readonly detailId?: string;
}

export const TransactionListScreen = observer(function TransactionListScreen({
  detailId,
}: TransactionListScreenProps): React.JSX.Element {
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
    remove(id: string): void {
      this.ids.delete(id);
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
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [mapTarget, setMapTarget] = useState<Transaction | null>(null);
  const [labels, setLabels] = useState<ReadonlyMap<string, PlannedItemLabel>>(new Map());
  const [toast, setToast] = useState<string | null>(null);
  /** Bumped to reload the first page (after a bulk change, an added transaction). */
  const [reloadKey, setReloadKey] = useState(0);
  const selectAllRef = useRef<HTMLInputElement>(null);

  const filters: TransactionFilters = {
    from: searchParams.get('from') ?? '',
    to: searchParams.get('to') ?? '',
    category: searchParams.get('category') ?? '',
    status: toMappingFilter(searchParams.get('status')),
    booking: toBooking(searchParams.get('booking')),
    currency: searchParams.get('currency') ?? '',
    source: (searchParams.get('source') ?? '') as TransactionFilters['source'],
    q: searchParams.get('q') ?? '',
  };

  const filtersKey = [
    filters.from,
    filters.to,
    filters.category,
    filters.status,
    filters.booking,
    filters.currency,
    filters.source,
    filters.q,
  ].join('|');

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<CategoryDto[]>([]);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  // Load categories once
  useEffect(() => {
    // Without categories the category filter stays empty; the list still loads.
    void categoriesApi.list().then(setCategories, () => undefined);
  }, []);

  // Names for a row mapped in the map modal (active plans; the list itself names the rest).
  useEffect(() => {
    void loadPlannedItems(plansApi, () => fetchCategoryNames(apiClient)).then(
      (catalogue) => {
        setLabels(catalogue.labels);
      },
      () => undefined,
    );
  }, []);

  // Reset and load the first page when the filters change or a reload is asked for.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setTransactions([]);
    setNextCursor(null);

    void (async () => {
      try {
        const res = await apiClient.get<TransactionPageDto>(
          `/transactions?${buildQuery(filtersRef.current)}`,
        );
        if (cancelled) return;
        const page = res.data;
        setTransactions(toTransactions(page, filtersRef.current));
        setNextCursor(page.nextCursor);
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
  }, [filtersKey, reloadKey, intl]);

  const loadMore = useCallback(async (): Promise<void> => {
    if (loadingMore || !nextCursor) return;
    setLoadingMore(true);
    try {
      const res = await apiClient.get<TransactionPageDto>(
        `/transactions?${buildQuery(filtersRef.current, nextCursor)}`,
      );
      const page = res.data;
      setTransactions((prev) => [...prev, ...toTransactions(page, filtersRef.current)]);
      setNextCursor(page.nextCursor);
    } catch {
      // silently fail so user can try scrolling again
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, nextCursor]);

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

  const reload = (): void => {
    setReloadKey((key) => key + 1);
  };

  const handleFiltersChange = (newFilters: TransactionFilters): void => {
    const params: Record<string, string> = {};
    if (newFilters.from) params['from'] = newFilters.from;
    if (newFilters.to) params['to'] = newFilters.to;
    if (newFilters.category) params['category'] = newFilters.category;
    if (newFilters.status) params['status'] = newFilters.status;
    if (newFilters.booking) params['booking'] = newFilters.booking;
    if (newFilters.currency) params['currency'] = newFilters.currency;
    if (newFilters.source) params['source'] = newFilters.source;
    if (newFilters.q) params['q'] = newFilters.q;
    setSearchParams(params);
  };

  const handleRowClick = (id: string): void => {
    void navigate(`/transactions/${id}`);
  };

  const handleRowMap = (id: string): void => {
    setMapTarget(transactions.find((tx) => tx.id === id) ?? null);
  };

  const handleMapped = (plannedItemId: string | null): void => {
    if (mapTarget !== null) {
      const updated = withMapping(mapTarget, plannedItemId, labels);
      setTransactions((prev) => replaceRow(prev, updated));
    }
  };

  // A row that answers 404 is gone or a partner's (private): drop it and say so.
  const dropGoneRow = useCallback(
    (id: string): void => {
      setTransactions((prev) => prev.filter((tx) => tx.id !== id));
      selection.remove(id);
      setToast(
        intl.formatMessage({
          id: 'screen.transactionList.gone',
          defaultMessage: 'This transaction is no longer available.',
        }),
      );
    },
    [intl, selection],
  );

  const handleDetailGone = useCallback(
    (id: string): void => {
      dropGoneRow(id);
      void navigate('/transactions');
    },
    [dropGoneRow, navigate],
  );

  const handleDetailUpdated = (tx: Transaction): void => {
    setTransactions((prev) => replaceRow(prev, mergeDetail(prev, tx, labels)));
  };

  const handleBulkDone = (): void => {
    reload();
  };

  const handleBulkGone = (): void => {
    selection.clear();
    reload();
    setToast(
      intl.formatMessage({
        id: 'bulk.gone',
        defaultMessage:
          'Some selected transactions are no longer available. The list was refreshed.',
      }),
    );
  };

  const handleAdded = (): void => {
    setIsAddOpen(false);
    reload();
    setToast(
      intl.formatMessage({
        id: 'screen.transactionList.added',
        defaultMessage: 'Transaction added.',
      }),
    );
  };

  const dismissToast = useCallback((): void => {
    setToast(null);
  }, []);

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
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.space.md,
          margin: `0 0 ${String(theme.space.xl)}px 0`,
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: theme.fontSize['2xl'],
            fontWeight: theme.fontWeight.semibold,
          }}
        >
          <FormattedMessage id="screen.transactionList.title" defaultMessage="Transactions" />
        </h1>
        <Button
          variant="primary"
          onClick={() => {
            setIsAddOpen(true);
          }}
        >
          <FormattedMessage id="screen.transactionList.add" defaultMessage="Add transaction" />
        </Button>
      </div>

      <TransactionFilterBar
        filters={filters}
        onChange={handleFiltersChange}
        categories={categories}
      />

      {loading && <SkeletonList rows={8} rowHeight={56} />}

      {error !== null && !loading && <ErrorBanner message={error} onRetry={reload} />}

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
                <TransactionRow
                  transaction={tx}
                  mapping={mappingViewOf(tx)}
                  onClick={handleRowClick}
                  onMap={handleRowMap}
                />
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
        onActionComplete={handleBulkDone}
        onGone={handleBulkGone}
      />

      <MappingModal
        isOpen={isMappingModalOpen}
        selectedIds={selection.selectedIds}
        onClose={() => {
          setIsMappingModalOpen(false);
        }}
        onSuccess={() => {
          selection.clear();
          handleBulkDone();
          setIsMappingModalOpen(false);
        }}
      />

      {mapTarget !== null && (
        <TransactionMapModal
          transaction={mapTarget}
          currentPlannedItemId={mapTarget.mapping?.plannedItemId ?? null}
          isOpen
          onClose={() => {
            setMapTarget(null);
          }}
          onMapped={handleMapped}
          onGone={() => {
            dropGoneRow(mapTarget.id);
          }}
        />
      )}

      {detailId !== undefined && detailId !== '' && (
        <TransactionDetailModal
          transactionId={detailId}
          isOpen
          onClose={() => {
            void navigate('/transactions');
          }}
          onUpdated={handleDetailUpdated}
          onGone={handleDetailGone}
        />
      )}

      <Modal
        title={intl.formatMessage({
          id: 'component.manualTransactionForm.title',
          defaultMessage: 'Add Manual Transaction',
        })}
        isOpen={isAddOpen}
        onClose={() => {
          setIsAddOpen(false);
        }}
      >
        <ManualTransactionForm
          onSuccess={handleAdded}
          onCancel={() => {
            setIsAddOpen(false);
          }}
        />
      </Modal>

      <Toast message={toast} onDismiss={dismissToast} />
    </div>
  );
});

function replaceRow(rows: ReadonlyArray<Transaction>, updated: Transaction): Transaction[] {
  return rows.map((row) => (row.id === updated.id ? updated : row));
}

/** The row after the user mapped it in the map modal (a user mapping is `manual`). */
function withMapping(
  tx: Transaction,
  plannedItemId: string | null,
  labels: ReadonlyMap<string, PlannedItemLabel>,
): Transaction {
  if (plannedItemId === null) {
    return { ...tx, mapping: null };
  }
  const label = labels.get(plannedItemId);

  return {
    ...tx,
    mapping: {
      plannedItemId,
      planName: label?.planName ?? '',
      planArchived: false,
      categoryName: label?.categoryName ?? '',
      by: 'manual',
    },
  };
}

/**
 * The detail modal reads `GET /transactions/:id`, which names no plan or category: keep
 * the list's names when the planned item is unchanged.
 */
function mergeDetail(
  rows: ReadonlyArray<Transaction>,
  detail: Transaction,
  labels: ReadonlyMap<string, PlannedItemLabel>,
): Transaction {
  const current = rows.find((row) => row.id === detail.id);
  const plannedItemId = detail.mapping?.plannedItemId ?? null;
  if (current?.mapping !== null && current?.mapping.plannedItemId === plannedItemId) {
    return { ...detail, mapping: current.mapping };
  }

  return withMapping(detail, plannedItemId, labels);
}
