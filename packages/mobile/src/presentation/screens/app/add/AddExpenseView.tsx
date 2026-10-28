import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useIntl } from 'react-intl';
import type { IntlShape } from 'react-intl';
import type { MinorUnitAmount } from '@power-budget/core';
import { formatMoney } from '@power-budget/core';
import { makeStyles } from '../../../theme/index.js';
import { GlassPanel } from '../../../glass/material/GlassPanel.js';
import { Lens } from '../../../glass/light/Lens.js';
import { Rod } from '../../../glass/light/Rod.js';
import { useLightLabels } from '../../../glass/light/useLightLabels.js';
import { StatusTag } from '../../../glass/atoms/StatusTag.js';
import { toSupportedLocale } from '../../../glass/atoms/supportedLocale.js';
import { FilterChips } from '../../../glass/controls/FilterChips.js';
import { Keypad } from '../../../glass/controls/Keypad.js';
import { BODY_FONT, LABEL_FONT } from '../../../glass/controls/fonts.js';
import { ErrorBanner } from '../../../glass/overlays/ErrorBanner.js';
import { Button } from '../../../components/Button.js';
import { computeImpact, typedAmountMinor, wholeUnits } from './addExpenseImpact.js';
import type {
  AccountOption,
  AddExpenseStatus,
  AddImpact,
  CategoryOption,
  PlanSnapshot,
} from './addExpenseModel.js';

export interface AddExpenseViewProps {
  /** Null outside the current plan period: the lens and safe to spend are left out (Q4). */
  readonly plan: PlanSnapshot | null;
  readonly currency: string;
  /** Local date shown in the header, already formatted. */
  readonly dateLabel: string;
  /** The keypad value, dot-separated ("" | "84" | "84.5"). */
  readonly typed: string;
  readonly categories: readonly CategoryOption[];
  readonly categoryId: string;
  readonly accounts: readonly AccountOption[];
  readonly accountId: string;
  readonly status: AddExpenseStatus;
  /** Message of the last failed save or undo; null when there was none. */
  /** The expense is saved but its category could not be attached; it waits in To sort. */
  readonly unsorted: boolean;
  readonly error: string | null;
  readonly onTypedChange: (typed: string) => void;
  readonly onCategoryChange: (categoryId: string) => void;
  readonly onAccountChange: (accountId: string) => void;
  readonly onSave: () => void;
  readonly onUndo: () => void;
  readonly onAddAnother: () => void;
  /** Retries the totals read that failed after Add another or Undo. */
  readonly onRetryRefresh: () => void;
  /** Re-sends only the category of an expense that is already saved. */
  readonly onRetryCategory: () => void;
  readonly onBackToToday: () => void;
}

