import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TransactionListItemDto } from '@power-budget/shared-app/contract';
import { categoriesApi, plansApi } from '../../../../infrastructure/index.js';
import { SerialQueue } from '../../../../infrastructure/transactions/SerialQueue.js';
import { loadAllPages } from '../../../../infrastructure/transactions/TransactionPaging.js';
import {
  categoryNameByItem,
  loadPlannedItemOptions,
} from '../../../../infrastructure/transactions/PlannedItemCategories.js';
import {
  filterCounts,
  groupByDay,
  monthSummaryOf,
  toListRows,
  visibleRows,
  waitingToSort,
} from '../../../../infrastructure/transactions/TransactionListModel.js';
import type {
  DayGroup,
  ListFilter,
  MonthSummary,
  TransactionListRow,
} from '../../../../infrastructure/transactions/TransactionListModel.js';
import { transactionsGateway } from './transactionsGateway.js';
import type { TransactionListStatus } from './TransactionListView.js';

export type ListFailure = 'sort' | 'more';

export interface TransactionListState {
  readonly status: TransactionListStatus;
  readonly month: MonthSummary | undefined;
  readonly waiting: ReturnType<typeof waitingToSort>;
  readonly filter: ListFilter;
  readonly counts: Record<ListFilter, number>;
  readonly groups: DayGroup[];
  readonly appliedIds: ReadonlySet<string>;
  readonly refreshing: boolean;
  readonly hasMore: boolean;
  readonly loadingMore: boolean;
  /** A failed action; the container shows it as a toast. */
  readonly failure: ListFailure | null;
  /** The last reload failed: the rows shown may be stale. */
  readonly reloadFailed: boolean;
  readonly setFilter: (filter: ListFilter) => void;
  readonly refresh: () => void;
  /** Reloads without the skeleton or the spinner, e.g. when the screen gets focus again. */
  readonly reload: () => void;
  readonly retry: () => void;
  readonly loadMore: () => void;
  readonly confirm: (id: string) => void;
  readonly undo: (id: string) => void;
  readonly dismissFailure: () => void;
}

