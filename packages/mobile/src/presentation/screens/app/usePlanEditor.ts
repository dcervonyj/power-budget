import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useIntl } from 'react-intl';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types.js';
import { planService } from '../../../infrastructure/index.js';
import type { PlannedItem, PlanPeriodKind, PlannedDirection } from '../../../infrastructure/index.js';

type Props = NativeStackScreenProps<AppStackParamList, 'PlanEditor'>;

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function endOfMonthIso(): string {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() + 1, 0);
  return d.toISOString().slice(0, 10);
}

export function formatAmount(amountMinor: number): string {
  return (amountMinor / 100).toFixed(2);
}

export function parseAmount(text: string): number {
  const n = parseFloat(text);
  if (isNaN(n)) return 0;
  return Math.round(n * 100);
}

export interface UsePlanEditorReturn {
  loading: boolean;
  saving: boolean;
  items: PlannedItem[];
  name: string;
  setName: (name: string) => void;
  periodKind: PlanPeriodKind;
  setPeriodKind: (kind: PlanPeriodKind) => void;
  startDate: string;
  setStartDate: (date: string) => void;
  endDate: string;
  setEndDate: (date: string) => void;
  baseCurrency: string;
  setBaseCurrency: (currency: string) => void;
  amountDrafts: Record<string, string>;
  handleSavePlan: () => Promise<void>;
  handleAmountChange: (itemId: string, text: string) => void;
  handleAmountBlur: (itemId: string) => Promise<void>;
  handleAddItem: (direction: PlannedDirection) => Promise<void>;
  handleDeleteItem: (itemId: string) => Promise<void>;
  handleArchive: () => void;
}

