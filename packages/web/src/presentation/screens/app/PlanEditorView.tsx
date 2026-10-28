import React from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import {
  EMPTY_MATCH_HINT_FORM,
  type MatchHintField,
  type MatchHintFormValues,
} from '@power-budget/core';
import type { SelectOption } from '@power-budget/shared-app';
import type {
  PlanDto,
  PlanPeriodKindDto,
  PlannedItemDirectionDto,
} from '@power-budget/shared-app/contract';
import type { PlanTotals } from '../../../application/plans/PlanTotals.js';
import { Button } from '../../components/Button.js';
import { CustomPeriodPicker, type CustomPeriodValue } from '../../components/CustomPeriodPicker.js';
import { Input } from '../../components/Input.js';
import { MatchHintFields } from '../../components/MatchHintFields.js';
import { Select } from '../../components/Select.js';
import { ErrorBanner } from '../../components/shared/ErrorBanner.js';
import { AmountText } from '../../glass/atoms/AmountText.js';
import { StatusTag } from '../../glass/atoms/StatusTag.js';
import { GlassPanel } from '../../glass/material/GlassPanel.js';
import { formatIsoDate } from '../../i18n/formatAmount.js';
import {
  PlanIncomeList,
  PlanLimitList,
  type PlanItemRowHandlers,
  type PlanItemRowModel,
} from './PlanItemRows.js';
import {
  CAPTION_STYLE,
  FIELD_INPUT_STYLE,
  GRID_STYLE,
  HEADER_STYLE,
  PAGE_STYLE,
  PANEL_CONTENT_STYLE,
  PANEL_TITLE_STYLE,
  TITLE_STYLE,
} from './planStyles.js';

/** What the user typed into the new-item row. */
export interface PlanDraftItem {
  readonly categoryId: string;
  readonly direction: PlannedItemDirectionDto;
  readonly amount: string;
  readonly currency: string;
  readonly matchHint: MatchHintFormValues;
}

/** Which fields of the new-item row failed the last "Add item" attempt. */
export interface PlanDraftErrors {
  readonly category: boolean;
  readonly amount: boolean;
  readonly currency: boolean;
  readonly matchHint: readonly MatchHintField[];
}

export const NO_DRAFT_ERRORS: PlanDraftErrors = {
  category: false,
  amount: false,
  currency: false,
  matchHint: [],
};

export const EMPTY_DRAFT_MATCH_HINT = EMPTY_MATCH_HINT_FORM;

export interface PlanEditorViewProps extends PlanItemRowHandlers {
  readonly plan: PlanDto;
  readonly totals: PlanTotals;
  readonly income: readonly PlanItemRowModel[];
  readonly limits: readonly PlanItemRowModel[];
  readonly draft: PlanDraftItem;
  readonly draftErrors: PlanDraftErrors;
  readonly draftCategories: readonly SelectOption[];
  readonly saving: boolean;
  readonly saveError: string | null;
  readonly onNameChange: (name: string) => void;
  readonly onBaseCurrencyChange: (currency: string) => void;
  readonly onPeriodKindChange: (kind: PlanPeriodKindDto) => void;
  readonly onCustomDatesChange: (dates: CustomPeriodValue) => void;
  readonly onDraftChange: (draft: PlanDraftItem) => void;
  readonly onAddItem: () => void;
  readonly onSave: () => void;
}

const SEPARATOR = ' · ';

const TILE_GRID: React.CSSProperties = {
  ...GRID_STYLE,
  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
};

const TILE_CONTENT: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--pb-glass-space-xs)',
  alignItems: 'flex-start',
  padding: 'var(--pb-glass-space-lg) var(--pb-glass-space-xl)',
};

const FIELD_ERROR_STYLE: React.CSSProperties = {
  margin: 0,
  color: 'var(--pb-glass-over)',
  fontSize: 'var(--pb-glass-type-small-web, 14px)',
};

const FORM_GRID: React.CSSProperties = {
  ...GRID_STYLE,
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  alignItems: 'end',
};