/** Loads the list, the month rod and the suggestion names; owns confirm and undo of a suggestion. */
export function useTransactionList(): TransactionListState {
  const [items, setItems] = useState<TransactionListItemDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<TransactionListStatus>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter, setFilter] = useState<ListFilter>('all');
  const [applied, setApplied] = useState<ReadonlySet<string>>(new Set());
  const [failure, setFailure] = useState<ListFailure | null>(null);
  const [month, setMonth] = useState<MonthSummary | undefined>(undefined);
  const [categoryOfItem, setCategoryOfItem] = useState<ReadonlyMap<string, string>>(new Map());
  const moreInFlight = useRef(false);
  const mappingQueue = useRef(new SerialQueue());
  const [reloadFailed, setReloadFailed] = useState(false);
  // Reloads can overlap (focus, pull to refresh, retry); only the newest answer may be applied.
  const listRequest = useRef(0);
  const monthRequest = useRef(0);

  const loadFirstPage = useCallback(async (keepOnError: boolean): Promise<void> => {
    listRequest.current += 1;
    const request = listRequest.current;
    try {
      const loaded = await loadAllPages(fetchPage);
      if (request !== listRequest.current) {
        return;
      }
      setItems(loaded.items);
      setNextCursor(loaded.nextCursor);
      setApplied(new Set());
      setReloadFailed(false);
      setStatus('ready');
    } catch {
      if (request !== listRequest.current) {
        return;
      }
      // A reload keeps the rows on screen but says they may be stale.
      setReloadFailed(keepOnError);
      setStatus((previous) => (keepOnError && previous === 'ready' ? previous : 'error'));
    } finally {
      if (request === listRequest.current) {
        setRefreshing(false);
      }
    }
  }, []);

  const loadMonth = useCallback(async (): Promise<void> => {
    monthRequest.current += 1;
    const request = monthRequest.current;
    try {
      const [plan] = await plansApi.list('active');
      const summary =
        plan === undefined ? undefined : monthSummaryOf(await plansApi.dashboard(plan.id));
      if (request === monthRequest.current) {
        setMonth(summary);
      }
    } catch {
      // Without a plan the rod stays out; the list still works.
      if (request === monthRequest.current) {
        setMonth(undefined);
      }
    }
  }, []);

  useEffect(() => {
    void loadFirstPage(false);
    void loadMonth();
    void loadPlannedItemOptions(plansApi, categoriesApi).then(
      (options) => setCategoryOfItem(categoryNameByItem(options)),
      () => undefined,
    );
  }, [loadFirstPage, loadMonth]);

  const rows = useMemo(() => toListRows(items, categoryOfItem), [items, categoryOfItem]);
  const groups = useMemo(
    () => groupByDay(visibleRows(rows, filter, applied)),
    [rows, filter, applied],
  );
  const counts = useMemo(() => filterCounts(rows, applied), [rows, applied]);
  const waiting = useMemo(
    () => (month === undefined ? undefined : waitingToSort(rows, applied, month.left.currency)),
    [rows, applied, month],
  );

  const loadMore = useCallback((): void => {
    if (nextCursor === null || moreInFlight.current) {
      return;
    }
    moreInFlight.current = true;
    setLoadingMore(true);
    void transactionsGateway
      .page(nextCursor)
      .then((page) => {
        setItems((previous) => [...previous, ...page.items]);
        setNextCursor(page.nextCursor);
      })
      .catch(() => setFailure('more'))
      .finally(() => {
        moreInFlight.current = false;
        setLoadingMore(false);
      });
  }, [nextCursor]);

  const setMapping = useCallback(
    async (row: TransactionListRow, plannedItemId: string | null): Promise<boolean> => {
      try {
        await mappingQueue.current.run(() =>
          transactionsGateway.setMapping(row.data.id, plannedItemId),
        );
        void loadMonth();

        return true;
      } catch {
        setFailure('sort');

        return false;
      }
    },
    [loadMonth],
  );

  const confirm = useCallback(
    (id: string): void => {
      const row = rows.find((candidate) => candidate.data.id === id);
      if (row === undefined || row.suggestedPlannedItemId === null) {
        return;
      }
      setApplied((previous) => new Set(previous).add(id));
      void setMapping(row, row.suggestedPlannedItemId).then((saved) => {
        if (!saved) {
          setApplied((previous) => withoutId(previous, id));
        }
      });
    },
    [rows, setMapping],
  );

  const undo = useCallback(
    (id: string): void => {
      const row = rows.find((candidate) => candidate.data.id === id);
      if (row === undefined) {
        return;
      }
      setApplied((previous) => withoutId(previous, id));
      void setMapping(row, null).then((saved) => {
        if (!saved) {
          setApplied((previous) => new Set(previous).add(id));
        }
      });
    },
    [rows, setMapping],
  );

  const refresh = useCallback((): void => {
    setRefreshing(true);
    void loadFirstPage(true);
    void loadMonth();
  }, [loadFirstPage, loadMonth]);

  const reload = useCallback((): void => {
    void loadFirstPage(true);
    void loadMonth();
  }, [loadFirstPage, loadMonth]);

  const retry = useCallback((): void => {
    if (reloadFailed) {
      void loadFirstPage(true);

      return;
    }
    setStatus('loading');
    void loadFirstPage(false);
  }, [loadFirstPage, reloadFailed]);

  const dismissFailure = useCallback((): void => setFailure(null), []);

  return {
    status,
    month,
    waiting,
    filter,
    counts,
    groups,
    appliedIds: applied,
    refreshing,
    hasMore: nextCursor !== null,
    loadingMore,
    failure,
    reloadFailed,
    setFilter,
    refresh,
    reload,
    retry,
    loadMore,
    confirm,
    undo,
    dismissFailure,
  };
}

function withoutId(ids: ReadonlySet<string>, id: string): ReadonlySet<string> {
  return new Set([...ids].filter((candidate) => candidate !== id));
}

function fetchPage(cursor?: string): ReturnType<typeof transactionsGateway.page> {
  return transactionsGateway.page(cursor);
}
