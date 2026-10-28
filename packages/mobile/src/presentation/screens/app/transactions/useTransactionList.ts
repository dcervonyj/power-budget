import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TransactionListItemDto } from '@power-budget/shared-app/contract';
import { categoriesApi, plansApi } from '../../../../infrastructure/index.js';
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
import { transactionsGateway, writeQueue } from './transactionsGateway.js';
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
  /** The month summary or the category names could not be loaded. */
  readonly monthFailed: boolean;
  readonly categoriesFailed: boolean;
  retrySupport(): void;
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
  const [monthFailed, setMonthFailed] = useState(false);
  const [categoriesFailed, setCategoriesFailed] = useState(false);
  const [categoryOfItem, setCategoryOfItem] = useState<ReadonlyMap<string, string>>(new Map());
  const moreInFlight = useRef(false);
  // Rows the user changed: their state is laid over every server load until that load is newer
  // than the change, so a reload cannot show a confirmed row as unsorted or the other way round.
  const [undone, setUndone] = useState<ReadonlySet<string>>(new Set());
  // The row as the user confirmed it: shown (with Undo) until the write settles and a later load.
  const [confirmed, setConfirmed] = useState<ReadonlyMap<string, TransactionListRow>>(new Map());
  const inFlight = useRef(new Map<string, number>());
  const changedAt = useRef(new Map<string, number>());
  const clock = useRef(0);
  const [reloadFailed, setReloadFailed] = useState(false);
  // Reloads can overlap (focus, pull to refresh, retry); only the newest answer may be applied.
  const listRequest = useRef(0);
  const categoriesRequest = useRef(0);
  const monthRequest = useRef(0);

  const loadFirstPage = useCallback(async (keepOnError: boolean): Promise<void> => {
    listRequest.current += 1;
    const request = listRequest.current;
    const startedAt = clock.current;
    try {
      const loaded = await loadAllPages(fetchPage);
      if (request !== listRequest.current) {
        return;
      }
      setItems(loaded.items);
      setNextCursor(loaded.nextCursor);
      const keep = (id: string): boolean =>
        isLaidOver(id, startedAt, inFlight.current, changedAt.current);
      setApplied((previous) => new Set([...previous].filter(keep)));
      setUndone((previous) => new Set([...previous].filter(keep)));
      setConfirmed((previous) => new Map([...previous].filter(([id]) => keep(id))));
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
        setMonthFailed(false);
      }
    } catch {
      // No rod, but the list still works; the failure is shown so it is not read as "no plan".
      if (request === monthRequest.current) {
        setMonth(undefined);
        setMonthFailed(true);
      }
    }
  }, []);

  const loadCategories = useCallback(async (): Promise<void> => {
    categoriesRequest.current += 1;
    const request = categoriesRequest.current;
    try {
      const options = await loadPlannedItemOptions(plansApi, categoriesApi);
      // Retries can overlap; only the newest answer may set the names or the error.
      if (request === categoriesRequest.current) {
        setCategoryOfItem(categoryNameByItem(options));
        setCategoriesFailed(false);
      }
    } catch {
      if (request === categoriesRequest.current) {
        setCategoriesFailed(true);
      }
    }
  }, []);

  useEffect(() => {
    void loadFirstPage(false);
    void loadMonth();
    void loadCategories();
  }, [loadFirstPage, loadMonth, loadCategories]);

  const rows = useMemo(
    () => toListRows(items, categoryOfItem).map((row) => shownRow(row, undone, confirmed)),
    [items, categoryOfItem, undone, confirmed],
  );
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
    const generation = listRequest.current;
    void transactionsGateway
      .page(nextCursor)
      .then((page) => {
        // A reload in the meantime replaced the list and the cursor: this page belongs to the old one.
        if (generation !== listRequest.current) {
          return;
        }
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
      const id = row.data.id;
      inFlight.current.set(id, (inFlight.current.get(id) ?? 0) + 1);
      clock.current += 1;
      changedAt.current.set(id, clock.current);
      try {
        await writeQueue.run(() => transactionsGateway.setMapping(id, plannedItemId));
        void loadMonth();

        return true;
      } catch {
        setFailure('sort');

        return false;
      } finally {
        clock.current += 1;
        changedAt.current.set(id, clock.current);
        settle(inFlight.current, id);
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
      setUndone((previous) => withoutId(previous, id));
      setConfirmed((previous) => new Map(previous).set(id, row));
      void setMapping(row, row.suggestedPlannedItemId).then((saved) => {
        if (!saved) {
          setApplied((previous) => withoutId(previous, id));
          setConfirmed((previous) => withoutKey(previous, id));
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
      setUndone((previous) => new Set(previous).add(id));
      setConfirmed((previous) => withoutKey(previous, id));
      void setMapping(row, null).then((saved) => {
        if (!saved) {
          setApplied((previous) => new Set(previous).add(id));
          setUndone((previous) => withoutId(previous, id));
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

  const retrySupport = useCallback((): void => {
    void loadMonth();
    void loadCategories();
  }, [loadMonth, loadCategories]);

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
    monthFailed,
    categoriesFailed,
    retrySupport,
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

/** True while the user's change of this row is newer than, or still racing with, a server load. */
function isLaidOver(
  id: string,
  loadStartedAt: number,
  inFlight: ReadonlyMap<string, number>,
  changedAt: ReadonlyMap<string, number>,
): boolean {
  return inFlight.has(id) || (changedAt.get(id) ?? 0) > loadStartedAt;
}

function settle(inFlight: Map<string, number>, id: string): void {
  const remaining = (inFlight.get(id) ?? 1) - 1;
  if (remaining <= 0) {
    inFlight.delete(id);

    return;
  }
  inFlight.set(id, remaining);
}

/** A row whose category was just cleared, shown as unsorted until the server agrees. */
function asUnsorted(row: TransactionListRow): TransactionListRow {
  if (row.kind !== 'sorted') {
    return row;
  }

  return {
    ...row,
    kind: 'toSort',
    data: { ...row.data, status: 'to-sort', categoryLabel: undefined },
  };
}

function withoutKey<V>(map: ReadonlyMap<string, V>, id: string): ReadonlyMap<string, V> {
  return new Map([...map].filter(([key]) => key !== id));
}

/** What the user did wins over what a load shows, until a load newer than the change replaces it. */
function shownRow(
  row: TransactionListRow,
  undone: ReadonlySet<string>,
  confirmed: ReadonlyMap<string, TransactionListRow>,
): TransactionListRow {
  const mine = confirmed.get(row.data.id);
  if (mine !== undefined) {
    return mine;
  }

  return undone.has(row.data.id) ? asUnsorted(row) : row;
}
