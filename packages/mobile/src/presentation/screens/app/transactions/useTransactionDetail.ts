import { useCallback, useEffect, useState } from 'react';
import { categoriesApi, plansApi } from '../../../../infrastructure/index.js';
import { loadPlannedItemOptions } from '../../../../infrastructure/transactions/PlannedItemCategories.js';
import type { PlannedItemOption } from '../../../../infrastructure/transactions/PlannedItemCategories.js';
import { TransactionView } from '../../../../infrastructure/transactions/TransactionView.js';
import { transactionsGateway } from './transactionsGateway.js';
import type { TransactionDetailStatus } from './TransactionDetailView.js';

export interface TransactionDetailState {
  readonly status: TransactionDetailStatus;
  readonly transaction: TransactionView | undefined;
  readonly categoryName: string | undefined;
  readonly options: readonly PlannedItemOption[];
  readonly pickerOpen: boolean;
  readonly notes: string;
  readonly saving: boolean;
  /** A failed action; the container shows it as a toast. */
  readonly failure: 'save' | 'mapping' | null;
  readonly retry: () => void;
  readonly openPicker: () => void;
  readonly closePicker: () => void;
  readonly pickItem: (plannedItemId: string) => void;
  readonly clearMapping: () => void;
  readonly toggleTransfer: (isTransfer: boolean) => void;
  readonly setNotes: (notes: string) => void;
  readonly saveNotes: () => void;
  readonly dismissFailure: () => void;
}

/** Loads one transaction and owns its edits: category, transfer flag and notes. */
export function useTransactionDetail(transactionId: string): TransactionDetailState {
  const [status, setStatus] = useState<TransactionDetailStatus>('loading');
  const [transaction, setTransaction] = useState<TransactionView | undefined>(undefined);
  const [options, setOptions] = useState<readonly PlannedItemOption[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<'save' | 'mapping' | null>(null);

  const load = useCallback(async (): Promise<void> => {
    try {
      const view = TransactionView.fromDetail(await transactionsGateway.detail(transactionId));
      setTransaction(view);
      setNotes(view.notes ?? '');
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [transactionId]);

  useEffect(() => {
    void load();
    void loadPlannedItemOptions(plansApi, categoriesApi).then(setOptions, () => undefined);
  }, [load]);

  const changeMapping = useCallback(
    async (plannedItemId: string | null): Promise<void> => {
      try {
        await transactionsGateway.setMapping(transactionId, plannedItemId);
        setTransaction((previous) =>
          previous === undefined
            ? previous
            : {
                ...previous,
                mapping: plannedItemId === null ? null : { plannedItemId },
              },
        );
      } catch {
        setFailure('mapping');
      }
    },
    [transactionId],
  );

  const pickItem = useCallback(
    (plannedItemId: string): void => {
      setPickerOpen(false);
      void changeMapping(plannedItemId);
    },
    [changeMapping],
  );

  const clearMapping = useCallback((): void => {
    void changeMapping(null);
  }, [changeMapping]);

  const toggleTransfer = useCallback(
    (isTransfer: boolean): void => {
      void transactionsGateway.setTransfer(transactionId, isTransfer).then(
        () =>
          setTransaction((previous) =>
            previous === undefined ? previous : { ...previous, isTransfer },
          ),
        () => setFailure('save'),
      );
    },
    [transactionId],
  );

  const saveNotes = useCallback((): void => {
    const trimmed = notes.trim();
    setSaving(true);
    void transactionsGateway
      .setNotes(transactionId, trimmed === '' ? null : trimmed)
      .then(
        () =>
          setTransaction((previous) =>
            previous === undefined
              ? previous
              : { ...previous, notes: trimmed === '' ? null : trimmed },
          ),
        () => setFailure('save'),
      )
      .finally(() => setSaving(false));
  }, [notes, transactionId]);

  const retry = useCallback((): void => {
    setStatus('loading');
    void load();
  }, [load]);

  const categoryName = options.find(
    (option) => option.plannedItemId === transaction?.mapping?.plannedItemId,
  )?.categoryName;

  return {
    status,
    transaction,
    categoryName,
    options,
    pickerOpen,
    notes,
    saving,
    failure,
    retry,
    openPicker: useCallback((): void => setPickerOpen(true), []),
    closePicker: useCallback((): void => setPickerOpen(false), []),
    pickItem,
    clearMapping,
    toggleTransfer,
    setNotes,
    saveNotes,
    dismissFailure: useCallback((): void => setFailure(null), []),
  };
}
