import React, { useEffect, useState, useCallback } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { useParams } from 'react-router-dom';
import { useTheme } from '../../components/ThemeContext.js';
import { Button } from '../../components/Button.js';
import { Input } from '../../components/Input.js';
import { Select } from '../../components/Select.js';
import { CustomPeriodPicker } from '../../components/CustomPeriodPicker.js';
import type { CustomPeriodValue } from '../../components/CustomPeriodPicker.js';
import { apiClient } from '../../../AppProviders.js';
import { PlannedItemHistoryDrawer } from '../../components/PlannedItemHistoryDrawer.js';

type PlanPeriod = 'weekly' | 'monthly' | 'custom';
type PlanStatus = 'active' | 'draft' | 'archived';
type Direction = 'income' | 'expense';

interface Plan {
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

interface PlannedItem {
  id: string;
  planId: string;
  categoryId: string;
  categoryName?: string;
  direction: Direction;
  amountMinor: number;
  currency: string;
  version: number;
}

interface DraftItem {
  draftId: string;
  categoryId: string;
  direction: Direction;
  amountMinor: string;
  currency: string;
}

export function PlanEditorScreen(): React.JSX.Element {
  const theme = useTheme();
  const intl = useIntl();
  const { id } = useParams<{ id: string }>();

  const [plan, setPlan] = useState<Plan | null>(null);
  const [items, setItems] = useState<PlannedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [historyDrawer, setHistoryDrawer] = useState<{ planId: string; itemId: string } | null>(null);

  // Draft new item
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

  const handleCustomDatesChange = async (dates: CustomPeriodValue): Promise<void> => {
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

  const periodOptions: ReadonlyArray<{ value: PlanPeriod; label: string }> = [
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

  const directionOptions: ReadonlyArray<{ value: Direction; label: string }> = [
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

        <Select<PlanPeriod>
          id="plan-period"
          label={intl.formatMessage({
            id: 'screen.planEditor.periodLabel',
            defaultMessage: 'Period',
          })}
          options={periodOptions}
          value={plan.period}
          onChange={(val) => {
            void handlePeriodChange(val);
          }}
        />

        {plan.period === 'custom' && (
          <CustomPeriodPicker
            value={{
              startDate: plan.startDate ?? '',
              endDate: plan.endDate ?? '',
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
                  <td style={cellStyle}>{item.categoryName ?? item.categoryId}</td>
                  <td style={cellStyle}>
                    <Select<Direction>
                      options={directionOptions}
                      value={item.direction}
                      onChange={(val) => {
                        void handleUpdateItem(item, {});
                        setItems((prev) =>
                          prev.map((i) => (i.id === item.id ? { ...i, direction: val } : i)),
                        );
                      }}
                    />
                  </td>
                  <td style={cellStyle}>
                    <input
                      type="number"
                      value={item.amountMinor}
                      onChange={(e) => {
                        const parsed = parseInt(e.target.value, 10);
                        if (!isNaN(parsed)) {
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
                      type="text"
                      value={item.currency}
                      onChange={(e) => {
                        void handleUpdateItem(item, { currency: e.target.value });
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
                      📋
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
                  <input
                    type="text"
                    value={draftItem.categoryId}
                    placeholder={intl.formatMessage({
                      id: 'screen.planEditor.itemCategoryPlaceholder',
                      defaultMessage: 'Category',
                    })}
                    onChange={(e) => {
                      setDraftItem((d) => ({ ...d, categoryId: e.target.value }));
                    }}
                    aria-label={intl.formatMessage({
                      id: 'screen.planEditor.itemCategoryPlaceholder',
                      defaultMessage: 'Category',
                    })}
                    style={inlineInputStyle}
                  />
                </td>
                <td style={cellStyle}>
                  <Select<Direction>
                    options={directionOptions}
                    value={draftItem.direction}
                    onChange={(val) => {
                      setDraftItem((d) => ({ ...d, direction: val }));
                    }}
                  />
                </td>
                <td style={cellStyle}>
                  <input
                    type="number"
                    value={draftItem.amountMinor}
                    placeholder={intl.formatMessage({
                      id: 'screen.planEditor.itemAmountPlaceholder',
                      defaultMessage: 'Amount',
                    })}
                    onChange={(e) => {
                      setDraftItem((d) => ({ ...d, amountMinor: e.target.value }));
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
          onClose={() => {
            setHistoryDrawer(null);
          }}
        />
      )}
    </div>
  );
}