export function PlanEditorView(props: PlanEditorViewProps): React.JSX.Element {
  const { plan, totals, income, limits, saving, saveError, onSave } = props;
  const intl = useIntl();

  return (
    <div style={PAGE_STYLE}>
      <header style={HEADER_STYLE}>
        <div>
          <h1 style={TITLE_STYLE}>
            <FormattedMessage id="screen.planEditor.title" defaultMessage="Plan Editor" />
          </h1>
          <p style={CAPTION_STYLE}>
            {plan.name}
            {SEPARATOR}
            <FormattedMessage
              id="plan.list.period"
              defaultMessage="{start} – {end}"
              values={{
                start: formatIsoDate(plan.period.start, intl.locale),
                end: formatIsoDate(plan.period.end, intl.locale),
              }}
            />
          </p>
        </div>
        <Button variant="primary" loading={saving} onClick={onSave}>
          <FormattedMessage id="screen.planEditor.saveButton" defaultMessage="Save" />
        </Button>
      </header>

      {saveError !== null && <ErrorBanner message={saveError} />}

      <PlanTotalsTiles totals={totals} />

      <GlassPanel material="frosted" depth={1} contentStyle={PANEL_CONTENT_STYLE}>
        <PlanDetails {...props} />
      </GlassPanel>

      <GlassPanel material="frosted" depth={1} contentStyle={PANEL_CONTENT_STYLE}>
        <h2 style={PANEL_TITLE_STYLE}>
          <FormattedMessage id="plan.editor.income.title" defaultMessage="Income" />
        </h2>
        {income.length === 0 ? (
          <p style={CAPTION_STYLE}>
            <FormattedMessage
              id="plan.editor.income.empty"
              defaultMessage="No income planned yet"
            />
          </p>
        ) : (
          <PlanIncomeList rows={income} {...props} />
        )}
      </GlassPanel>

      <GlassPanel material="frosted" depth={1} contentStyle={PANEL_CONTENT_STYLE}>
        <h2 style={PANEL_TITLE_STYLE}>
          <FormattedMessage id="plan.editor.limits.title" defaultMessage="Category limits" />
        </h2>
        {limits.length === 0 ? (
          <p style={CAPTION_STYLE}>
            <FormattedMessage
              id="plan.editor.limits.empty"
              defaultMessage="No category limits yet"
            />
          </p>
        ) : (
          <PlanLimitList rows={limits} {...props} />
        )}
      </GlassPanel>

      <GlassPanel material="frosted" depth={2} contentStyle={PANEL_CONTENT_STYLE}>
        <h2 style={PANEL_TITLE_STYLE}>
          <FormattedMessage id="plan.editor.addItem.title" defaultMessage="Add an item" />
        </h2>
        <NewItemRow {...props} />
      </GlassPanel>
    </div>
  );
}

function PlanTotalsTiles({ totals }: { totals: PlanTotals }): React.JSX.Element {
  const intl = useIntl();
  const over = totals.leftMinor < 0n;

  return (
    <section
      aria-label={intl.formatMessage({
        id: 'plan.editor.totals.label',
        defaultMessage: 'Plan totals',
      })}
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--pb-glass-space-xs)' }}
    >
      <div style={TILE_GRID}>
        <Tile
          label={intl.formatMessage({ id: 'plan.editor.totals.income', defaultMessage: 'Income' })}
          amountMinor={totals.incomeMinor}
          currency={totals.currency}
        />
        <Tile
          label={intl.formatMessage({
            id: 'plan.editor.totals.planned',
            defaultMessage: 'Planned',
          })}
          amountMinor={totals.expensesMinor}
          currency={totals.currency}
        />
        <Tile
          label={intl.formatMessage({
            id: 'plan.editor.totals.left',
            defaultMessage: 'Left to plan',
          })}
          amountMinor={totals.leftMinor}
          currency={totals.currency}
          tag={
            <StatusTag
              kind={over ? 'over' : 'ok'}
              label={
                over
                  ? intl.formatMessage({
                      id: 'plan.editor.totals.overIncome',
                      defaultMessage: 'Over income',
                    })
                  : intl.formatMessage({
                      id: 'plan.editor.totals.withinIncome',
                      defaultMessage: 'Within income',
                    })
              }
            />
          }
        />
      </div>
      {totals.excludedCount > 0 && (
        <p style={CAPTION_STYLE}>
          <FormattedMessage
            id="plan.editor.totals.excluded"
            defaultMessage="{count, plural, one {# item in another currency is not counted} other {# items in other currencies are not counted}}"
            values={{ count: totals.excludedCount }}
          />
        </p>
      )}
    </section>
  );
}

function Tile({
  label,
  amountMinor,
  currency,
  tag,
}: {
  label: string;
  amountMinor: bigint;
  currency: string;
  tag?: React.ReactNode;
}): React.JSX.Element {
  return (
    <GlassPanel
      material="frosted"
      depth={2}
      radius="var(--pb-glass-radius-tile)"
      contentStyle={TILE_CONTENT}
    >
      <span style={CAPTION_STYLE}>{label}</span>
      <AmountText amount={{ amountMinor, currency }} size="figure" />
      {tag}
    </GlassPanel>
  );
}

