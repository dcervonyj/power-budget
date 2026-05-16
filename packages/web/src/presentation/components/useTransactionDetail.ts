import { useState, useEffect, useCallback } from 'react';
import { useIntl } from 'react-intl';
import { apiClient } from '../../AppProviders.js';

export interface TransactionMapping {
  plannedItemId: string;
  plannedItemName: string;
  categoryId: string;
  categoryName: string;
}

export interface Transaction {
  id: string;
  accountId: string;
  occurredOn: string;
  amountMinor: number;
  currency: string;
  description: string;
  merchant: string | null;
  source: 'gocardless' | 'wise' | 'manual';
  isTransfer: boolean;
  ignored: boolean;
  notes: string | null;
  mapping: TransactionMapping | null;
}

interface Plan {
  id: string;
  name: string;
  status: 'active' | 'draft' | 'archived';
}

interface PlannedItem {
  id: string;
  planId: string;
  categoryId: string;
  categoryName?: string;
  direction: 'income' | 'expense';
  amountMinor: number;
  currency: string;
}

export interface UseTransactionDetailReturn {
  transaction: Transaction | null;
  loading: boolean;
  fetchError: string | null;
  notes: string;
  setNotes: (notes: string) => void;
  savingNotes: boolean;
  notesError: string | null;
  mapping: TransactionMapping | null;
  mappingLoading: boolean;
  mappingError: string | null;
  isTransfer: boolean;
  ignored: boolean;
  togglingTransfer: boolean;
  togglingIgnored: boolean;
  plans: Plan[];
  planItems: Map<string, PlannedItem[]>;
  showPicker: boolean;
  setShowPicker: (show: boolean) => void;
  pickerLoading: boolean;
  pickerItems: Array<{ planId: string; planName: string; item: PlannedItem }>;
  currentMappedId: string | undefined;
  handleSaveNotes: () => Promise<void>;
  handleMap: (plannedItemId: string | null) => Promise<void>;
  handleShowPicker: () => void;
  handleToggleTransfer: () => Promise<void>;
  handleToggleIgnored: () => Promise<void>;
}

