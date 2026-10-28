import React from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { useIntl } from 'react-intl';
import type { SelectOption } from '@power-budget/shared-app';
import type { PlanDto, PlannedItemDirectionDto } from '@power-budget/shared-app/contract';
import { Button } from '../../../components/Button.js';
import { CustomPeriodPicker } from '../../../components/CustomPeriodPicker.js';
import { Input } from '../../../components/Input.js';
import { Select } from '../../../components/Select.js';
import { AmountText } from '../../../glass/atoms/AmountText.js';
import { StatusTag } from '../../../glass/atoms/StatusTag.js';
import { SegmentedControl } from '../../../glass/controls/SegmentedControl.js';
import { GlassPanel } from '../../../glass/material/GlassPanel.js';
import { BODY_FONT, TOUCH_TARGET } from '../../../glass/controls/fonts.js';
import { makeStyles, useGlass } from '../../../theme/index.js';
import { PlanIncomeList, PlanLimitList } from './PlanItemRows.js';
import type { PlanDraftItem, PlanItemHandlers, PlanItemRowModel } from './planModels.js';
import type { PlanTotals } from './planAmounts.js';
import { formatPlanPeriod } from './planText.js';
import { usePlanStyles } from './planStyles.js';

export const PLAN_CURRENCIES: readonly string[] = ['USD', 'EUR', 'PLN', 'GBP', 'UAH', 'RUB'];

export interface PlanEditorViewProps extends PlanItemHandlers {
  readonly plan: PlanDto;
  readonly totals: PlanTotals;
  readonly income: readonly PlanItemRowModel[];
  readonly limits: readonly PlanItemRowModel[];
  readonly draft: PlanDraftItem;
  readonly draftCategories: readonly SelectOption[];
  readonly saving: boolean;
  readonly adding: boolean;
  readonly categoriesFailed: boolean;
  readonly onRetryCategories: () => void;
  readonly saveError: string | null;
  readonly onNameChange: (name: string) => void;
  readonly onBaseCurrencyChange: (currency: string) => void;
  readonly onCustomDatesChange: (start: string, end: string) => void;
  readonly onDraftChange: (draft: PlanDraftItem) => void;
  readonly onAddItem: () => void;
  readonly onSave: () => void;
  readonly onArchive: () => void;
}

const useStyles = makeStyles((glass) => ({
  tile: { gap: glass.space.xxs, padding: glass.space.lg, alignItems: 'flex-start' },
  tiles: { gap: glass.space.sm },
  amountInput: {
    minHeight: TOUCH_TARGET,
    paddingHorizontal: glass.space.md,
    borderRadius: glass.radius.control,
    borderWidth: 1,
    borderColor: glass.colors.sep,
    backgroundColor: glass.colors.clear,
    color: glass.colors.fg,
    fontFamily: BODY_FONT,
    fontSize: glass.type.body.mobile,
    marginBottom: glass.space.md,
  },
}));