const useStyles = makeStyles((glass) => ({
  scroll: { flex: 1 },
  content: { padding: glass.space.lg, gap: glass.space.lg },
  amountBlock: { alignItems: 'center', gap: glass.space.xxs },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', gap: glass.space.xs },
  amount: {
    color: glass.colors.fg,
    fontFamily: 'Geist_300Light',
    fontSize: glass.type.figure.mobile,
    letterSpacing: -0.04 * glass.type.figure.mobile,
    fontVariant: ['tabular-nums'],
  },
  amountEmpty: { color: glass.colors.dim },
  currency: {
    color: glass.colors.dim,
    fontFamily: 'Geist_300Light',
    fontSize: glass.type.figure.mobile * 0.4,
  },
  hint: { color: glass.colors.dim, fontFamily: BODY_FONT, fontSize: glass.type.small.mobile },
  date: { color: glass.colors.dim, fontFamily: BODY_FONT, fontSize: glass.type.small.mobile },
  panelBody: { gap: glass.space.md, padding: glass.space.lg },
  impactRow: { flexDirection: 'row', alignItems: 'center', gap: glass.space.md },
  impactText: { flex: 1, gap: glass.space.xxs },
  impactTitle: {
    color: glass.colors.fg,
    fontFamily: LABEL_FONT,
    fontSize: glass.type.panelLabel.mobile,
  },
  impactFigure: { flexDirection: 'row', alignItems: 'baseline', gap: glass.space.xs },
  impactBefore: {
    color: glass.colors.dim,
    fontFamily: BODY_FONT,
    fontSize: glass.type.body.mobile,
  },
  impactAfter: {
    color: glass.colors.fg,
    fontFamily: 'Geist_300Light',
    fontSize: glass.type.title.mobile,
  },
  impactUnit: { color: glass.colors.dim, fontFamily: BODY_FONT, fontSize: glass.type.small.mobile },
  line: { color: glass.colors.fg, fontFamily: LABEL_FONT, fontSize: glass.type.small.mobile },
  lineOver: { color: glass.colors.over },
  categoryBlock: { gap: glass.space.xs },
  group: { gap: glass.space.xs },
  groupLabel: {
    color: glass.colors.dim,
    fontFamily: LABEL_FONT,
    fontSize: glass.type.small.mobile,
  },
  savedPanel: { gap: glass.space.sm, padding: glass.space.lg },
  savedTitle: {
    color: glass.colors.fg,
    fontFamily: LABEL_FONT,
    fontSize: glass.type.heading.mobile,
  },
  savedLine: { color: glass.colors.fg, fontFamily: BODY_FONT, fontSize: glass.type.body.mobile },
  actions: { gap: glass.space.sm },
}));

/** Add expense (D7-M-Add): keypad amount, live safe to spend, category and account, then save. */
export function AddExpenseView(props: AddExpenseViewProps): React.JSX.Element {
  const styles = useStyles();
  const intl = useIntl();
  const category = selectedCategory(props);
  const amountMinor = typedAmountMinor(props.typed, props.currency);
  const impact =
    props.plan === null || category === null
      ? null
      : computeImpact(props.plan, category, amountMinor);
  const editing =
    props.status !== 'saved' &&
    props.status !== 'refreshing' &&
    props.status !== 'undoing' &&
    props.status !== 'mapping' &&
    props.status !== 'stale';
  const stale = props.status === 'stale';

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <AmountBlock {...props} intl={intl} />
      {impact === null || props.plan === null ? null : (
        <ImpactPanel plan={props.plan} impact={impact} category={category} />
      )}
      {props.error === null ? null : (
        <ErrorBanner
          message={props.error}
          onRetry={props.status === 'stale' ? props.onRetryRefresh : undefined}
        />
      )}
      {editing ? (
        <Pickers {...props} />
      ) : stale ? null : (
        <SavedPanel {...props} impact={impact} category={category} amountMinor={amountMinor} />
      )}
      {editing ? <KeypadBlock {...props} category={category} amountMinor={amountMinor} /> : null}
    </ScrollView>
  );
}

function selectedCategory(props: AddExpenseViewProps): CategoryOption | null {
  return props.categories.find((option) => option.id === props.categoryId) ?? null;
}

function AmountBlock(props: AddExpenseViewProps & { readonly intl: IntlShape }): React.JSX.Element {
  const styles = useStyles();
  const { intl } = props;
  const symbol = currencySymbol(props.currency, intl.locale);
  const shown = props.typed === '' ? '0' : groupTyped(props.typed, intl.locale);
  const hint =
    props.status === 'saved' && props.plan !== null
      ? intl.formatMessage(
          { id: 'add.hint.saved', defaultMessage: 'Saved · counted in {plan}' },
          { plan: props.plan.planName },
        )
      : intl.formatMessage({
          id: 'add.hint.editing',
          defaultMessage: 'Card or cash · counted today',
        });

  return (
    <View style={styles.amountBlock}>
      <Text style={styles.date}>{props.dateLabel}</Text>
      <View
        accessibilityLiveRegion="polite"
        accessible
        accessibilityLabel={intl.formatMessage(
          { id: 'add.amount.aria', defaultMessage: 'Amount: {amount}' },
          { amount: `${shown} ${symbol}` },
        )}
        style={styles.amountRow}
      >
        <Text testID="add-amount" style={[styles.amount, props.typed === '' && styles.amountEmpty]}>
          {shown}
        </Text>
        <Text style={styles.currency}>{symbol}</Text>
      </View>
      <Text style={styles.hint}>{hint}</Text>
    </View>
  );
}

