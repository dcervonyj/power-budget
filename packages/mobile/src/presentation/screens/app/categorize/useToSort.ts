import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadAllPages } from '../../../../infrastructure/transactions/TransactionPaging.js';
import { toListRows } from '../../../../infrastructure/transactions/TransactionListModel.js';
import type { TransactionListRow } from '../../../../infrastructure/transactions/TransactionListModel.js';
import type { TransactionListItemDto } from '@power-budget/shared-app/contract';
import { transactionsGateway, writeQueue } from '../transactions/transactionsGateway.js';
import { loadChoices } from './categorizeData.js';
import type { CategoryChoice } from './categorizeModel.js';

export type LoadStatus = 'loading' | 'ready' | 'error';

export interface SheetState {
  /** Changes on every open, so a new pass starts from fresh state. */
  readonly key: number;
  readonly isOpen: boolean;
  readonly startIndex: number;
  /** The payments of the pass, fixed when the sheet opened. */
  readonly queue: readonly TransactionListRow[];
}

export interface ToSortState {
  readonly status: LoadStatus;
  readonly rows: readonly TransactionListRow[];
  readonly refreshing: boolean;
  /** The last reload failed: the rows shown may be stale. */
  readonly reloadFailed: boolean;
  readonly choices: readonly CategoryChoice[];
  readonly choicesStatus: LoadStatus;
  readonly sheet: SheetState | undefined;
  readonly busyIds: Set<string>;
  readonly retry: () => void;
  readonly refresh: () => void;
  /** Reloads without the skeleton, e.g. when the screen gets focus again. */
  readonly reload: () => void;
  readonly retryChoices: () => void;
  /** Opens the sheet on this payment, or on the first one without an id. */
  readonly open: (transactionId?: string) => void;
  readonly close: () => void;
  readonly write: (transactionId: string, plannedItemId: string | null) => Promise<void>;
  readonly onConfirmed: (transactionId: string) => void;
  readonly onUndone: (transactionId: string) => void;
}

/** Loads the unsorted payments and the categories to sort them into; owns the Categorize sheet. */
export function useToSort(): ToSortState {
  const [items, setItems] = useState<TransactionListItemDto[]>([]);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [reloadFailed, setReloadFailed] = useState(false);
  const [choices, setChoices] = useState<readonly CategoryChoice[]>([]);
  const [choicesStatus, setChoicesStatus] = useState<LoadStatus>('loading');
  const [sheet, setSheet] = useState<SheetState | undefined>(undefined);
  // Payments sorted in the sheet stay out of the list until a load newer than the change shows them.
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const busyIds = useRef(new Set<string>());
  const changes = useRef(0);
  const listRequest = useRef(0);
  const choicesRequest = useRef(0);
  const opened = useRef(0);

  const loadList = useCallback(async (keepOnError: boolean): Promise<void> => {
    listRequest.current += 1;
    const request = listRequest.current;
    const startedAt = changes.current;
    try {
      // Writes still on their way (also from the list or the detail) land first, or this read is stale.
      await writeQueue.run(() => Promise.resolve());
      const loaded = await loadAllPages(fetchPage);
      if (request !== listRequest.current) {
        return;
      }
      setItems(loaded.items);
      if (changes.current === startedAt) {
        setHidden(new Set());
      }
      setReloadFailed(false);
      setStatus('ready');
    } catch {
      if (request !== listRequest.current) {
        return;
      }
      setReloadFailed(keepOnError);
      setStatus((previous) => (keepOnError && previous === 'ready' ? previous : 'error'));
    } finally {
      if (request === listRequest.current) {
        setRefreshing(false);
      }
    }
  }, []);

  const loadCategories = useCallback(async (): Promise<void> => {
    choicesRequest.current += 1;
    const request = choicesRequest.current;
    setChoicesStatus('loading');
    try {
      const loaded = await loadChoices();
      if (request === choicesRequest.current) {
        setChoices(loaded);
        setChoicesStatus('ready');
      }
    } catch {
      if (request === choicesRequest.current) {
        setChoicesStatus('error');
      }
    }
  }, []);

  useEffect(() => {
    void loadList(false);
    void loadCategories();
  }, [loadList, loadCategories]);

  const nameOfItem = useMemo(
    () => new Map(choices.map((choice) => [choice.plannedItemId, choice.name])),
    [choices],
  );
  const rows = useMemo(
    () =>
      toListRows(items, nameOfItem).filter(
        (row) => row.kind === 'toSort' && !hidden.has(row.data.id),
      ),
    [items, nameOfItem, hidden],
  );

  const open = useCallback(
    (transactionId?: string): void => {
      const queue = rows.filter((row) => !busyIds.current.has(row.data.id));
      if (queue.length === 0) {
        return;
      }
      const found = queue.findIndex((row) => row.data.id === transactionId);
      opened.current += 1;
      setSheet({ key: opened.current, isOpen: true, startIndex: Math.max(found, 0), queue });
    },
    [rows],
  );

  const close = useCallback((): void => {
    setSheet((previous) => (previous === undefined ? previous : { ...previous, isOpen: false }));
    void loadList(true);
    void loadCategories();
  }, [loadList, loadCategories]);

  const onConfirmed = useCallback((transactionId: string): void => {
    changes.current += 1;
    setHidden((previous) => new Set(previous).add(transactionId));
  }, []);

  const onUndone = useCallback((transactionId: string): void => {
    changes.current += 1;
    setHidden((previous) => new Set([...previous].filter((id) => id !== transactionId)));
  }, []);

  const refresh = useCallback((): void => {
    setRefreshing(true);
    void loadList(true);
  }, [loadList]);

  const reload = useCallback((): void => {
    void loadList(true);
  }, [loadList]);

  const retry = useCallback((): void => {
    if (status === 'ready') {
      void loadList(true);

      return;
    }
    setStatus('loading');
    void loadList(false);
  }, [loadList, status]);

  return {
    status,
    rows,
    refreshing,
    reloadFailed,
    choices,
    choicesStatus,
    sheet,
    busyIds: busyIds.current,
    retry,
    refresh,
    reload,
    retryChoices: loadCategories,
    open,
    close,
    write: writeMapping,
    onConfirmed,
    onUndone,
  };
}

function fetchPage(cursor?: string): ReturnType<typeof transactionsGateway.page> {
  return transactionsGateway.page(cursor);
}

function writeMapping(transactionId: string, plannedItemId: string | null): Promise<void> {
  return writeQueue.run(() => transactionsGateway.setMapping(transactionId, plannedItemId));
}
