import { useState, useCallback, useEffect } from 'react';
import { useIntl } from 'react-intl';
import { apiClient } from '../../../AppProviders.js';

export type PlanPeriod = 'weekly' | 'monthly' | 'custom';
export type PlanStatus = 'active' | 'draft' | 'archived';
export type Direction = 'income' | 'expense';

export interface Plan {
  id: string;
  name: string;
  period: PlanPeriod;
  status: PlanStatus;
  baseCurrency: string;
  startDate?: string;
  endDate?: string;
  version: number;
  updatedAt: string;
}

export interface PlannedItem {
  id: string;
  planId: string;
  categoryId: string;
  categoryName?: string;
  direction: Direction;
  amountMinor: number;
  currency: string;
  version: number;
}

export interface DraftItem {
  draftId: string;
  categoryId: string;
  direction: Direction;
  amountMinor: string;
  currency: string;
}

export interface UsePlanEditorReturn {
  plan: Plan | null;
  setPlan: React.Dispatch<React.SetStateAction<Plan | null>>;
  items: PlannedItem[];
  setItems: React.Dispatch<React.SetStateAction<PlannedItem[]>>;
  loading: boolean;
  error: string | null;
  saving: boolean;
  saveError: string | null;
  historyDrawer: { planId: string; itemId: string } | null;
  setHistoryDrawer: React.Dispatch<React.SetStateAction<{ planId: string; itemId: string } | null>>;
  draftItem: DraftItem;
  setDraftItem: React.Dispatch<React.SetStateAction<DraftItem>>;
  handleSave: () => Promise<void>;
  handlePeriodChange: (newPeriod: PlanPeriod) => Promise<void>;
  handleCustomDatesChange: (dates: { startDate: string; endDate: string }) => Promise<void>;
  handleAddItem: () => Promise<void>;
  handleUpdateItem: (
    item: PlannedItem,
    changes: Partial<Pick<PlannedItem, 'amountMinor' | 'currency'>>,
  ) => Promise<void>;
  handleRemoveItem: (itemId: string) => Promise<void>;
}

export function usePlanEditor(id: string | undefined): UsePlanEditorReturn {
  const intl = useIntl();

  const [plan, setPlan] = useState<Plan | null>(null);
  const [items, setItems] = useState<PlannedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [historyDrawer, setHistoryDrawer] = useState<{ planId: string; itemId: string } | null>(
    null,
  );

  const [draftItem, setDraftItem] = useState<DraftItem>({
    draftId: crypto.randomUUID(),
    categoryId: '',
    direction: 'expense',
    amountMinor: '',
    currency: '',
  });

  const fetchData = useCallback(async (): Promise<void> => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [planRes, itemsRes] = await Promise.all([
        apiClient.get<Plan>(`/plans/${id}`),
        apiClient.get<PlannedItem[]>(`/plans/${id}/items`),
      ]);
      setPlan(planRes.data);
      setItems(itemsRes.data);
    } catch {
      setError(
        intl.formatMessage({
          id: 'screen.planEditor.error',
          defaultMessage: 'Failed to load plan',
        }),
      );
    } finally {
      setLoading(false);
    }
  }, [id, intl]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleSave = async (): Promise<void> => {
    if (!plan) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await apiClient.put<Plan>(`/plans/${plan.id}`, {
        name: plan.name,
        baseCurrency: plan.baseCurrency,
        version: plan.version,
      });
      setPlan(res.data);
    } catch {
      setSaveError(
        intl.formatMessage({
          id: 'screen.planEditor.saveError',
          defaultMessage: 'Failed to save plan',
        }),
      );
    } finally {
      setSaving(false);
    }
  };

  const handlePeriodChange = async (newPeriod: PlanPeriod): Promise<void> => {
    if (!plan) return;
    const prevPlan = plan;
    setPlan({ ...plan, period: newPeriod });
    try {
      const res = await apiClient.put<Plan>(`/plans/${plan.id}`, {
        name: plan.name,
        baseCurrency: plan.baseCurrency,
        period: newPeriod,
        version: plan.version,
      });
      setPlan(res.data);
    } catch {
      setPlan(prevPlan);
      setSaveError(
        intl.formatMessage({
          id: 'screen.planEditor.saveError',
          defaultMessage: 'Failed to save plan',
        }),
      );
    }
  };

  const handleCustomDatesChange = async (dates: {
    startDate: string;
    endDate: string;
  }): Promise<void> => {
    if (!plan) return;
    const prevPlan = plan;
    setPlan({ ...plan, startDate: dates.startDate, endDate: dates.endDate });
    try {
      const res = await apiClient.put<Plan>(`/plans/${plan.id}`, {
        name: plan.name,
        baseCurrency: plan.baseCurrency,
        startDate: dates.startDate,
        endDate: dates.endDate,
        version: plan.version,
      });
      setPlan(res.data);
    } catch {
      setPlan(prevPlan);
      setSaveError(
        intl.formatMessage({
          id: 'screen.planEditor.saveError',
          defaultMessage: 'Failed to save plan',
        }),
      );
    }
  };

  const handleAddItem = async (): Promise<void> => {
    if (!plan) return;
    const amount = parseInt(draftItem.amountMinor, 10);
    if (!draftItem.categoryId || isNaN(amount) || !draftItem.currency) return;

    try {
      const res = await apiClient.post<PlannedItem>(`/plans/${plan.id}/items`, {
        categoryId: draftItem.categoryId,
        direction: draftItem.direction,
        amountMinor: amount,
        currency: draftItem.currency,
      });
      setItems((prev) => [...prev, res.data]);
      setDraftItem({
        draftId: crypto.randomUUID(),
        categoryId: '',
        direction: 'expense',
        amountMinor: '',
        currency: '',
      });
    } catch {
      setSaveError(
        intl.formatMessage({
          id: 'screen.planEditor.addItemError',
          defaultMessage: 'Failed to add item',
        }),
      );
    }
  };

  const handleUpdateItem = async (
    item: PlannedItem,
    changes: Partial<Pick<PlannedItem, 'amountMinor' | 'currency'>>,
  ): Promise<void> => {
    if (!plan) return;
    const prevItems = items;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, ...changes } : i)));
    try {
      const res = await apiClient.put<PlannedItem>(`/plans/${plan.id}/items/${item.id}`, {
        ...changes,
        version: item.version,
      });
      setItems((prev) => prev.map((i) => (i.id === item.id ? res.data : i)));
    } catch {
      setItems(prevItems);
      setSaveError(
        intl.formatMessage({
          id: 'screen.planEditor.updateItemError',
          defaultMessage: 'Failed to update item',
        }),
      );
    }
  };

  const handleRemoveItem = async (itemId: string): Promise<void> => {
    if (!plan) return;
    const prevItems = items;
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    try {
      await apiClient.delete(`/plans/${plan.id}/items/${itemId}`);
    } catch {
      setItems(prevItems);
      setSaveError(
        intl.formatMessage({
          id: 'screen.planEditor.removeItemError',
          defaultMessage: 'Failed to remove item',
        }),
      );
    }
  };

  return {
    plan,
    setPlan,
    items,
    setItems,
    loading,
    error,
    saving,
    saveError,
    historyDrawer,
    setHistoryDrawer,
    draftItem,
    setDraftItem,
    handleSave,
    handlePeriodChange,
    handleCustomDatesChange,
    handleAddItem,
    handleUpdateItem,
    handleRemoveItem,
  };
}