function PlanDetails({
  plan,
  onNameChange,
  onBaseCurrencyChange,
  onPeriodKindChange,
  onCustomDatesChange,
}: PlanEditorViewProps): React.JSX.Element {
  const intl = useIntl();
  const periodOptions: ReadonlyArray<SelectOption<PlanPeriodKindDto>> = [
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
  const nameLabel = intl.formatMessage({
    id: 'screen.planEditor.namePlaceholder',
    defaultMessage: 'Plan name',
  });

  return (
    <>
      <h2 style={PANEL_TITLE_STYLE}>
        <FormattedMessage id="plan.editor.details.title" defaultMessage="Plan details" />
      </h2>
      <div style={FORM_GRID}>
        <Input
          id="plan-name"
          label={nameLabel}
          placeholder={nameLabel}
          value={plan.name}
          onChange={onNameChange}
        />
        <Select<PlanPeriodKindDto>
          id="plan-period"
          label={intl.formatMessage({
            id: 'screen.planEditor.periodLabel',
            defaultMessage: 'Period',
          })}
          options={periodOptions}
          value={plan.periodKind}
          onChange={onPeriodKindChange}
        />
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
          onChange={onBaseCurrencyChange}
        />
      </div>
      {plan.periodKind === 'custom' && (
        <CustomPeriodPicker
          value={{ startDate: plan.period.start, endDate: plan.period.end }}
          onChange={onCustomDatesChange}
        />
      )}
    </>
  );
}

function NewItemRow({
  draft,
  draftErrors,
  draftCategories,
  onDraftChange,
  onAddItem,
}: PlanEditorViewProps): React.JSX.Element {
  const intl = useIntl();
  const directionOptions: ReadonlyArray<SelectOption<PlannedItemDirectionDto>> = [
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
  const amountLabel = intl.formatMessage({
    id: 'screen.planEditor.itemAmountPlaceholder',
    defaultMessage: 'Amount',
  });
  const currencyLabel = intl.formatMessage({
    id: 'screen.planEditor.itemCurrencyPlaceholder',
    defaultMessage: 'Currency',
  });

  return (
    <>
      <div style={FORM_GRID}>
        <Select<PlannedItemDirectionDto>
          options={directionOptions}
          value={draft.direction}
          label={intl.formatMessage({
            id: 'screen.planEditor.itemDirectionHeader',
            defaultMessage: 'Direction',
          })}
          id="plan-new-item-direction"
          onChange={(direction) => {
            // Categories are per kind: a new direction needs a new category.
            onDraftChange({ ...draft, direction, categoryId: '' });
          }}
        />
        <Select<string>
          id="plan-new-item-category"
          options={draftCategories}
          value={draft.categoryId}
          label={intl.formatMessage({
            id: 'screen.planEditor.itemCategoryHeader',
            defaultMessage: 'Category',
          })}
          placeholder={intl.formatMessage({
            id: 'screen.planEditor.itemCategoryPlaceholder',
            defaultMessage: 'Category',
          })}
          onChange={(categoryId) => {
            onDraftChange({ ...draft, categoryId });
          }}
        />
        <input
          type="text"
          inputMode="decimal"
          value={draft.amount}
          placeholder={amountLabel}
          aria-label={amountLabel}
          aria-invalid={draftErrors.amount}
          className="pbg-ctl pbg-ctl-field"
          style={FIELD_INPUT_STYLE}
          onChange={(event) => {
            onDraftChange({ ...draft, amount: event.target.value });
          }}
        />
        <input
          type="text"
          value={draft.currency}
          placeholder={currencyLabel}
          aria-label={currencyLabel}
          aria-invalid={draftErrors.currency}
          className="pbg-ctl pbg-ctl-field"
          style={FIELD_INPUT_STYLE}
          onChange={(event) => {
            onDraftChange({ ...draft, currency: event.target.value });
          }}
        />
        <Button variant="primary" onClick={onAddItem}>
          <FormattedMessage id="screen.planEditor.addItemButton" defaultMessage="Add item" />
        </Button>
      </div>
      <h3 style={PANEL_TITLE_STYLE}>
        <FormattedMessage id="plan.matchHint.title" defaultMessage="Match hint" />
      </h3>
      <p style={CAPTION_STYLE}>
        <FormattedMessage
          id="plan.matchHint.description"
          defaultMessage="Helps match bank transactions to this item automatically."
        />
      </p>
      <MatchHintFields
        idPrefix="plan-new-item-hint"
        values={draft.matchHint}
        invalid={draftErrors.matchHint}
        onChange={(matchHint) => {
          onDraftChange({ ...draft, matchHint });
        }}
      />
      {draftErrors.matchHint.length > 0 && (
        <p role="alert" style={FIELD_ERROR_STYLE}>
          <FormattedMessage
            id="plan.matchHint.invalid"
            defaultMessage="Check the highlighted hint fields. A tolerance needs an amount, and a day window needs a day."
          />
        </p>
      )}
      {draftErrors.category && (
        <p role="alert" style={FIELD_ERROR_STYLE}>
          <FormattedMessage
            id="screen.planEditor.fieldError.category"
            defaultMessage="Choose a category for the item."
          />
        </p>
      )}
      {draftErrors.amount && (
        <p role="alert" style={FIELD_ERROR_STYLE}>
          <FormattedMessage
            id="screen.planEditor.fieldError.amount"
            defaultMessage="Enter a valid amount, for example 250.50."
          />
        </p>
      )}
      {draftErrors.currency && (
        <p role="alert" style={FIELD_ERROR_STYLE}>
          <FormattedMessage
            id="screen.planEditor.fieldError.currency"
            defaultMessage="Enter a supported currency code, for example PLN."
          />
        </p>
      )}
    </>
  );
}