interface ImpactPanelProps {
  readonly plan: PlanSnapshot;
  readonly impact: AddImpact;
  readonly category: CategoryOption | null;
}

function ImpactPanel({ plan, impact, category }: ImpactPanelProps): React.JSX.Element {
  const styles = useStyles();
  const intl = useIntl();
  const labels = useLightLabels();
  const symbol = currencySymbol(plan.currency, intl.locale);
  const whole = wholeUnits(impact.safeAfter);
  const days = intl.formatMessage(
    {
      id: 'add.impact.unit',
      defaultMessage: '{currency} a day for the {days, plural, one {# day} other {# days}} left',
    },
    { currency: symbol, days: plan.daysLeft },
  );

  return (
    <GlassPanel material="frosted" depth={0} decor={{ specular: true, film: true }}>
      <View style={styles.panelBody}>
        <View style={styles.impactRow}>
          <Lens
            lens={{
              fraction: impact.fraction,
              amountLabel: new Intl.NumberFormat(intl.locale).format(whole),
              caption: labels.daysLeft(plan.daysLeft),
              ariaLabel: intl.formatMessage(
                {
                  id: 'add.impact.lensAria',
                  defaultMessage:
                    'Safe to spend after this expense: {amount} a day for the {days, plural, one {# day} other {# days}} left',
                },
                { amount: money(impact.safeAfter, intl), days: plan.daysLeft },
              ),
              size: 'mini',
            }}
          />
          <View style={styles.impactText}>
            <Text accessibilityRole="header" style={styles.impactTitle}>
              {intl.formatMessage({
                id: 'add.impact.title',
                defaultMessage: 'Safe to spend today',
              })}
            </Text>
            <View accessibilityLiveRegion="polite" style={styles.impactFigure}>
              <Text style={styles.impactBefore}>
                {intl.formatMessage(
                  { id: 'add.impact.before', defaultMessage: '{amount} →' },
                  { amount: money(impact.safeBefore, intl) },
                )}
              </Text>
              <Text testID="add-safe-after" style={styles.impactAfter}>
                {money(impact.safeAfter, intl)}
              </Text>
            </View>
            <Text style={styles.impactUnit}>{days}</Text>
          </View>
        </View>
        {impact.overPlanMinor > 0n ? (
          <StatusTag
            kind="over"
            label={intl.formatMessage(
              {
                id: 'add.over.plan',
                defaultMessage: 'That is {amount} more than {plan} has left.',
              },
              {
                amount: money({ amountMinor: impact.overPlanMinor, currency: plan.currency }, intl),
                plan: plan.planName,
              },
            )}
          />
        ) : null}
        {category === null ? null : <CategoryLine category={category} impact={impact} />}
      </View>
    </GlassPanel>
  );
}

function CategoryLine({
  category,
  impact,
}: {
  readonly category: CategoryOption;
  readonly impact: AddImpact;
}): React.JSX.Element {
  const styles = useStyles();
  const intl = useIntl();
  const labels = useLightLabels();
  const { before, after, kind, state, fraction } = impact.category;
  const over = kind === 'crossing' || kind === 'alreadyOver';
  const rodAmount = state === 'over' ? negate(after) : after;
  const plan = { amountMinor: category.plannedMinor, currency: after.currency };

  return (
    <View style={styles.categoryBlock}>
      <Text
        accessibilityLiveRegion="polite"
        testID="add-category-line"
        style={[styles.line, over && styles.lineOver]}
      >
        {categoryLine(kind, before, after, intl)}
      </Text>
      {kind === 'unplanned' ? null : (
        <Rod
          rod={{
            fraction,
            state,
            size: 'category',
            ariaLabel: labels.rodAria(category.name, state, rodAmount, plan),
          }}
        />
      )}
    </View>
  );
}

