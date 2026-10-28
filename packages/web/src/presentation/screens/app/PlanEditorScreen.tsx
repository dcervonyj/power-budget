import {
  categoriesApi,
  plansApi,
  referenceCatalogue,
  settingsStore,
} from '../../../composition.js';
import React, { useCallback, useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import { useParams } from 'react-router-dom';
import { isSupportedCurrency, parseMatchHintForm } from '@power-budget/core';
import type {
  CategoryDto,
  CreatePlannedItemDto,
  PlanDto,
  PlanPeriodKindDto,
  PlannedItemDto,
  UpdatePlanDto,
  UpdatePlannedItemDto,
} from '@power-budget/shared-app/contract';
import { toAmountInput, toMinorUnitsString } from '../../../application/plans/PlanAmounts.js';
import { computePlanTotals } from '../../../application/plans/PlanTotals.js';
import type { CustomPeriodValue } from '../../components/CustomPeriodPicker.js';
import { PlannedItemHistoryDrawer } from '../../components/PlannedItemHistoryDrawer.js';
import { ErrorBanner } from '../../components/shared/ErrorBanner.js';
import { SkeletonBlock } from '../../components/shared/SkeletonBlock.js';
import {
  EMPTY_DRAFT_MATCH_HINT,
  NO_DRAFT_ERRORS,
  PlanEditorView,
  type PlanDraftErrors,
  type PlanDraftItem,
} from './PlanEditorView.js';
import type { PlanItemChange, PlanItemRowModel } from './PlanItemRows.js';
import { PAGE_STYLE } from './planStyles.js';

const EMPTY_DRAFT: PlanDraftItem = {
  categoryId: '',
  direction: 'expense',
  amount: '',
  currency: '',
  matchHint: EMPTY_DRAFT_MATCH_HINT,
};

interface ItemSpent {
  readonly amountMinor: bigint;
  readonly currency: string;
}

/** Spent per planned item as the dashboard reported it; null when it cannot be read. */
type SpentByItem = ReadonlyMap<string, ItemSpent>;

export function PlanEditorScreen(): React.JSX.Element {
  const intl = useIntl();
  const { id } = useParams<{ id: string }>();

  const [plan, setPlan] = useState<PlanDto | null>(null);
  const [items, setItems] = useState<PlannedItemDto[]>([]);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [spent, setSpent] = useState<SpentByItem | null>(null);
  // Currency of the totals: the last supported base currency, so a half-typed code never reaches Intl.
  const [totalsCurrency, setTotalsCurrency] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [historyDrawer, setHistoryDrawer] = useState<{ planId: string; itemId: string } | null>(
    null,
  );
  const [draftItem, setDraftItem] = useState<PlanDraftItem>(EMPTY_DRAFT);
  const [draftErrors, setDraftErrors] = useState<PlanDraftErrors>(NO_DRAFT_ERRORS);

  const fetchData = useCallback(async (): Promise<void> => {
    if (!id) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [loadedPlan, loadedItems, loadedCategories, loadedSpent] = await Promise.all([
        plansApi.get(id),
        plansApi.listItems(id),
        // Items may point at archived categories, so those are listed too. Without
        // categories the editor still shows the items (by category id).
        categoriesApi.list({ includeArchived: true }).catch((): CategoryDto[] => []),
        loadSpent(id),
      ]);
      setPlan(loadedPlan);
      // The new-item row starts in the plan's own currency.
      setDraftItem((prev) =>
        prev.currency === '' ? { ...prev, currency: loadedPlan.baseCurrency } : prev,
      );
      setTotalsCurrency(loadedPlan.baseCurrency);
      setItems(loadedItems);
      setCategories(loadedCategories);
      setSpent(loadedSpent);
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

  useEffect(() => {
    // The history drawer marks the user's own edits by their user id.
    if (!settingsStore.profileLoaded) {
      void settingsStore.loadProfile();
    }
  }, []);

  const handleSave = async (): Promise<void> => {
    if (!plan) {
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const body: UpdatePlanDto = isSupportedCurrency(plan.baseCurrency)
        ? { name: plan.name, baseCurrency: plan.baseCurrency }
        : { name: plan.name };
      const saved = await plansApi.update(plan.id, body);
      referenceCatalogue.invalidate();
      setPlan(saved);
      setTotalsCurrency(saved.baseCurrency);
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

  const handlePeriodChange = (newPeriod: PlanPeriodKindDto): void => {
    if (!plan || newPeriod === plan.periodKind) {
      return;
    }
    // UpdatePlanDto has no periodKind (CLN-011): a weekly or monthly plan becomes
    // another kind only through "Clone".
    setSaveError(
      intl.formatMessage({
        id: 'screen.planEditor.periodKindReadOnly',
        defaultMessage: 'The period type cannot be changed. Clone the plan to use another period.',
      }),
    );
  };

  const handleCustomDatesChange = async (dates: CustomPeriodValue): Promise<void> => {
    if (!plan) {
      return;
    }
    const prevPlan = plan;
    setPlan({ ...plan, period: { start: dates.startDate, end: dates.endDate } });
    try {
      const body: UpdatePlanDto = { periodStart: dates.startDate, periodEnd: dates.endDate };
      const updated = await plansApi.update(plan.id, body);
      referenceCatalogue.invalidate();
      setPlan(updated);
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
    if (!plan) {
      return;
    }
    const currency = draftItem.currency.trim().toUpperCase();
    const amountMinor = toMinorUnitsString(draftItem.amount, currency);
    // An empty or unsupported currency makes the amount unparsable too: report the currency only.
    const hint = parseMatchHintForm(draftItem.matchHint, currency);
    setDraftErrors({
      category: !draftItem.categoryId,
      amount: isSupportedCurrency(currency) && amountMinor === null,
      currency: !isSupportedCurrency(currency),
      matchHint: hint.kind === 'invalid' ? hint.fields : [],
    });
    if (
      !draftItem.categoryId ||
      amountMinor === null ||
      !isSupportedCurrency(currency) ||
      hint.kind === 'invalid'
    ) {
      return;
    }
    setSaveError(null);

    try {
      const body: CreatePlannedItemDto = {
        categoryId: draftItem.categoryId,
        direction: draftItem.direction,
        amountMinor,
        currency,
        ...(hint.kind === 'ok' ? { matchHint: hint.hint } : {}),
      };
      const created = await plansApi.createItem(plan.id, body);
      referenceCatalogue.invalidate();
      setItems((prev) => [...prev, created]);
      setDraftItem({ ...EMPTY_DRAFT, currency: plan.baseCurrency });
    } catch {
      setSaveError(
        intl.formatMessage({
          id: 'screen.planEditor.addItemError',
          defaultMessage: 'Failed to add item',
        }),
      );
    }
  };

  const handleInvalidAmount = (): void => {
    setSaveError(
      intl.formatMessage({
        id: 'screen.planEditor.invalidAmountError',
        defaultMessage: 'That amount is not valid, so the previous amount was kept.',
      }),
    );
  };

  const handleUpdateItem = async (item: PlannedItemDto, changes: PlanItemChange): Promise<void> => {
    if (!plan) {
      return;
    }
    setSaveError(null);
    const prevItems = items;
    const amount = {
      amountMinor: changes.amountMinor ?? item.amount.amountMinor,
      currency: (changes.currency ?? item.amount.currency).trim().toUpperCase(),
    };
    const amountChanged = changes.amountMinor !== undefined || changes.currency !== undefined;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, amount } : i)));
    try {
      if (!isSupportedCurrency(amount.currency)) {
        throw new Error(`Unsupported currency ${amount.currency}`);
      }
      const body: UpdatePlannedItemDto = {
        ...(amountChanged ? { amountMinor: amount.amountMinor, currency: amount.currency } : {}),
        ...(changes.matchHint !== undefined ? { matchHint: changes.matchHint } : {}),
      };
      const updated = await plansApi.updateItem(plan.id, item.id, body);
      referenceCatalogue.invalidate();
      setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)));
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
    if (!plan) {
      return;
    }
    const prevItems = items;
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    try {
      await plansApi.deleteItem(plan.id, itemId);
      referenceCatalogue.invalidate();
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

  if (loading) {
    return (
      <div style={PAGE_STYLE}>
        <SkeletonBlock height={120} borderRadius={28} />
        <SkeletonBlock height={240} borderRadius={28} />
      </div>
    );
  }

  if (error !== null || plan === null) {
    return (
      <div style={PAGE_STYLE}>
        <ErrorBanner
          message={
            error ??
            intl.formatMessage({
              id: 'screen.planEditor.error',
              defaultMessage: 'Failed to load plan',
            })
          }
          onRetry={() => {
            void fetchData();
          }}
        />
      </div>
    );
  }

  const rows = items.map((item) => toRowModel(item, categories, spent));

  return (
    <>
      <PlanEditorView
        plan={plan}
        totals={computePlanTotals(items, totalsCurrency)}
        income={rows.filter((row) => row.direction === 'income')}
        limits={rows.filter((row) => row.direction === 'expense')}
        draft={draftItem}
        draftErrors={draftErrors}
        draftCategories={categories
          .filter((c) => !c.archived && c.kind === draftItem.direction)
          .map((c) => ({ value: c.id, label: c.name }))}
        saving={saving}
        saveError={saveError}
        onNameChange={(name) => {
          setPlan({ ...plan, name });
        }}
        onBaseCurrencyChange={(baseCurrency) => {
          setPlan({ ...plan, baseCurrency });
          if (isSupportedCurrency(baseCurrency)) {
            setTotalsCurrency(baseCurrency);
          }
        }}
        onPeriodKindChange={handlePeriodChange}
        onCustomDatesChange={(dates) => {
          void handleCustomDatesChange(dates);
        }}
        onDraftChange={(draft) => {
          setDraftItem(draft);
          setSaveError(null);
          setDraftErrors(NO_DRAFT_ERRORS);
        }}
        onAddItem={() => {
          void handleAddItem();
        }}
        onSave={() => {
          void handleSave();
        }}
        onChange={(itemId, change) => {
          const item = items.find((i) => i.id === itemId);
          if (item !== undefined) {
            void handleUpdateItem(item, change);
          }
        }}
        onInvalidAmount={handleInvalidAmount}
        onHistory={(itemId) => {
          setHistoryDrawer({ planId: plan.id, itemId });
        }}
        onRemove={(itemId) => {
          void handleRemoveItem(itemId);
        }}
      />
      {historyDrawer && (
        <PlannedItemHistoryDrawer
          planId={historyDrawer.planId}
          itemId={historyDrawer.itemId}
          isOpen
          currentUserId={settingsStore.userId}
          onClose={() => {
            setHistoryDrawer(null);
          }}
        />
      )}
    </>
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
    name: categories.find((c) => c.id === item.categoryId)?.name ?? item.categoryId,
    direction: item.direction,
    amountMinor: item.amount.amountMinor,
    currency: item.amount.currency,
    amountInput: toAmountInput(item),
    spentMinor: known ? line.amountMinor : null,
    matchHint: item.matchHint,
  };
}