export function PlanEditorView(props: PlanEditorViewProps): React.JSX.Element {
  const { plan, totals, income, limits, saving, saveError, onSave, onArchive } = props;
  const intl = useIntl();
  const shared = usePlanStyles();
  const summary = `${plan.name} · ${formatPlanPeriod(intl, plan.period.start, plan.period.end)}`;

  return (
    <ScrollView contentContainerStyle={shared.page} keyboardShouldPersistTaps="handled">
      <Text style={shared.caption}>{summary}</Text>

      {saveError === null ? null : (
        <GlassPanel material="tinted" depth={1} contentStyle={shared.panelContent}>
          <Text accessibilityRole="alert" style={shared.noticeText}>
            {saveError}
          </Text>
        </GlassPanel>
      )}

      <PlanTotalsTiles totals={totals} />

      <GlassPanel material="frosted" depth={1} contentStyle={shared.panelContent}>
        <PlanDetails {...props} />
        <Button variant="primary" loading={saving} onPress={onSave}>
          {intl.formatMessage({ id: 'plan.editor.save', defaultMessage: 'Save' })}
        </Button>
      </GlassPanel>

      <GlassPanel material="frosted" depth={1} contentStyle={shared.panelContent}>
        <Text accessibilityRole="header" style={shared.panelTitle}>
          {intl.formatMessage({ id: 'plan.editor.income.title', defaultMessage: 'Income' })}
        </Text>
        {income.length === 0 ? (
          <Text style={shared.caption}>
            {intl.formatMessage({
              id: 'plan.editor.income.empty',
              defaultMessage: 'No income planned yet',
            })}
          </Text>
        ) : (
          <PlanIncomeList rows={income} {...props} />
        )}
      </GlassPanel>

      <GlassPanel material="frosted" depth={1} contentStyle={shared.panelContent}>
        <Text accessibilityRole="header" style={shared.panelTitle}>
          {intl.formatMessage({
            id: 'plan.editor.limits.title',
            defaultMessage: 'Category limits',
          })}
        </Text>
        {limits.length === 0 ? (
          <Text style={shared.caption}>
            {intl.formatMessage({
              id: 'plan.editor.limits.empty',
              defaultMessage: 'No category limits yet',
            })}
          </Text>
        ) : (
          <PlanLimitList rows={limits} {...props} />
        )}
      </GlassPanel>

      <GlassPanel material="frosted" depth={2} contentStyle={shared.panelContent}>
        <Text accessibilityRole="header" style={shared.panelTitle}>
          {intl.formatMessage({ id: 'plan.editor.addItem.title', defaultMessage: 'Add an item' })}
        </Text>
        <NewItemForm {...props} />
      </GlassPanel>

      <Button variant="danger" onPress={onArchive}>
        {intl.formatMessage({ id: 'plan.editor.archive', defaultMessage: 'Archive plan' })}
      </Button>
    </ScrollView>
  );
}

function PlanTotalsTiles({ totals }: { readonly totals: PlanTotals }): React.JSX.Element {
  const intl = useIntl();
  const shared = usePlanStyles();
  const styles = useStyles();
  const over = totals.leftMinor < 0n;

  return (
    <View
      accessibilityLabel={intl.formatMessage({
        id: 'plan.editor.totals.label',
        defaultMessage: 'Plan totals',
      })}
      style={styles.tiles}
    >
      <Tile
        label={intl.formatMessage({ id: 'plan.editor.totals.income', defaultMessage: 'Income' })}
        amountMinor={totals.incomeMinor}
        currency={totals.currency}
      />
      <Tile
        label={intl.formatMessage({ id: 'plan.editor.totals.planned', defaultMessage: 'Planned' })}
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
      {totals.excludedCount > 0 ? (
        <Text style={shared.caption}>
          {intl.formatMessage(
            {
              id: 'plan.editor.totals.excluded',
              defaultMessage:
                '{count, plural, one {# item in another currency is not counted} other {# items in other currencies are not counted}}',
            },
            { count: totals.excludedCount },
          )}
        </Text>
      ) : null}
    </View>
  );
}

function Tile({
  label,
  amountMinor,
  currency,
  tag,
}: {
  readonly label: string;
  readonly amountMinor: bigint;
  readonly currency: string;
  readonly tag?: React.ReactNode;
}): React.JSX.Element {
  const shared = usePlanStyles();
  const styles = useStyles();
  const glass = useGlass();

  return (
    <GlassPanel material="frosted" depth={2} radius={glass.radius.tile} contentStyle={styles.tile}>
      <Text style={shared.caption}>{label}</Text>
      <AmountText amount={{ amountMinor, currency }} size="figure" />
      {tag}
    </GlassPanel>
  );
}