function categoryLine(
  kind: AddImpact['category']['kind'],
  before: MinorUnitAmount,
  after: MinorUnitAmount,
  intl: IntlShape,
): string {
  const values = {
    before: money(before, intl),
    after: money(after, intl),
    over: money(negate(after), intl),
    overBefore: money(negate(before), intl),
  };
  if (kind === 'crossing') {
    return intl.formatMessage(
      { id: 'add.category.crossing', defaultMessage: '{before} left → over by {over}' },
      values,
    );
  }
  if (kind === 'alreadyOver') {
    return intl.formatMessage(
      { id: 'add.category.alreadyOver', defaultMessage: 'Over by {overBefore} → {over}' },
      values,
    );
  }
  if (kind === 'unplanned') {
    return intl.formatMessage(
      { id: 'add.category.unplanned', defaultMessage: '{before} → {after}, outside the plan' },
      values,
    );
  }

  return intl.formatMessage(
    { id: 'add.category.under', defaultMessage: '{before} → {after} left' },
    values,
  );
}

function Pickers(props: AddExpenseViewProps): React.JSX.Element {
  const styles = useStyles();
  const intl = useIntl();
  const saving = props.status === 'saving';

  return (
    <View style={styles.group}>
      <FilterChips
        label={intl.formatMessage({ id: 'add.category.group', defaultMessage: 'Category' })}
        options={props.categories.map((option) => ({ value: option.id, label: option.name }))}
        value={props.categoryId}
        onChange={props.onCategoryChange}
        disabled={saving}
      />
      {props.accounts.length === 0 ? (
        <Text style={styles.groupLabel}>
          {intl.formatMessage(
            { id: 'add.account.none', defaultMessage: 'No {currency} account to add this to' },
            { currency: props.currency },
          )}
        </Text>
      ) : (
        <>
          <Text style={styles.groupLabel}>
            {intl.formatMessage({ id: 'add.account.group', defaultMessage: 'Account' })}
          </Text>
          <FilterChips
            label={intl.formatMessage({ id: 'add.account.group', defaultMessage: 'Account' })}
            options={props.accounts.map((option) => ({ value: option.id, label: option.name }))}
            value={props.accountId}
            onChange={props.onAccountChange}
            disabled={saving}
          />
        </>
      )}
    </View>
  );
}

interface KeypadBlockProps extends AddExpenseViewProps {
  readonly category: CategoryOption | null;
  readonly amountMinor: bigint;
}

function KeypadBlock(props: KeypadBlockProps): React.JSX.Element {
  const intl = useIntl();
  const empty = props.amountMinor <= 0n;
  const label = submitLabel(props, intl, empty);
  const ready = !empty && props.category !== null && props.accountId !== '';

  return (
    <Keypad
      value={props.typed}
      onChange={props.onTypedChange}
      onSubmit={ready ? props.onSave : ignoreSubmit}
      submitLabel={label}
      backspaceLabel={intl.formatMessage({
        id: 'add.keypad.backspace',
        defaultMessage: 'Delete last digit',
      })}
      decimalSeparator={decimalSeparator(intl.locale)}
      disabled={props.status === 'saving'}
    />
  );
}

function ignoreSubmit(): void {
  // Nothing to save yet: the label already says what is missing.
}

function submitLabel(props: KeypadBlockProps, intl: IntlShape, empty: boolean): string {
  if (props.status === 'saving') {
    return intl.formatMessage({ id: 'add.save.saving', defaultMessage: 'Saving…' });
  }
  if (empty || props.category === null) {
    return intl.formatMessage({ id: 'add.save.empty', defaultMessage: 'Type an amount' });
  }

  return intl.formatMessage(
    { id: 'add.save', defaultMessage: 'Add {amount} to {category}' },
    {
      amount: money({ amountMinor: props.amountMinor, currency: props.currency }, intl),
      category: props.category.name,
    },
  );
}

