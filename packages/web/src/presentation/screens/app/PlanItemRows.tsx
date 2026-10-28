import React from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import type { CategoryRowData } from '@power-budget/shared-app';
import type { PlannedItemDirectionDto } from '@power-budget/shared-app/contract';
import {
  stepMinorUnits,
  toMinorUnitsString,
  toSteppableMinor,
} from '../../../application/plans/PlanAmounts.js';
import { Button } from '../../components/Button.js';
import { Stepper } from '../../glass/controls/Stepper.js';
import { CategoryRow } from '../../glass/rows/CategoryRow.js';
import { formatAmount } from '../../i18n/formatAmount.js';
import { FIELD_INPUT_STYLE } from './planStyles.js';

/** One planned item as the editor shows it. */
export interface PlanItemRowModel {
  readonly id: string;
  readonly name: string;
  readonly direction: PlannedItemDirectionDto;
  readonly amountMinor: string;
  readonly currency: string;
  /** The amount in major units for the input ("3000.00"). */
  readonly amountInput: string;
  /** Spent so far, in the plan currency; null when the dashboard is not available. */
  readonly spentMinor: bigint | null;
}

/** The amount and currency of a planned item; PATCH sends them together. */
export interface PlanItemChange {
  readonly amountMinor?: string;
  readonly currency?: string;
}

export interface PlanItemRowHandlers {
  readonly onChange: (id: string, change: PlanItemChange) => void;
  readonly onInvalidAmount: (id: string) => void;
  readonly onHistory: (id: string) => void;
  readonly onRemove: (id: string) => void;
}

interface RowProps extends PlanItemRowHandlers {
  readonly row: PlanItemRowModel;
}

const LIST_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--pb-glass-space-sm)',
  listStyle: 'none',
  margin: 0,
  padding: 0,
};

const ITEM_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--pb-glass-space-xs)',
};

const CONTROLS_STYLE: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 'var(--pb-glass-space-xs)',
};

const NAME_STYLE: React.CSSProperties = {
  flex: '1 1 140px',
  fontSize: 'var(--pb-glass-type-label-web)',
  fontWeight: 'var(--pb-glass-type-label-weight)',
  overflowWrap: 'anywhere',
};

export function PlanLimitList({
  rows,
  ...handlers
}: PlanItemRowHandlers & { readonly rows: readonly PlanItemRowModel[] }): React.JSX.Element {
  return (
    <ul style={LIST_STYLE}>
      {rows.map((row, index) => (
        <li key={row.id} style={ITEM_STYLE}>
          <LimitRow row={row} index={index} {...handlers} />
        </li>
      ))}
    </ul>
  );
}

export function PlanIncomeList({
  rows,
  ...handlers
}: PlanItemRowHandlers & { readonly rows: readonly PlanItemRowModel[] }): React.JSX.Element {
  return (
    <ul style={LIST_STYLE}>
      {rows.map((row) => (
        <li key={row.id} style={ITEM_STYLE}>
          <div style={CONTROLS_STYLE}>
            <span style={NAME_STYLE}>{row.name}</span>
            <ItemControls row={row} {...handlers} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function LimitRow({ row, index, ...handlers }: RowProps & { index: number }): React.JSX.Element {
  const intl = useIntl();
  const step = stepMinorUnits(row.currency);
  const value = toSteppableMinor(row.amountMinor);
  const category = toCategoryRowData(row);

  return (
    <>
      {category === null ? (
        <span style={NAME_STYLE}>{row.name}</span>
      ) : (
        <CategoryRow category={category} index={index} />
      )}
      <div style={CONTROLS_STYLE}>
        {step === null || value === null ? null : (
          <Stepper
            value={value}
            step={step}
            min={0}
            label={intl.formatMessage(
              { id: 'plan.editor.limit.label', defaultMessage: '{category} limit' },
              { category: row.name },
            )}
            decrementLabel={intl.formatMessage(
              { id: 'plan.editor.limit.decrease', defaultMessage: 'Decrease the {category} limit' },
              { category: row.name },
            )}
            incrementLabel={intl.formatMessage(
              { id: 'plan.editor.limit.increase', defaultMessage: 'Increase the {category} limit' },
              { category: row.name },
            )}
            formatValue={(next) =>
              formatAmount({ amountMinor: BigInt(next), currency: row.currency }, intl.locale)
            }
            onChange={(next) => {
              handlers.onChange(row.id, { amountMinor: String(next) });
            }}
          />
        )}
        <ItemControls row={row} {...handlers} />
      </div>
    </>
  );
}

/** Amount and currency inputs (keyboard entry), history and remove: the same for every item. */
function ItemControls({
  row,
  onChange,
  onInvalidAmount,
  onHistory,
  onRemove,
}: RowProps): React.JSX.Element {
  const intl = useIntl();

  return (
    <>
      <input
        key={`${row.id}:${row.amountMinor}`}
        type="text"
        inputMode="decimal"
        defaultValue={row.amountInput}
        onBlur={(event) => {
          const parsed = toMinorUnitsString(event.target.value, row.currency);
          if (parsed === null) {
            // Put the stored amount back, so the field never shows a value that was dropped.
            event.target.value = row.amountInput;
            onInvalidAmount(row.id);
          } else if (parsed !== row.amountMinor) {
            onChange(row.id, { amountMinor: parsed });
          }
        }}
        aria-label={intl.formatMessage({
          id: 'screen.planEditor.itemAmountPlaceholder',
          defaultMessage: 'Amount',
        })}
        className="pbg-ctl pbg-ctl-field"
        style={{ ...FIELD_INPUT_STYLE, width: 128 }}
      />
      <input
        key={`${row.id}:${row.currency}`}
        type="text"
        defaultValue={row.currency}
        onBlur={(event) => {
          if (event.target.value.trim().toUpperCase() !== row.currency) {
            onChange(row.id, { currency: event.target.value });
          }
        }}
        aria-label={intl.formatMessage({
          id: 'screen.planEditor.itemCurrencyPlaceholder',
          defaultMessage: 'Currency',
        })}
        className="pbg-ctl pbg-ctl-field"
        style={{ ...FIELD_INPUT_STYLE, width: 88 }}
      />
      <Button
        variant="secondary"
        onClick={() => {
          onHistory(row.id);
        }}
      >
        <FormattedMessage id="screen.planEditor.historyButton" defaultMessage="History" />
      </Button>
      <Button
        variant="danger"
        onClick={() => {
          onRemove(row.id);
        }}
      >
        <FormattedMessage id="screen.planEditor.removeItemButton" defaultMessage="Remove" />
      </Button>
    </>
  );
}

function toCategoryRowData(row: PlanItemRowModel): CategoryRowData | null {
  const planned = parseMinor(row.amountMinor);
  if (row.spentMinor === null || planned === null) {
    return null;
  }

  return {
    id: row.id,
    label: row.name,
    spentMinor: row.spentMinor,
    plannedMinor: planned,
    currency: row.currency,
    status: row.spentMinor > planned ? 'over' : 'ok',
    paid: false,
  };
}

function parseMinor(amountMinor: string): bigint | null {
  return /^-?\d+$/.test(amountMinor) ? BigInt(amountMinor) : null;
}
