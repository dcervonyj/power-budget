import React from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { useParams } from 'react-router-dom';
import { useTheme } from '../../components/ThemeContext.js';
import { Button } from '../../components/Button.js';
import { Select } from '../../components/Select.js';
import { PlannedItemHistoryDrawer } from '../../components/PlannedItemHistoryDrawer.js';
import { usePlanEditor } from './usePlanEditor.js';
import { PlannedItemRow } from './PlannedItemRow.js';
import { PlanFormFields } from './PlanFormFields.js';
import type { Direction } from './usePlanEditor.js';

export function PlanEditorScreen(): React.JSX.Element {
  const theme = useTheme();
  const intl = useIntl();
  const { id } = useParams<{ id: string }>();

  const {
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
  } = usePlanEditor(id);

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
      <PlanFormFields
        plan={plan}
        onNameChange={(val) => {
          setPlan({ ...plan, name: val });
        }}
        onPeriodChange={handlePeriodChange}
        onCustomDatesChange={handleCustomDatesChange}
        onBaseCurrencyChange={(val) => {
          setPlan({ ...plan, baseCurrency: val });
        }}
      />

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
                <PlannedItemRow
                  key={item.id}
                  item={item}
                  planId={id ?? ''}
                  inlineInputStyle={inlineInputStyle}
                  cellStyle={cellStyle}
                  onUpdate={handleUpdateItem}
                  onRemove={handleRemoveItem}
                  onHistoryClick={(planId, itemId) => {
                    setHistoryDrawer({ planId, itemId });
                  }}
                  onDirectionChange={(changedItem, direction) => {
                    void handleUpdateItem(changedItem, {});
                    setItems((prev) =>
                      prev.map((i) =>
                        i.id === changedItem.id ? { ...i, direction } : i,
                      ),
                    );
                  }}
                />
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