interface SavedPanelProps extends AddExpenseViewProps {
  readonly impact: AddImpact | null;
  readonly category: CategoryOption | null;
  readonly amountMinor: bigint;
}

function SavedPanel(props: SavedPanelProps): React.JSX.Element {
  const styles = useStyles();
  const intl = useIntl();
  const amount = money({ amountMinor: props.amountMinor, currency: props.currency }, intl);
  const refreshing =
    props.status === 'refreshing' || props.status === 'undoing' || props.status === 'mapping';

  return (
    <View style={styles.actions}>
      <GlassPanel material="tinted" depth={1}>
        <View accessibilityRole="alert" style={styles.savedPanel}>
          <StatusTag
            kind="ok"
            label={intl.formatMessage({ id: 'add.saved.title', defaultMessage: 'Added' })}
          />
          <Text style={styles.savedLine}>
            {intl.formatMessage(
              { id: 'add.saved.line', defaultMessage: '{amount} · {category}' },
              { amount, category: props.category?.name ?? '' },
            )}
          </Text>
          {props.unsorted ? (
            <>
              <Text style={styles.savedLine}>
                {intl.formatMessage(
                  {
                    id: 'add.saved.unsorted',
                    defaultMessage: 'Saved, but not added to {category} yet.',
                  },
                  { category: props.category?.name ?? '' },
                )}
              </Text>
              <Button variant="secondary" onPress={props.onRetryCategory} disabled={refreshing}>
                {intl.formatMessage({ id: 'add.retryCategory', defaultMessage: 'Retry category' })}
              </Button>
            </>
          ) : null}
          {props.impact === null ? null : (
            <Text style={styles.savedLine}>
              {intl.formatMessage(
                {
                  id: 'add.saved.safe',
                  defaultMessage: 'Safe to spend today is now {amount} a day.',
                },
                { amount: money(props.impact.safeAfter, intl) },
              )}
            </Text>
          )}
          <Button variant="secondary" onPress={props.onUndo} disabled={refreshing}>
            {intl.formatMessage({ id: 'add.undo', defaultMessage: 'Undo' })}
          </Button>
        </View>
      </GlassPanel>
      <Button variant="primary" onPress={props.onAddAnother} disabled={refreshing}>
        {intl.formatMessage({ id: 'add.another', defaultMessage: 'Add another' })}
      </Button>
      <Button variant="secondary" onPress={props.onBackToToday}>
        {intl.formatMessage({ id: 'add.today', defaultMessage: 'Back to Today' })}
      </Button>
    </View>
  );
}

function money(amount: MinorUnitAmount, intl: IntlShape): string {
  return formatMoney(amount, toSupportedLocale(intl.locale));
}

function negate(amount: MinorUnitAmount): MinorUnitAmount {
  return { amountMinor: -amount.amountMinor, currency: amount.currency };
}

function decimalSeparator(locale: string): string {
  return toSupportedLocale(locale) === 'en' ? '.' : ',';
}

/** Groups the integer digits of the typed string by thousands; the fraction stays as typed. */
function groupTyped(typed: string, locale: string): string {
  const [whole = '', fraction] = typed.split('.');
  const grouped = whole.replace(
    /\B(?=(\d{3})+(?!\d))/g,
    toSupportedLocale(locale) === 'en' ? ',' : ' ',
  );

  return fraction === undefined ? grouped : `${grouped}${decimalSeparator(locale)}${fraction}`;
}

function currencySymbol(currency: string, locale: string): string {
  const parts = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
  }).formatToParts(0);

  return parts.find((part) => part.type === 'currency')?.value ?? currency;
}
