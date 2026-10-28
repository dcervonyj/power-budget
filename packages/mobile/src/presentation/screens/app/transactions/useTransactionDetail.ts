import { NO_LABEL } from '../../../../domain/display.js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { categoriesApi, plansApi } from '../../../../infrastructure/index.js';
import {
  findCategoryName,
  loadPlannedItemOptions,
} from '../../../../infrastructure/transactions/PlannedItemCategories.js';
import type { PlannedItemOption } from '../../../../infrastructure/transactions/PlannedItemCategories.js';
import { TransactionView } from '../../../../infrastructure/transactions/TransactionView.js';
import { transactionsGateway, writeQueue } from './transactionsGateway.js';
import type { TransactionDetailStatus } from './TransactionDetailView.js';

export type OptionsStatus = 'loading' | 'ready' | 'error';

export interface TransactionDetailState {
  readonly status: TransactionDetailStatus;
  readonly transaction: TransactionView | undefined;
  readonly categoryName: string | undefined;
  readonly options: readonly PlannedItemOption[];
  readonly optionsStatus: OptionsStatus;
  readonly pickerOpen: boolean;
  readonly notes: string;
  readonly saving: boolean;
  /** A failed action; the container shows it as a toast. */
  readonly failure: 'save' | 'mapping' | null;
  readonly retry: () => void;
  readonly retryOptions: () => void;
  /** The category of the mapped item could not be looked up. */
  readonly categoryFailed: boolean;
  /** The transfer switch shows the user's intent, but the server state could not be confirmed. */
  readonly transferUnresolved: boolean;
  readonly retryTransfer: () => void;
  readonly retryCategory: () => void;
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
  const [optionsStatus, setOptionsStatus] = useState<OptionsStatus>('loading');
  const [resolved, setResolved] = useState<{ id: string; name: string } | undefined>(undefined);
  const [categoryFailed, setCategoryFailed] = useState(false);
  const [transferUnresolved, setTransferUnresolved] = useState(false);
  const transferEdit = useRef(0);
  const categoryRequest = useRef(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<'save' | 'mapping' | null>(null);

  const load = useCallback(async (): Promise<void> => {
    try {
      // Writes still on their way (a Confirm on the list) land first, or this read shows the old mapping.
      await writeQueue.run(() => Promise.resolve());
      const edit = transferEdit.current;
      const view = TransactionView.fromDetail(await transactionsGateway.detail(transactionId));
      // A tap on the transfer switch while this loaded keeps its intent.
      setTransaction((previous) =>
        previous !== undefined && edit !== transferEdit.current
          ? { ...view, isTransfer: previous.isTransfer }
          : view,
      );
      setNotes(view.notes ?? NO_LABEL);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, [transactionId]);

  const loadOptions = useCallback(async (): Promise<void> => {
    setOptionsStatus('loading');
    try {
      setOptions(await loadPlannedItemOptions(plansApi, categoriesApi));
      setOptionsStatus('ready');
    } catch {
      setOptionsStatus('error');
    }
  }, []);

  useEffect(() => {
    void load();
    void loadOptions();
  }, [load, loadOptions]);

  const mappedId = transaction?.mapping?.plannedItemId;
  const inOptions = useMemo(
    () => options.find((option) => option.plannedItemId === mappedId),
    [options, mappedId],
  );

  // The picker lists active plans only; a mapping into an archived plan is resolved on its own.
  const lookUpCategory = useCallback(async (plannedItemId: string): Promise<void> => {
    categoryRequest.current += 1;
    const request = categoryRequest.current;
    try {
      const name = await findCategoryName(plansApi, categoriesApi, plannedItemId);
      // Lookups can overlap (a retry, a changed mapping); only the newest may answer.
      if (request === categoryRequest.current) {
        // A mapped item whose category is not in the result is as unresolved as a failed request.
        setResolved(name === undefined ? undefined : { id: plannedItemId, name });
        setCategoryFailed(name === undefined);
      }
    } catch {
      if (request === categoryRequest.current) {
        setCategoryFailed(true);
      }
    }
  }, []);

  useEffect(() => {
    if (mappedId === undefined || inOptions !== undefined || optionsStatus === 'loading') {
      categoryRequest.current += 1;
      setCategoryFailed(false);

      return;
    }
    void lookUpCategory(mappedId);
  }, [mappedId, inOptions, optionsStatus, lookUpCategory]);

  const changeMapping = useCallback(
    async (plannedItemId: string | null): Promise<void> => {
      try {
        await writeQueue.run(() => transactionsGateway.setMapping(transactionId, plannedItemId));
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

  // The transfer switch: what is shown is the user's latest intent. Every tap is a new edit; a write
  // or re-read result only counts while no newer edit has happened since it started.
  const confirmTransfer = useCallback(
    async (edit: number): Promise<void> => {
      try {
        await writeQueue.run(() => Promise.resolve());
        const view = TransactionView.fromDetail(await transactionsGateway.detail(transactionId));
        if (edit === transferEdit.current) {
          setTransaction((previous) =>
            previous === undefined ? previous : { ...previous, isTransfer: view.isTransfer },
          );
          setTransferUnresolved(false);
        }
      } catch {
        if (edit === transferEdit.current) {
          setTransferUnresolved(true);
        }
      }
    },
    [transactionId],
  );

  const toggleTransfer = useCallback(
    (isTransfer: boolean): void => {
      transferEdit.current += 1;
      const edit = transferEdit.current;
      setTransferUnresolved(false);
      setTransaction((previous) =>
        previous === undefined ? previous : { ...previous, isTransfer },
      );
      void writeQueue
        .run(() => transactionsGateway.setTransfer(transactionId, isTransfer))
        .catch(() => {
          if (edit === transferEdit.current) {
            setFailure('save');
            void confirmTransfer(edit);
          }
        });
    },
    [transactionId, confirmTransfer],
  );

  const retryTransfer = useCallback((): void => {
    void confirmTransfer(transferEdit.current);
  }, [confirmTransfer]);

  const saveNotes = useCallback((): void => {
    // The text stays as entered; only an all-blank note counts as no note.
    const saved = notes.trim() === '' ? null : notes;
    setSaving(true);
    void transactionsGateway
      .setNotes(transactionId, saved)
      .then(
        () =>
          setTransaction((previous) =>
            previous === undefined ? previous : { ...previous, notes: saved },
          ),
        () => setFailure('save'),
      )
      .finally(() => setSaving(false));
  }, [notes, transactionId]);

  const retry = useCallback((): void => {
    setStatus('loading');
    void load();
  }, [load]);

  const categoryName =
    inOptions?.categoryName ?? (resolved?.id === mappedId ? resolved?.name : undefined);

  return {
    status,
    transaction,
    categoryName,
    options,
    optionsStatus,
    pickerOpen,
    notes,
    saving,
    failure,
    retry,
    categoryFailed,
    transferUnresolved,
    retryTransfer,
    retryCategory: useCallback((): void => {
      if (mappedId !== undefined) {
        void lookUpCategory(mappedId);
      }
    }, [mappedId, lookUpCategory]),
    retryOptions: useCallback((): void => void loadOptions(), [loadOptions]),
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
