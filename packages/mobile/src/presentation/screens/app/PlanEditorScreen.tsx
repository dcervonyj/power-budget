import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text } from 'react-native';
import { useIntl } from 'react-intl';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { isSupportedCurrency } from '@power-budget/core';
import type {
  CategoryDto,
  CreatePlannedItemDto,
  PlanDto,
  PlannedItemDto,
  UpdatePlanDto,
  UpdatePlannedItemDto,
} from '@power-budget/shared-app/contract';
import { Button } from '../../components/Button.js';
import type { AppStackParamList } from '../../navigation/types.js';
import { categoriesApi, plansApi } from '../../../infrastructure/index.js';
import { PlanEditorView } from './plan/PlanEditorView.js';
import type { PlanDraftItem, PlanItemRowModel } from './plan/planModels.js';
import { computePlanTotals, toAmountInput, toMinorUnitsString } from './plan/planAmounts.js';
import { usePlanStyles } from './plan/planStyles.js';
import { useGlass } from '../../theme/index.js';

type Props = NativeStackScreenProps<AppStackParamList, 'PlanEditor'>;

const EMPTY_DRAFT: PlanDraftItem = { categoryId: '', direction: 'expense', amount: '' };

/** Spent per planned item, in the item's currency, as the dashboard reported it. */
type SpentByItem = ReadonlyMap<string, { amountMinor: bigint; currency: string }>;

