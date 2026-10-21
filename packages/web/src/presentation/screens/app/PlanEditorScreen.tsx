import React, { useEffect, useState, useCallback } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { useParams } from 'react-router-dom';
import { useTheme } from '../../components/ThemeContext.js';
import { Button } from '../../components/Button.js';
import { Input } from '../../components/Input.js';
import { Select } from '../../components/Select.js';
import { CustomPeriodPicker } from '../../components/CustomPeriodPicker.js';
import type { CustomPeriodValue } from '../../components/CustomPeriodPicker.js';
import {
  formatMoneyInput,
  isSupportedCurrency,
  parseMinorUnits,
  parseMoney,
} from '@power-budget/core';
import type {
  CategoryDto,
  CreatePlannedItemDto,
  PlanDto,
  PlanPeriodKindDto,
  PlannedItemDirectionDto,
  PlannedItemDto,
  UpdatePlanDto,
  UpdatePlannedItemDto,
} from '@power-budget/shared-app/contract';
import { categoriesApi, plansApi } from '../../../AppProviders.js';
import { settingsStore } from '../../../application/settings/SettingsStore.js';
import { PlannedItemHistoryDrawer } from '../../components/PlannedItemHistoryDrawer.js';

interface DraftItem {
  draftId: string;
  categoryId: string;
  direction: PlannedItemDirectionDto;
  /** What the user typed, in major units ("12,50"). */
  amount: string;
  currency: string;
}

/** The amount and currency of a planned item; PATCH sends them together. */
interface ItemAmountChange {
  amountMinor?: string;
  currency?: string;
}

/** Exact minor units as the API's integer string, or null when the input is not an amount. */
function toMinorUnitsString(amount: string, currency: string): string | null {
  if (!currency) {
    return null;
  }
  try {
    return parseMoney(amount, currency).toString();
  } catch {
    return null;
  }
}

function toAmountInput(item: PlannedItemDto): string {
  try {
    return formatMoneyInput(parseMinorUnits(item.amount.amountMinor), item.amount.currency);
  } catch {
    return '';
  }
}

