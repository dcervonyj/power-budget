import React, { useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import {
  matchHintToFormValues,
  parseMatchHintForm,
  type MatchHintField,
  type MatchHintWire,
} from '@power-budget/core';
import type { CategoryRowData } from '@power-budget/shared-app';
import type { PlannedItemDirectionDto } from '@power-budget/shared-app/contract';
import {
  stepMinorUnits,
  toMinorUnitsString,
  toSteppableMinor,
} from '../../../application/plans/PlanAmounts.js';
import { Button } from '../../components/Button.js';
import { MatchHintFields } from '../../components/MatchHintFields.js';
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
  readonly matchHint: MatchHintWire | null;
}

/** The amount and currency of a planned item; PATCH sends them together. */
export interface PlanItemChange {
  readonly amountMinor?: string;
  readonly currency?: string;
  /** null clears the match hint. */
  readonly matchHint?: MatchHintWire | null;
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

const HINT_SUMMARY_STYLE: React.CSSProperties = {
  cursor: 'pointer',
  color: 'var(--pb-glass-dim)',
  fontSize: 'var(--pb-glass-type-small-web)',
};

const HINT_BODY_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--pb-glass-space-sm)',
  paddingTop: 'var(--pb-glass-space-sm)',
};

const HINT_NOTE_STYLE: React.CSSProperties = {
  margin: 0,
  color: 'var(--pb-glass-dim)',
  fontSize: 'var(--pb-glass-type-small-web)',
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
          <MatchHintEditor row={row} onChange={handlers.onChange} />
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
      <MatchHintEditor row={row} onChange={handlers.onChange} />
    </>
  );
}

/** The item's match hint: edited in place, saved with the button (empty fields clear it). */
function MatchHintEditor({
  row,
  onChange,
}: {
  readonly row: PlanItemRowModel;
  readonly onChange: PlanItemRowHandlers['onChange'];
}): React.JSX.Element {
  const intl = useIntl();
  const stored = matchHintToFormValues(row.matchHint, row.currency);
  const [values, setValues] = useState(stored);
  const [invalid, setInvalid] = useState<readonly MatchHintField[]>([]);

  const save = (): void => {
    const result = parseMatchHintForm(values, row.currency);
    if (result.kind === 'invalid') {
      setInvalid(result.fields);

      return;
    }
    setInvalid([]);
    onChange(row.id, { matchHint: result.kind === 'ok' ? result.hint : null });
  };

  return (
    <details>
      <summary style={HINT_SUMMARY_STYLE}>
        <FormattedMessage id="plan.matchHint.title" defaultMessage="Match hint" />
      </summary>
      <div style={HINT_BODY_STYLE}>
        <p style={HINT_NOTE_STYLE}>
          <FormattedMessage
            id="plan.matchHint.description"
            defaultMessage="Helps match bank transactions to this item automatically."
          />
        </p>
        <MatchHintFields
          idPrefix={`plan-item-${row.id}-hint`}
          values={values}
          invalid={invalid}
          onChange={(next) => {
            setValues(next);
            setInvalid([]);
          }}
        />
        {invalid.length > 0 && (
          <p role="alert" style={HINT_NOTE_STYLE}>
            {intl.formatMessage({
              id: 'plan.matchHint.invalid',
              defaultMessage:
                'Check the highlighted hint fields. A tolerance needs an amount, and a day window needs a day.',
            })}
          </p>
        )}
        <div>
          <Button variant="secondary" onClick={save}>
            <FormattedMessage id="plan.matchHint.save" defaultMessage="Save hint" />
          </Button>
        </div>
      </div>
    </details>
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