export function PlanEditorScreen({ route, navigation }: Props): React.JSX.Element {
  const intl = useIntl();
  const glass = useGlass();
  const shared = usePlanStyles();
  const planId = route.params?.planId;

  const [plan, setPlan] = useState<PlanDto | null>(null);
  const [items, setItems] = useState<PlannedItemDto[]>([]);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [spent, setSpent] = useState<SpentByItem | null>(null);
  const [loading, setLoading] = useState(planId !== undefined);
  const [loadFailed, setLoadFailed] = useState(planId === undefined);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [draft, setDraft] = useState<PlanDraftItem>(EMPTY_DRAFT);
  // Amount saves run one after another per item, so a slow earlier save cannot overwrite a newer one.
  const saveQueues = useRef(new Map<string, Promise<void>>());
  const pendingSaves = useRef(new Map<string, number>());
  const confirmedItems = useRef(new Map<string, PlannedItemDto>());

  const text = useCallback(
    (id: string, defaultMessage: string): string => intl.formatMessage({ id, defaultMessage }),
    [intl],
  );

  const loadAll = useCallback(async (): Promise<void> => {
    if (planId === undefined) {
      return;
    }
    setLoading(true);
    setLoadFailed(false);
    try {
      const [loadedPlan, loadedItems, loadedCategories, loadedSpent] = await Promise.all([
        plansApi.get(planId),
        plansApi.listItems(planId),
        // Items may point at archived categories; without categories items show by id.
        categoriesApi.list({ includeArchived: true }).catch((): CategoryDto[] => []),
        loadSpent(planId),
      ]);
      setPlan(loadedPlan);
      setItems(loadedItems);
      confirmedItems.current = new Map(loadedItems.map((item) => [item.id, item]));
      setCategories(loadedCategories);
      setSpent(loadedSpent);
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function handleSave(): Promise<void> {
    if (plan === null) {
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const body: UpdatePlanDto = isSupportedCurrency(plan.baseCurrency)
        ? { name: plan.name.trim(), baseCurrency: plan.baseCurrency }
        : { name: plan.name.trim() };
      setPlan(await plansApi.update(plan.id, body));
    } catch {
      setSaveError(text('plan.error.save', 'Could not save the plan.'));
    } finally {
      setSaving(false);
    }
  }

  async function handleCustomDates(start: string, end: string): Promise<void> {
    if (plan === null) {
      return;
    }
    const previousPeriod = plan.period;
    setPlan({ ...plan, period: { start, end } });
    try {
      const saved = await plansApi.update(plan.id, { periodStart: start, periodEnd: end });
      // Only the period comes from the server: unsaved name and currency edits stay as typed.
      setPlan((current) => (current === null ? current : { ...current, period: saved.period }));
    } catch {
      setPlan((current) => (current === null ? current : { ...current, period: previousPeriod }));
      setSaveError(text('plan.error.save', 'Could not save the plan.'));
    }
  }

  async function handleAddItem(): Promise<void> {
    if (plan === null) {
      return;
    }
    const currency = plan.baseCurrency;
    const amountMinor = toMinorUnitsString(draft.amount, currency);
    if (draft.categoryId === '' || amountMinor === null || !isSupportedCurrency(currency)) {
      setSaveError(text('plan.error.itemInvalid', 'Choose a category and enter an amount.'));

      return;
    }
    try {
      const body: CreatePlannedItemDto = {
        categoryId: draft.categoryId,
        direction: draft.direction,
        amountMinor,
        currency,
      };
      const created = await plansApi.createItem(plan.id, body);
      confirmedItems.current.set(created.id, created);
      setItems((previous) => [...previous, created]);
      setDraft(EMPTY_DRAFT);
      setSaveError(null);
    } catch {
      setSaveError(text('plan.error.itemAdd', 'Could not add the item.'));
    }
  }

  function handleAmountChange(itemId: string, amountMinor: string): void {
    const item = items.find((candidate) => candidate.id === itemId);
    if (plan === null || item === undefined) {
      return;
    }
    const { currency } = item.amount;
    if (!isSupportedCurrency(currency)) {
      return;
    }
    const planIdToSave = plan.id;
    setItems((current) =>
      current.map((entry) =>
        entry.id === itemId ? { ...entry, amount: { amountMinor, currency } } : entry,
      ),
    );
    pendingSaves.current.set(itemId, (pendingSaves.current.get(itemId) ?? 0) + 1);
    const previousSave = saveQueues.current.get(itemId) ?? Promise.resolve();
    saveQueues.current.set(
      itemId,
      previousSave.then(() => saveAmount(planIdToSave, itemId, { amountMinor, currency })),
    );
  }

  async function saveAmount(
    planIdToSave: string,
    itemId: string,
    body: UpdatePlannedItemDto,
  ): Promise<void> {
    try {
      const updated = await plansApi.updateItem(planIdToSave, itemId, body);
      confirmedItems.current.set(itemId, updated);
      if (pendingSaves.current.get(itemId) === 1) {
        setItems((current) => current.map((entry) => (entry.id === itemId ? updated : entry)));
      }
    } catch {
      const confirmed = confirmedItems.current.get(itemId);
      if (pendingSaves.current.get(itemId) === 1 && confirmed !== undefined) {
        // Only this item goes back to its last saved value; other edits stay.
        setItems((current) => current.map((entry) => (entry.id === itemId ? confirmed : entry)));
      }
      setSaveError(text('plan.error.itemUpdate', 'Could not update the item.'));
    } finally {
      pendingSaves.current.set(itemId, (pendingSaves.current.get(itemId) ?? 1) - 1);
    }
  }

  async function handleRemove(itemId: string): Promise<void> {
    if (plan === null) {
      return;
    }
    const index = items.findIndex((entry) => entry.id === itemId);
    const removed = items[index];
    setItems((current) => current.filter((entry) => entry.id !== itemId));
    try {
      await plansApi.deleteItem(plan.id, itemId);
    } catch {
      if (removed !== undefined) {
        setItems((current) => [...current.slice(0, index), removed, ...current.slice(index)]);
      }
      setSaveError(text('plan.error.itemRemove', 'Could not remove the item.'));
    }
  }

  function handleArchive(): void {
    if (plan === null) {
      return;
    }
    const archiveId = plan.id;
    Alert.alert(
      text('plan.archive.title', 'Archive plan'),
      text('plan.archive.body', 'Are you sure you want to archive this plan?'),
      [
        { text: text('plan.archive.cancel', 'Cancel'), style: 'cancel' },
        {
          text: text('plan.archive.confirm', 'Archive'),
          style: 'destructive',
          onPress: () => {
            void archive(archiveId);
          },
        },
      ],
    );
  }

  async function archive(archiveId: string): Promise<void> {
    try {
      await plansApi.archive(archiveId);
      navigation.goBack();
    } catch {
      setSaveError(text('plan.error.archive', 'Could not archive the plan.'));
    }
  }

  if (loading) {
    return (
      <ScrollView contentContainerStyle={shared.centered}>
        <ActivityIndicator
          accessibilityLabel={text('plan.loading', 'Loading')}
          color={glass.colors.fg}
        />
      </ScrollView>
    );
  }

  if (loadFailed || plan === null) {
    return (
      <ScrollView contentContainerStyle={shared.page}>
        <Text accessibilityRole="alert" style={shared.noticeText}>
          {text('plan.editor.error', 'Could not load the plan.')}
        </Text>
        <Button
          variant="secondary"
          onPress={() => {
            void loadAll();
          }}
        >
          {text('plan.retry', 'Try again')}
        </Button>
      </ScrollView>
    );
  }

  const rows = items.map((item) => toRowModel(item, categories, spent));

  return (
    <PlanEditorView
      plan={plan}
      totals={computePlanTotals(items, plan.baseCurrency)}
      income={rows.filter((row) => row.direction === 'income')}
      limits={rows.filter((row) => row.direction === 'expense')}
      draft={draft}
      draftCategories={categories
        .filter((category) => !category.archived && category.kind === draft.direction)
        .map((category) => ({ value: category.id, label: category.name }))}
      saving={saving}
      saveError={saveError}
      onNameChange={(name) => {
        setPlan({ ...plan, name });
      }}
      onBaseCurrencyChange={(baseCurrency) => {
        setPlan({ ...plan, baseCurrency });
      }}
      onCustomDatesChange={(start, end) => {
        void handleCustomDates(start, end);
      }}
      onDraftChange={setDraft}
      onAddItem={() => {
        void handleAddItem();
      }}
      onSave={() => {
        void handleSave();
      }}
      onArchive={handleArchive}
      onAmountChange={(itemId, amountMinor) => {
        handleAmountChange(itemId, amountMinor);
      }}
      onRemove={(itemId) => {
        void handleRemove(itemId);
      }}
    />
  );
}

async function loadSpent(planId: string): Promise<SpentByItem | null> {
  try {
    const dashboard = await plansApi.dashboard(planId);

    return new Map(
      dashboard.expenseLines.map((line) => [
        line.plannedItemId,
        { amountMinor: BigInt(line.actual.amountMinor), currency: line.actual.currency },
      ]),
    );
  } catch {
    return null;
  }
}

function toRowModel(
  item: PlannedItemDto,
  categories: readonly CategoryDto[],
  spent: SpentByItem | null,
): PlanItemRowModel {
  const line = item.direction === 'expense' ? spent?.get(item.id) : undefined;
  const known = line !== undefined && line.currency === item.amount.currency;

  return {
    id: item.id,
    name: categories.find((category) => category.id === item.categoryId)?.name ?? item.categoryId,
    direction: item.direction,
    amountMinor: item.amount.amountMinor,
    currency: item.amount.currency,
    amountInput: toAmountInput(item.amount.amountMinor, item.amount.currency),
    spentMinor: known ? line.amountMinor : null,
  };
}