export function PlanEditorScreen(): React.JSX.Element {
  const theme = useTheme();
  const intl = useIntl();
  const { id } = useParams<{ id: string }>();

  const [plan, setPlan] = useState<PlanDto | null>(null);
  const [items, setItems] = useState<PlannedItemDto[]>([]);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [historyDrawer, setHistoryDrawer] = useState<{ planId: string; itemId: string } | null>(
    null,
  );

  // Draft new item
  const [draftItem, setDraftItem] = useState<DraftItem>({
    draftId: crypto.randomUUID(),
    categoryId: '',
    direction: 'expense',
    amount: '',
    currency: '',
  });

  const fetchData = useCallback(async (): Promise<void> => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [loadedPlan, loadedItems, loadedCategories] = await Promise.all([
        plansApi.get(id),
        plansApi.listItems(id),
        // Items may point at archived categories, so those are listed too. Without
        // categories the editor still shows the items (by category id).
        categoriesApi.list({ includeArchived: true }).catch((): CategoryDto[] => []),
      ]);
      setPlan(loadedPlan);
      setItems(loadedItems);
      setCategories(loadedCategories);
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
    if (!plan) return;
    setSaving(true);
    setSaveError(null);
    try {
      const body: UpdatePlanDto = isSupportedCurrency(plan.baseCurrency)
        ? { name: plan.name, baseCurrency: plan.baseCurrency }
        : { name: plan.name };
      setPlan(await plansApi.update(plan.id, body));
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
    if (!plan || newPeriod === plan.periodKind) return;
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
    if (!plan) return;
    const prevPlan = plan;
    setPlan({ ...plan, period: { start: dates.startDate, end: dates.endDate } });
    try {
      const body: UpdatePlanDto = { periodStart: dates.startDate, periodEnd: dates.endDate };
      setPlan(await plansApi.update(plan.id, body));
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
    const currency = draftItem.currency.trim().toUpperCase();
    const amountMinor = toMinorUnitsString(draftItem.amount, currency);
    if (!draftItem.categoryId || amountMinor === null || !isSupportedCurrency(currency)) return;

    try {
      const body: CreatePlannedItemDto = {
        categoryId: draftItem.categoryId,
        direction: draftItem.direction,
        amountMinor,
        currency,
      };
      const created = await plansApi.createItem(plan.id, body);
      setItems((prev) => [...prev, created]);
      setDraftItem({
        draftId: crypto.randomUUID(),
        categoryId: '',
        direction: 'expense',
        amount: '',
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
    item: PlannedItemDto,
    changes: ItemAmountChange,
  ): Promise<void> => {
    if (!plan) return;
    const prevItems = items;
    const amount = {
      amountMinor: changes.amountMinor ?? item.amount.amountMinor,
      currency: (changes.currency ?? item.amount.currency).trim().toUpperCase(),
    };
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, amount } : i)));
    try {
      if (!isSupportedCurrency(amount.currency)) {
        throw new Error(`Unsupported currency ${amount.currency}`);
      }
      const body: UpdatePlannedItemDto = {
        amountMinor: amount.amountMinor,
        currency: amount.currency,
      };
      const updated = await plansApi.updateItem(plan.id, item.id, body);
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
    if (!plan) return;
    const prevItems = items;
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    try {
      await plansApi.deleteItem(plan.id, itemId);
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

  const periodOptions: ReadonlyArray<{ value: PlanPeriodKindDto; label: string }> = [
    {
      value: 'weekly',
      label: intl.formatMessage({ id: 'screen.planEditor.periodWeekly', defaultMessage: 'Weekly' }),
    },
    {
      value: 'monthly',
      label: intl.formatMessage({
        id: 'screen.planEditor.periodMonthly',
        defaultMessage: 'Monthly',
      }),
    },
    {
      value: 'custom',
      label: intl.formatMessage({ id: 'screen.planEditor.periodCustom', defaultMessage: 'Custom' }),
    },
  ];

  const directionOptions: ReadonlyArray<{ value: PlannedItemDirectionDto; label: string }> = [
    {
      value: 'income',
      label: intl.formatMessage({
        id: 'screen.planEditor.itemDirectionIncome',
        defaultMessage: 'Income',
      }),
    },
    {
      value: 'expense',
      label: intl.formatMessage({
        id: 'screen.planEditor.itemDirectionExpense',
        defaultMessage: 'Expense',
      }),
    },
  ];

  const cellStyle: React.CSSProperties = {
    padding: `${theme.space.sm}px ${theme.space.md}px`,
    borderBottom: `1px solid ${theme.color.border.subtle}`,
    color: theme.color.text.primary,
  };

  const headerCellStyle: React.CSSProperties = {
    ...cellStyle,
    color: theme.color.text.secondary,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    borderBottom: `1px solid ${theme.color.border.strong}`,
  };

  const inlineInputStyle: React.CSSProperties = {
    backgroundColor: theme.color.surface.raised,
    color: theme.color.text.primary,
    border: `1px solid ${theme.color.border.subtle}`,
    borderRadius: theme.radius.sm,
    padding: `${theme.space.xs}px ${theme.space.sm}px`,
    fontSize: theme.fontSize.md,
    width: '100%',
    boxSizing: 'border-box',
  };

  if (loading) {
    return (
      <div style={{ padding: theme.space['2xl'], color: theme.color.text.secondary }}>
        <FormattedMessage id="screen.planEditor.loading" defaultMessage="Loading…" />
      </div>
    );
  }

  if (error !== null || plan === null) {
    return (
      <div style={{ padding: theme.space['2xl'], color: theme.color.status.danger }}>
        {error ??
          intl.formatMessage({
            id: 'screen.planEditor.error',
            defaultMessage: 'Failed to load plan',
          })}
      </div>
    );
  }

  return (
    <div
      style={{
        padding: theme.space['2xl'],
        maxWidth: 900,
        margin: '0 auto',
        color: theme.color.text.primary,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: theme.space.xl,
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: theme.fontSize['2xl'],
            fontWeight: theme.fontWeight.semibold,
          }}
        >
          <FormattedMessage id="screen.planEditor.title" defaultMessage="Plan Editor" />
        </h1>
        <Button
          variant="primary"
          loading={saving}
          onClick={() => {
            void handleSave();
          }}
        >
          <FormattedMessage id="screen.planEditor.saveButton" defaultMessage="Save" />
        </Button>
      </div>

      {saveError !== null && (
        <p style={{ color: theme.color.status.danger, marginBottom: theme.space.md }}>
          {saveError}
        </p>
      )}

      {/* Plan fields */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: theme.space.lg,
          marginBottom: theme.space['2xl'],
          backgroundColor: theme.color.surface.raised,
          borderRadius: theme.radius.md,
          padding: theme.space.xl,
          border: `1px solid ${theme.color.border.subtle}`,
        }}
      >
        <Input
          id="plan-name"
          label={intl.formatMessage({
            id: 'screen.planEditor.namePlaceholder',
            defaultMessage: 'Plan name',
          })}
          placeholder={intl.formatMessage({
            id: 'screen.planEditor.namePlaceholder',
            defaultMessage: 'Plan name',
          })}
          value={plan.name}
          onChange={(val) => {
            setPlan({ ...plan, name: val });
          }}
        />

        <Select<PlanPeriodKindDto>
          id="plan-period"
          label={intl.formatMessage({
            id: 'screen.planEditor.periodLabel',
            defaultMessage: 'Period',
          })}
          options={periodOptions}
          value={plan.periodKind}
          onChange={(val) => {
            handlePeriodChange(val);
          }}
        />

        {plan.periodKind === 'custom' && (
          <CustomPeriodPicker
            value={{
              startDate: plan.period.start,
              endDate: plan.period.end,
            }}
            onChange={(dates) => {
              void handleCustomDatesChange(dates);
            }}
          />
        )}

        <Input
          id="plan-base-currency"
          label={intl.formatMessage({
            id: 'screen.planEditor.baseCurrencyLabel',
            defaultMessage: 'Base currency',
          })}
          placeholder={intl.formatMessage({
            id: 'screen.planEditor.baseCurrencyPlaceholder',
            defaultMessage: 'e.g. USD',
          })}
          value={plan.baseCurrency}
          onChange={(val) => {
            setPlan({ ...plan, baseCurrency: val });
          }}
        />
      </div>

      {/* Planned items */}
      <div>
        <h2
          style={{
            fontSize: theme.fontSize.lg,
            fontWeight: theme.fontWeight.semibold,
            marginBottom: theme.space.md,
          }}
        >
          <FormattedMessage id="screen.planEditor.itemsTitle" defaultMessage="Planned Items" />
        </h2>

        <div
          style={{
            backgroundColor: theme.color.surface.raised,
            borderRadius: theme.radius.md,
            border: `1px solid ${theme.color.border.subtle}`,
            overflow: 'hidden',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={headerCellStyle}>
                  <FormattedMessage
                    id="screen.planEditor.itemCategoryHeader"
                    defaultMessage="Category"
                  />
                </th>
                <th style={headerCellStyle}>
                  <FormattedMessage
                    id="screen.planEditor.itemDirectionHeader"
                    defaultMessage="Direction"
                  />
                </th>
                <th style={headerCellStyle}>
                  <FormattedMessage
                    id="screen.planEditor.itemAmountHeader"
                    defaultMessage="Amount"
                  />
                </th>
                <th style={headerCellStyle}>
                  <FormattedMessage
                    id="screen.planEditor.itemCurrencyHeader"
                    defaultMessage="Currency"
                  />
                </th>
                <th style={headerCellStyle} />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td style={cellStyle}>
                    {categories.find((c) => c.id === item.categoryId)?.name ?? item.categoryId}
                  </td>
                  {/* UpdatePlannedItemDto has no direction: it is fixed once the item exists. */}
                  <td style={cellStyle}>
                    {directionOptions.find((o) => o.value === item.direction)?.label}
                  </td>
                  <td style={cellStyle}>
                    <input
                      key={`${item.id}:${item.amount.amountMinor}`}
                      type="text"
                      inputMode="decimal"
                      defaultValue={toAmountInput(item)}
                      onBlur={(e) => {
                        const parsed = toMinorUnitsString(e.target.value, item.amount.currency);
                        if (parsed !== null && parsed !== item.amount.amountMinor) {
                          void handleUpdateItem(item, { amountMinor: parsed });
                        }
                      }}
                      aria-label={intl.formatMessage({
                        id: 'screen.planEditor.itemAmountPlaceholder',
                        defaultMessage: 'Amount',
                      })}
                      style={inlineInputStyle}
                    />
                  </td>
                  <td style={cellStyle}>
                    <input
                      key={`${item.id}:${item.amount.currency}`}
                      type="text"
                      defaultValue={item.amount.currency}
                      onBlur={(e) => {
                        if (e.target.value.trim().toUpperCase() !== item.amount.currency) {
                          void handleUpdateItem(item, { currency: e.target.value });
                        }
                      }}
                      aria-label={intl.formatMessage({
                        id: 'screen.planEditor.itemCurrencyPlaceholder',
                        defaultMessage: 'Currency',
                      })}
                      style={inlineInputStyle}
                    />
                  </td>
                  <td style={cellStyle}>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setHistoryDrawer({ planId: id ?? '', itemId: item.id });
                      }}
                    >
                      {intl.formatMessage({
                        id: 'screen.planEditor.historyButton',
                        defaultMessage: 'History',
                      })}
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => {
                        void handleRemoveItem(item.id);
                      }}
                    >
                      <FormattedMessage
                        id="screen.planEditor.removeItemButton"
                        defaultMessage="Remove"
                      />
                    </Button>
                  </td>
                </tr>
              ))}

              {/* New item row */}
              <tr>
                <td style={cellStyle}>
                  <Select<string>
                    id="plan-new-item-category"
                    options={categories
                      .filter((c) => !c.archived && c.kind === draftItem.direction)
                      .map((c) => ({ value: c.id, label: c.name }))}
                    value={draftItem.categoryId}
                    placeholder={intl.formatMessage({
                      id: 'screen.planEditor.itemCategoryPlaceholder',
                      defaultMessage: 'Category',
                    })}
                    onChange={(val) => {
                      setDraftItem((d) => ({ ...d, categoryId: val }));
                    }}
                  />
                </td>
                <td style={cellStyle}>
                  <Select<PlannedItemDirectionDto>
                    options={directionOptions}
                    value={draftItem.direction}
                    onChange={(val) => {
                      // Categories are per kind: a new direction needs a new category.
                      setDraftItem((d) => ({ ...d, direction: val, categoryId: '' }));
                    }}
                  />
                </td>
                <td style={cellStyle}>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={draftItem.amount}
                    placeholder={intl.formatMessage({
                      id: 'screen.planEditor.itemAmountPlaceholder',
                      defaultMessage: 'Amount',
                    })}
                    onChange={(e) => {
                      setDraftItem((d) => ({ ...d, amount: e.target.value }));
                    }}
                    aria-label={intl.formatMessage({
                      id: 'screen.planEditor.itemAmountPlaceholder',
                      defaultMessage: 'Amount',
                    })}
                    style={inlineInputStyle}
                  />
                </td>
                <td style={cellStyle}>
                  <input
                    type="text"
                    value={draftItem.currency}
                    placeholder={intl.formatMessage({
                      id: 'screen.planEditor.itemCurrencyPlaceholder',
                      defaultMessage: 'Currency',
                    })}
                    onChange={(e) => {
                      setDraftItem((d) => ({ ...d, currency: e.target.value }));
                    }}
                    aria-label={intl.formatMessage({
                      id: 'screen.planEditor.itemCurrencyPlaceholder',
                      defaultMessage: 'Currency',
                    })}
                    style={inlineInputStyle}
                  />
                </td>
                <td style={cellStyle}>
                  <Button
                    variant="primary"
                    onClick={() => {
                      void handleAddItem();
                    }}
                  >
                    <FormattedMessage
                      id="screen.planEditor.addItemButton"
                      defaultMessage="Add item"
                    />
                  </Button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      {historyDrawer && (
        <PlannedItemHistoryDrawer
          planId={historyDrawer.planId}
          itemId={historyDrawer.itemId}
          isOpen={historyDrawer !== null}
          currentUserId={settingsStore.userId}
          onClose={() => {
            setHistoryDrawer(null);
          }}
        />
      )}
    </div>
  );
}
