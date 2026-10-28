import {
  apiClient,
  categoriesApi,
  dashboardStore,
  planDashboardStore,
  referenceCatalogue,
} from '../../../composition.js';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useIntl } from 'react-intl';
import { readApiError } from '@power-budget/shared-app';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import { useLocalObservable } from 'mobx-react-lite';
import { Toast } from '../../components/shared/Toast.js';
import {
  toBooking,
  toCurrency,
  toMappingFilter,
  toSource,
  type TransactionFilters,
} from '../../components/TransactionFilterBar.js';
import { BulkActionBar } from '../../components/BulkActionBar.js';
import { Modal } from '../../components/Modal.js';
import { MappingModal } from '../../components/MappingModal.js';
import { ManualTransactionForm } from '../../components/ManualTransactionForm.js';
import { TransactionMapModal } from '../../components/TransactionMapModal.js';
import { TransactionDetailModal } from '../../components/TransactionDetailModal.js';
import { TransactionListView } from './TransactionListView.js';
import {
  loadPlannedItems,
  type PlannedItemLabel,
} from '../../../application/transactions/PlannedItemLabels.js';
import type { Transaction } from '../../../domain/transactions/Transaction.js';
import type { CategoryDto, TransactionPageDto } from '@power-budget/shared-app/contract';
import {
  groupByDay,
  monthLeft,
  sortingProgress,
} from '../../../application/transactions/TransactionListQueryView.js';
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

  const filters: TransactionFilters = {
    from: searchParams.get('from') ?? '',
    to: searchParams.get('to') ?? '',
    category: searchParams.get('category') ?? '',
    status: toMappingFilter(searchParams.get('status')),
    booking: toBooking(searchParams.get('booking')),
    currency: toCurrency(searchParams.get('currency')),
    source: toSource(searchParams.get('source')),
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
  /** Bumped on every first-page load: a "load more" page of older filters is dropped. */
  const listGeneration = useRef(0);

  // Load categories once
  useEffect(() => {
    // Without categories the category filter stays empty; the list still loads.
    void categoriesApi.list().then(setCategories, () => undefined);
  }, []);

  // Names for a row mapped in the map modal (active plans; the list itself names the rest).
  useEffect(() => {
    void loadPlannedItems(referenceCatalogue).then(
      (catalogue) => {
        setLabels(catalogue.labels);
      },
      () => undefined,
    );
  }, []);

  // The month rod under the title reads the plan dashboard; without a plan it stays out.
  useEffect(() => {
    void dashboardStore.open().catch(() => undefined);
  }, []);

  // Reset and load the first page when the filters change or a reload is asked for.
  useEffect(() => {
    let cancelled = false;
    listGeneration.current += 1;
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
        setTransactions(toTransactions(page));
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
    const generation = listGeneration.current;
    try {
      const res = await apiClient.get<TransactionPageDto>(
        `/transactions?${buildQuery(filtersRef.current, nextCursor)}`,
      );
      if (generation !== listGeneration.current) {
        return;
      }
      const page = res.data;
      setTransactions((prev) => [...prev, ...toTransactions(page)]);
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

  const handleSelectAll = (): void => {
    if (allSelected) {
      selection.clear();
    } else {
      selection.selectAll(transactions.map((tx) => tx.id));
    }
  };

  const handleConfirmSuggestion = (id: string): void => {
    const tx = transactions.find((row) => row.id === id);
    if (tx?.suggestedPlannedItemId == null) {
      return;
    }
    void confirmSuggestion(tx, tx.suggestedPlannedItemId);
  };

  const confirmSuggestion = async (tx: Transaction, plannedItemId: string): Promise<void> => {
    try {
      await apiClient.patch(`/transactions/${tx.id}/mapping`, { plannedItemId });
      setTransactions((prev) => replaceRow(prev, withMapping(tx, plannedItemId, labels)));
    } catch (err) {
      if (readApiError(err).status === 404) {
        dropGoneRow(tx.id);

        return;
      }
      setToast(
        intl.formatMessage({
          id: 'screen.transactionDetail.mappingError',
          defaultMessage: 'Failed to update mapping',
        }),
      );
    }
  };

  const suggestionLabelOf = (tx: Transaction): string | undefined => {
    const id = tx.suggestedPlannedItemId;
    if (id === null) {
      return undefined;
    }

    return labels.get(id)?.categoryName || undefined;
  };

  const dashboard = planDashboardStore.dashboard;
  const filtered = Object.values(filters).some((value) => value !== '');
  const status = loading ? 'loading' : error !== null ? 'error' : 'ready';

  return (
    <TransactionListView
      month={dashboard === null ? undefined : monthLeft(dashboard)}
      filters={filters}
      onFiltersChange={handleFiltersChange}
      categories={categories}
      status={status}
      onRetry={reload}
      groups={groupByDay(transactions)}
      sorting={filtered ? undefined : sortingProgress(transactions)}
      suggestionLabelOf={suggestionLabelOf}
      selectedIds={selection.ids}
      onToggleRow={(id) => {
        selection.toggle(id);
      }}
      onToggleAll={handleSelectAll}
      onAdd={() => {
        setIsAddOpen(true);
      }}
      onRowClick={handleRowClick}
      onRowMap={handleRowMap}
      onConfirmSuggestion={handleConfirmSuggestion}
      loadingMore={loadingMore}
      sentinelRef={sentinelRef}
    >
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
    </TransactionListView>
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