export function usePlanEditor(
  planId: string | undefined,
  navigation: Props['navigation'],
): UsePlanEditorReturn {
  const intl = useIntl();
  const isNew = planId === undefined;

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<PlannedItem[]>([]);

  const [name, setName] = useState('');
  const [periodKind, setPeriodKind] = useState<PlanPeriodKind>('monthly');
  const [startDate, setStartDate] = useState(todayIso);
  const [endDate, setEndDate] = useState(endOfMonthIso);
  const [baseCurrency, setBaseCurrency] = useState('EUR');
  const [amountDrafts, setAmountDrafts] = useState<Record<string, string>>({});

  const pendingItemSaves = useRef<Set<string>>(new Set());

  const loadPlan = useCallback(
    async (id: string) => {
      try {
        const [p, its] = await Promise.all([
          planService.getPlan(id),
          planService.listPlannedItems(id),
        ]);
        setName(p.name);
        setPeriodKind(p.periodKind);
        setStartDate(p.period.start);
        setEndDate(p.period.end);
        setBaseCurrency(p.baseCurrency);
        setItems(its);
        const drafts: Record<string, string> = {};
        for (const item of its) {
          drafts[item.id] = formatAmount(item.amountMinor);
        }
        setAmountDrafts(drafts);
      } catch {
        Alert.alert(
          intl.formatMessage({ id: 'error.title', defaultMessage: 'Error' }),
          intl.formatMessage({
            id: 'error.planLoadFailed',
            defaultMessage: 'Could not load plan.',
          }),
        );
      } finally {
        setLoading(false);
      }
    },
    [intl],
  );

  useEffect(() => {
    if (!isNew && planId !== undefined) {
      void loadPlan(planId);
    }
  }, [isNew, planId, loadPlan]);

  // Auto-adjust end date based on periodKind
  useEffect(() => {
    if (periodKind === 'weekly') {
      const start = new Date(`${startDate}T00:00:00Z`);
      start.setUTCDate(start.getUTCDate() + 6);
      setEndDate(start.toISOString().slice(0, 10));
    } else if (periodKind === 'monthly') {
      const start = new Date(`${startDate}T00:00:00Z`);
      start.setUTCMonth(start.getUTCMonth() + 1, 0);
      setEndDate(start.toISOString().slice(0, 10));
    }
  }, [periodKind, startDate]);

  const handleSavePlan = async (): Promise<void> => {
    if (!name.trim()) {
      Alert.alert(
        intl.formatMessage({ id: 'error.validation.title', defaultMessage: 'Validation Error' }),
        intl.formatMessage({
          id: 'error.plan.nameRequired',
          defaultMessage: 'Plan name is required.',
        }),
      );
      return;
    }

    setSaving(true);
    try {
      if (isNew) {
        const created = await planService.createPlan({
          name: name.trim(),
          type: 'personal',
          periodKind,
          period: { start: startDate, end: endDate },
          baseCurrency,
        });
        navigation.replace('PlanEditor', { planId: created.id });
      } else if (planId !== undefined) {
        await planService.updatePlan(planId, {
          name: name.trim(),
          periodKind,
          period: { start: startDate, end: endDate },
          baseCurrency,
        });
        Alert.alert(
          intl.formatMessage({ id: 'success.title', defaultMessage: 'Saved' }),
          intl.formatMessage({ id: 'plan.saved', defaultMessage: 'Plan saved.' }),
        );
      }
    } catch {
      Alert.alert(
        intl.formatMessage({ id: 'error.title', defaultMessage: 'Error' }),
        intl.formatMessage({ id: 'error.planSaveFailed', defaultMessage: 'Could not save plan.' }),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleAmountChange = (itemId: string, text: string): void => {
    setAmountDrafts((prev) => ({ ...prev, [itemId]: text }));
  };

  const handleAmountBlur = async (itemId: string): Promise<void> => {
    if (!planId || pendingItemSaves.current.has(itemId)) return;
    const text = amountDrafts[itemId] ?? '0';
    const amountMinor = parseAmount(text);
    pendingItemSaves.current.add(itemId);
    try {
      const updated = await planService.updatePlannedItem(planId, itemId, { amountMinor });
      setItems((prev) => prev.map((i) => (i.id === itemId ? updated : i)));
      setAmountDrafts((prev) => ({ ...prev, [itemId]: formatAmount(updated.amountMinor) }));
    } catch {
      // silently revert
      const item = items.find((i) => i.id === itemId);
      if (item) {
        setAmountDrafts((prev) => ({ ...prev, [itemId]: formatAmount(item.amountMinor) }));
      }
    } finally {
      pendingItemSaves.current.delete(itemId);
    }
  };

  const handleAddItem = async (direction: PlannedDirection): Promise<void> => {
    if (!planId) return;
    try {
      const created = await planService.createPlannedItem(planId, {
        categoryId: 'uncategorized',
        direction,
        amountMinor: 0,
        currency: baseCurrency,
      });
      setItems((prev) => [...prev, created]);
      setAmountDrafts((prev) => ({ ...prev, [created.id]: '0.00' }));
    } catch {
      Alert.alert(
        intl.formatMessage({ id: 'error.title', defaultMessage: 'Error' }),
        intl.formatMessage({ id: 'error.itemAddFailed', defaultMessage: 'Could not add item.' }),
      );
    }
  };

  const handleDeleteItem = async (itemId: string): Promise<void> => {
    if (!planId) return;
    try {
      await planService.deletePlannedItem(planId, itemId);
      setItems((prev) => prev.filter((i) => i.id !== itemId));
    } catch {
      Alert.alert(
        intl.formatMessage({ id: 'error.title', defaultMessage: 'Error' }),
        intl.formatMessage({
          id: 'error.itemDeleteFailed',
          defaultMessage: 'Could not delete item.',
        }),
      );
    }
  };

  const handleArchive = (): void => {
    if (!planId) return;
    Alert.alert(
      intl.formatMessage({ id: 'plan.archive.confirm.title', defaultMessage: 'Archive Plan' }),
      intl.formatMessage({
        id: 'plan.archive.confirm.body',
        defaultMessage: 'Are you sure you want to archive this plan?',
      }),
      [
        {
          text: intl.formatMessage({ id: 'action.cancel', defaultMessage: 'Cancel' }),
          style: 'cancel',
        },
        {
          text: intl.formatMessage({ id: 'action.archive', defaultMessage: 'Archive' }),
          style: 'destructive',
          onPress: () => {
            void planService.archivePlan(planId).then(() => {
              navigation.goBack();
            });
          },
        },
      ],
    );
  };

  return {
    loading,
    saving,
    items,
    name,
    setName,
    periodKind,
    setPeriodKind,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    baseCurrency,
    setBaseCurrency,
    amountDrafts,
    handleSavePlan,
    handleAmountChange,
    handleAmountBlur,
    handleAddItem,
    handleDeleteItem,
    handleArchive,
  };
}