function PlanDetails({
  plan,
  onNameChange,
  onBaseCurrencyChange,
  onCustomDatesChange,
}: PlanEditorViewProps): React.JSX.Element {
  const intl = useIntl();
  const shared = usePlanStyles();
  const nameLabel = intl.formatMessage({ id: 'plan.field.name', defaultMessage: 'Plan name' });
  const periodOptions: ReadonlyArray<{ value: PlanDto['periodKind']; label: string }> = [
    {
      value: 'weekly',
      label: intl.formatMessage({ id: 'plan.periodKind.weekly', defaultMessage: 'Weekly' }),
    },
    {
      value: 'monthly',
      label: intl.formatMessage({ id: 'plan.periodKind.monthly', defaultMessage: 'Monthly' }),
    },
    {
      value: 'custom',
      label: intl.formatMessage({ id: 'plan.periodKind.custom', defaultMessage: 'Custom' }),
    },
  ];

  return (
    <>
      <Text accessibilityRole="header" style={shared.panelTitle}>
        {intl.formatMessage({ id: 'plan.editor.details.title', defaultMessage: 'Plan details' })}
      </Text>
      <Input label={nameLabel} value={plan.name} onChangeText={onNameChange} />
      <SegmentedControl<PlanDto['periodKind']>
        label={intl.formatMessage({ id: 'plan.field.periodKind', defaultMessage: 'Period' })}
        options={periodOptions}
        value={plan.periodKind}
        disabled
        onChange={ignore}
      />
      {plan.periodKind === 'custom' ? (
        <CustomPeriodPicker
          startDate={plan.period.start}
          endDate={plan.period.end}
          onChange={onCustomDatesChange}
        />
      ) : null}
      <Select<string>
        label={intl.formatMessage({
          id: 'plan.field.baseCurrency',
          defaultMessage: 'Base currency',
        })}
        options={PLAN_CURRENCIES.map((currency) => ({ value: currency, label: currency }))}
        value={plan.baseCurrency}
        onChange={onBaseCurrencyChange}
      />
    </>
  );
}

function NewItemForm({
  draft,
  draftCategories,
  plan,
  adding,
  categoriesFailed,
  onRetryCategories,
  onDraftChange,
  onAddItem,
}: PlanEditorViewProps): React.JSX.Element {
  const intl = useIntl();
  const glass = useGlass();
  const styles = useStyles();
  const shared = usePlanStyles();
  const directionOptions: ReadonlyArray<{ value: PlannedItemDirectionDto; label: string }> = [
    {
      value: 'income',
      label: intl.formatMessage({ id: 'plan.direction.income', defaultMessage: 'Income' }),
    },
    {
      value: 'expense',
      label: intl.formatMessage({ id: 'plan.direction.expense', defaultMessage: 'Expense' }),
    },
  ];
  const amountLabel = intl.formatMessage(
    { id: 'plan.item.newAmount', defaultMessage: 'Amount in {currency}' },
    { currency: plan.baseCurrency },
  );

  return (
    <View>
      {categoriesFailed ? (
        <>
          <Text accessibilityRole="alert" style={shared.noticeText}>
            {intl.formatMessage({
              id: 'plan.error.categories',
              defaultMessage: 'Could not load categories.',
            })}
          </Text>
          <Button variant="secondary" onPress={onRetryCategories}>
            {intl.formatMessage({ id: 'plan.retry', defaultMessage: 'Try again' })}
          </Button>
        </>
      ) : null}
      <SegmentedControl<PlannedItemDirectionDto>
        label={intl.formatMessage({ id: 'plan.item.direction', defaultMessage: 'Direction' })}
        options={directionOptions}
        value={draft.direction}
        onChange={(direction) => {
          // Categories are per kind: a new direction needs a new category.
          onDraftChange({ ...draft, direction, categoryId: '' });
        }}
      />
      <Select<string>
        label={intl.formatMessage({ id: 'plan.item.category', defaultMessage: 'Category' })}
        placeholder={intl.formatMessage({
          id: 'plan.item.category',
          defaultMessage: 'Category',
        })}
        options={draftCategories}
        value={draft.categoryId}
        onChange={(categoryId) => {
          onDraftChange({ ...draft, categoryId });
        }}
      />
      <TextInput
        accessibilityLabel={amountLabel}
        placeholder={amountLabel}
        placeholderTextColor={glass.colors.dim}
        value={draft.amount}
        keyboardType="decimal-pad"
        onChangeText={(amount) => {
          onDraftChange({ ...draft, amount });
        }}
        style={styles.amountInput}
      />
      <Button variant="primary" loading={adding} onPress={onAddItem}>
        {intl.formatMessage({ id: 'plan.item.add', defaultMessage: 'Add item' })}
      </Button>
    </View>
  );
}

function ignore(): void {
  // The period kind of an existing plan is fixed (UpdatePlanDto has no periodKind).
}