export function useTransactionDetail(
  transactionId: string,
  isOpen: boolean,
  onUpdated?: (tx: Transaction) => void,
): UseTransactionDetailReturn {
  const intl = useIntl();

  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);

  const [mapping, setMapping] = useState<TransactionMapping | null>(null);
  const [mappingLoading, setMappingLoading] = useState(false);
  const [mappingError, setMappingError] = useState<string | null>(null);

  const [isTransfer, setIsTransfer] = useState(false);
  const [ignored, setIgnored] = useState(false);
  const [togglingTransfer, setTogglingTransfer] = useState(false);
  const [togglingIgnored, setTogglingIgnored] = useState(false);

  const [plans, setPlans] = useState<Plan[]>([]);
  const [planItems, setPlanItems] = useState<Map<string, PlannedItem[]>>(new Map());
  const [showPicker, setShowPicker] = useState(false);
  const [pickerLoading, setPickerLoading] = useState(false);

  // Reset state when opening a new transaction
  useEffect(() => {
    if (!isOpen) return;
    setTransaction(null);
    setFetchError(null);
    setNotes('');
    setMapping(null);
    setIsTransfer(false);
    setIgnored(false);
    setShowPicker(false);
    setMappingError(null);
    setNotesError(null);
    setLoading(true);

    let cancelled = false;

    void (async () => {
      try {
        const res = await apiClient.get<Transaction>(`/transactions/${transactionId}`);
        if (cancelled) return;
        const tx = res.data;
        setTransaction(tx);
        setNotes(tx.notes ?? '');
        setMapping(tx.mapping);
        setIsTransfer(tx.isTransfer);
        setIgnored(tx.ignored);
      } catch {
        if (!cancelled) {
          setFetchError(
            intl.formatMessage({
              id: 'screen.transactionDetail.fetchError',
              defaultMessage: 'Failed to load transaction',
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
  }, [isOpen, transactionId, intl]);

  const loadPickerData = useCallback(async (): Promise<void> => {
    if (plans.length > 0) return;
    setPickerLoading(true);
    try {
      const res = await apiClient.get<Plan[]>('/plans');
      const allPlans = res.data;
      setPlans(allPlans);
      const activePlans = (allPlans as Plan[]).filter(
        (p) => p.status === 'active' || p.status === 'draft',
      );
      const itemResults = await Promise.all(
        activePlans.map(async (p: Plan) => {
          const r = await apiClient.get<PlannedItem[]>(`/plans/${p.id}/items`);
          return { planId: p.id, items: r.data };
        }),
      );
      const map = new Map<string, PlannedItem[]>();
      itemResults.forEach(({ planId, items }: { planId: string; items: PlannedItem[] }) => {
        map.set(planId, items);
      });
      setPlanItems(map);
    } catch {
      // ignore — picker will be empty
    } finally {
      setPickerLoading(false);
    }
  }, [plans.length]);

  const handleShowPicker = (): void => {
    setShowPicker(true);
    void loadPickerData();
  };

  const handleMap = useCallback(
    async (plannedItemId: string | null): Promise<void> => {
      const previousMapping = mapping;

      let newMapping: TransactionMapping | null = null;
      if (plannedItemId !== null) {
        for (const [planId, items] of planItems) {
          const item = items.find((i) => i.id === plannedItemId);
          if (item) {
            const plan = plans.find((p) => p.id === planId);
            newMapping = {
              plannedItemId: item.id,
              plannedItemName: `${plan?.name ?? ''}${item.categoryName ? ` — ${item.categoryName}` : ''}`,
              categoryId: item.categoryId,
              categoryName: item.categoryName ?? '',
            };
            break;
          }
        }
      }

      // Optimistic update
      setMapping(newMapping);
      setShowPicker(false);
      setMappingLoading(true);
      setMappingError(null);

      try {
        await apiClient.request({
          url: `/transactions/${transactionId}/mapping`,
          method: 'PATCH',
          body: { plannedItemId },
        });
        const updatedTx: Transaction | null = transaction
          ? { ...transaction, mapping: newMapping }
          : null;
        if (updatedTx) {
          setTransaction(updatedTx);
          onUpdated?.(updatedTx);
        }
      } catch {
        // Rollback
        setMapping(previousMapping);
        setMappingError(
          intl.formatMessage({
            id: 'screen.transactionDetail.mappingError',
            defaultMessage: 'Failed to update mapping',
          }),
        );
      } finally {
        setMappingLoading(false);
      }
    },
    [mapping, planItems, plans, transactionId, transaction, onUpdated, intl],
  );

  const handleSaveNotes = async (): Promise<void> => {
    setSavingNotes(true);
    setNotesError(null);
    try {
      await apiClient.request({
        url: `/transactions/${transactionId}`,
        method: 'PATCH',
        body: { notes },
      });
      const updatedTx: Transaction | null = transaction ? { ...transaction, notes } : null;
      if (updatedTx) {
        setTransaction(updatedTx);
        onUpdated?.(updatedTx);
      }
    } catch {
      setNotesError(
        intl.formatMessage({
          id: 'screen.transactionDetail.saveError',
          defaultMessage: 'Failed to save',
        }),
      );
    } finally {
      setSavingNotes(false);
    }
  };

  const handleToggleTransfer = async (): Promise<void> => {
    const prev = isTransfer;
    setIsTransfer(!prev);
    setTogglingTransfer(true);
    try {
      if (!prev) {
        await apiClient.post(`/transactions/${transactionId}/transfer`, {});
      } else {
        await apiClient.delete(`/transactions/${transactionId}/transfer`);
      }
      const updatedTx: Transaction | null = transaction
        ? { ...transaction, isTransfer: !prev }
        : null;
      if (updatedTx) {
        setTransaction(updatedTx);
        onUpdated?.(updatedTx);
      }
    } catch {
      setIsTransfer(prev);
    } finally {
      setTogglingTransfer(false);
    }
  };

  const handleToggleIgnored = async (): Promise<void> => {
    const prev = ignored;
    setIgnored(!prev);
    setTogglingIgnored(true);
    try {
      await apiClient.request({
        url: `/transactions/${transactionId}`,
        method: 'PATCH',
        body: { ignored: !prev },
      });
      const updatedTx: Transaction | null = transaction
        ? { ...transaction, ignored: !prev }
        : null;
      if (updatedTx) {
        setTransaction(updatedTx);
        onUpdated?.(updatedTx);
      }
    } catch {
      setIgnored(prev);
    } finally {
      setTogglingIgnored(false);
    }
  };

  // Build picker items: suggestions (current mapping item) float to top
  const pickerItems: Array<{ planId: string; planName: string; item: PlannedItem }> = [];
  for (const plan of plans) {
    if (plan.status === 'archived') continue;
    const items = planItems.get(plan.id) ?? [];
    for (const item of items) {
      pickerItems.push({ planId: plan.id, planName: plan.name, item });
    }
  }
  const currentMappedId = mapping?.plannedItemId;
  pickerItems.sort((a, b) => {
    if (a.item.id === currentMappedId) return -1;
    if (b.item.id === currentMappedId) return 1;
    return 0;
  });

  return {
    transaction,
    loading,
    fetchError,
    notes,
    setNotes,
    savingNotes,
    notesError,
    mapping,
    mappingLoading,
    mappingError,
    isTransfer,
    ignored,
    togglingTransfer,
    togglingIgnored,
    plans,
    planItems,
    showPicker,
    setShowPicker,
    pickerLoading,
    pickerItems,
    currentMappedId,
    handleSaveNotes,
    handleMap,
    handleShowPicker,
    handleToggleTransfer,
    handleToggleIgnored,
  };
}
