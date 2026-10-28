import React from 'react';
import { Pressable, Text, View } from 'react-native';
import type { MinorUnitAmount } from '@power-budget/core';
import type { RodData } from '@power-budget/shared-app';
import { makeStyles } from '../../../theme/index.js';
import { AmountText } from '../../../glass/atoms/AmountText.js';
import { BODY_FONT, LABEL_FONT, TOUCH_TARGET } from '../../../glass/controls/fonts.js';
import { Rod } from '../../../glass/light/Rod.js';
import { useLightLabels } from '../../../glass/light/useLightLabels.js';
import { ErrorBanner } from '../../../glass/overlays/ErrorBanner.js';
import { Sheet } from '../../../glass/overlays/Sheet.js';
import { TransactionActionButton } from '../transactions/TransactionActionButton.js';
import type { CategoryChoice, Impact } from './categorizeModel.js';
import type { CategorizeSession } from './useCategorizeSession.js';
import { useCategorizeLabels } from './useCategorizeLabels.js';
import type { CategorizeLabels } from './useCategorizeLabels.js';
import type { LoadStatus } from './useToSort.js';

export interface CategorizeSheetViewProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly session: CategorizeSession;
  readonly choicesStatus: LoadStatus;
  readonly onRetryChoices: () => void;
  /** Leaves for the Transactions tab; absent hides the action. */
  readonly onBackToTransactions?: () => void;
}

const useStyles = makeStyles((glass) => ({
  body: { gap: glass.space.md },
  card: {
    padding: glass.space.lg,
    gap: glass.space.xs,
    borderRadius: glass.radius.tile,
    backgroundColor: glass.colors.clear,
    boxShadow: glass.colors.clearRim,
  },
  cardLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
  },
  merchant: {
    flexShrink: 1,
    color: glass.colors.fg,
    fontFamily: LABEL_FONT,
    fontSize: glass.type.heading.mobile,
  },
  amount: { color: glass.colors.fg, fontFamily: BODY_FONT, fontSize: glass.type.heading.mobile },
  dim: { color: glass.colors.dim, fontFamily: BODY_FONT, fontSize: glass.type.small.mobile },
  strong: { color: glass.colors.fg, fontFamily: LABEL_FONT, fontSize: glass.type.body.mobile },
  over: { color: glass.colors.over },
  options: { gap: glass.space.sm },
  option: {
    minHeight: TOUCH_TARGET,
    padding: glass.space.md,
    gap: 2,
    borderRadius: glass.radius.tile,
    backgroundColor: glass.colors.clear,
    boxShadow: glass.colors.clearRim,
  },
  optionOn: {
    backgroundColor: glass.colors.fill2,
    boxShadow: `inset 0 0 0 2px ${glass.colors.fg}`,
  },
  optionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  tag: {
    color: glass.colors.accent,
    fontFamily: LABEL_FONT,
    fontSize: glass.type.tag.mobile,
  },
  preview: { gap: glass.space.xs },
  actions: { gap: glass.space.sm, alignItems: 'stretch' },
  centered: { alignItems: 'center', gap: glass.space.sm, paddingVertical: glass.space.lg },
}));

/**
 * D7-M-Categorize: the payment on a clear card, the categories (the suggested one first), the rod
 * showing what the payment drains, one Confirm, then the Confirmed card with Undo, then All sorted.
 * Props only; the container owns the state and the writes.
 */
export function CategorizeSheetView(props: CategorizeSheetViewProps): React.JSX.Element {
  const labels = useCategorizeLabels();
  const { session } = props;
  const title = session.allDone
    ? labels.allSortedTitle()
    : labels.sheetTitle(session.position, session.total);
  const choosing = session.phase === 'choosing' || session.phase === 'saving';
  const footer =
    !session.allDone && choosing ? <ConfirmButton session={session} labels={labels} /> : undefined;

  return (
    <Sheet isOpen={props.isOpen} onClose={props.onClose} title={title} footer={footer}>
      <SheetBody {...props} labels={labels} />
    </Sheet>
  );
}

function SheetBody(
  props: CategorizeSheetViewProps & { readonly labels: CategorizeLabels },
): React.JSX.Element {
  const styles = useStyles();
  const { session, labels } = props;
  if (session.allDone || session.row === undefined) {
    return <AllSorted {...props} />;
  }
  const confirmed = session.phase === 'done' || session.phase === 'undoing';

  return (
    <View testID="categorize-body" style={styles.body}>
      {session.failure === null ? null : (
        <ErrorBanner
          message={session.failure === 'confirm' ? labels.confirmError() : labels.undoError()}
        />
      )}
      <PaymentCard session={session} labels={labels} />
      {confirmed ? <ConfirmedPanel session={session} labels={labels} /> : <Choosing {...props} />}
    </View>
  );
}

function PaymentCard({
  session,
  labels,
}: {
  readonly session: CategorizeSession;
  readonly labels: CategorizeLabels;
}): React.JSX.Element | null {
  const styles = useStyles();
  const row = session.row;
  if (row === undefined) {
    return null;
  }
  const amount: MinorUnitAmount = {
    amountMinor: row.data.amountMinor,
    currency: row.data.currency,
  };

  return (
    <View testID="payment-card" style={styles.card}>
      <View style={styles.cardLine}>
        <Text accessibilityRole="header" style={styles.merchant}>
          {row.data.title}
        </Text>
        <AmountText amount={amount} style={styles.amount} />
      </View>
      <Text style={styles.dim}>{labels.date(row.day)}</Text>
      {row.data.subtitle === '' ? null : <Text style={styles.dim}>{row.data.subtitle}</Text>}
    </View>
  );
}

function Choosing(
  props: CategorizeSheetViewProps & { readonly labels: CategorizeLabels },
): React.JSX.Element {
  const styles = useStyles();
  const { session, labels, choicesStatus } = props;
  if (choicesStatus === 'loading') {
    return <Text style={styles.dim}>{labels.choicesLoading()}</Text>;
  }
  if (choicesStatus === 'error') {
    return <ErrorBanner message={labels.choicesError()} onRetry={props.onRetryChoices} />;
  }
  if (session.options.length === 0) {
    return <Text style={styles.dim}>{labels.choicesEmpty()}</Text>;
  }
  const locked = session.phase === 'saving';

  return (
    <>
      <View role="radiogroup" accessibilityLabel={labels.optionsGroup()} style={styles.options}>
        {session.options.map((option) => (
          <Option
            key={option.plannedItemId}
            option={option}
            picked={session.picked?.plannedItemId === option.plannedItemId}
            suggested={session.row?.suggestedPlannedItemId === option.plannedItemId}
            impact={
              session.picked?.plannedItemId === option.plannedItemId ? session.impact : undefined
            }
            disabled={locked}
            onPick={session.pick}
            labels={labels}
          />
        ))}
      </View>
      {session.picked === undefined || session.impact === undefined ? null : (
        <Preview name={session.picked.name} impact={session.impact} labels={labels} />
      )}
    </>
  );
}

function Option({
  option,
  picked,
  suggested,
  impact,
  disabled,
  onPick,
  labels,
}: {
  readonly option: CategoryChoice;
  readonly picked: boolean;
  readonly suggested: boolean;
  readonly impact: Impact | undefined;
  readonly disabled: boolean;
  readonly onPick: (plannedItemId: string) => void;
  readonly labels: CategorizeLabels;
}): React.JSX.Element {
  const styles = useStyles();
  const detail = optionDetail(option, impact, labels);
  const detailText = detail?.text;

  return (
    <Pressable
      testID="category-option"
      role="radio"
      accessibilityLabel={labels.optionAria(option.name, detailText ?? '', suggested)}
      aria-checked={picked}
      accessibilityState={{ checked: picked, disabled }}
      disabled={disabled}
      onPress={() => onPick(option.plannedItemId)}
      style={[styles.option, picked && styles.optionOn]}
    >
      <View style={styles.optionHead}>
        <Text style={styles.strong}>{option.name}</Text>
        {suggested ? <Text style={styles.tag}>{labels.suggested()}</Text> : null}
      </View>
      {detail === undefined ? null : (
        <Text style={[styles.dim, detail.over && styles.over]}>{detail.text}</Text>
      )}
    </Pressable>
  );
}

function optionDetail(
  option: CategoryChoice,
  impact: Impact | undefined,
  labels: CategorizeLabels,
): { readonly text: string; readonly over: boolean } | undefined {
  if (option.direction === 'income') {
    return { text: labels.optionIncome(), over: false };
  }
  if (option.plannedMinor <= 0n) {
    return undefined;
  }
  if (impact !== undefined && impact.kind === 'drain') {
    return { text: labels.optionPreview(impact), over: impact.state === 'over' };
  }
  const left: MinorUnitAmount = {
    amountMinor: option.plannedMinor - option.spentMinor,
    currency: option.currency,
  };

  return left.amountMinor < 0n
    ? { text: labels.optionOver(left), over: true }
    : { text: labels.optionLeft(left), over: false };
}

function Preview({
  name,
  impact,
  labels,
}: {
  readonly name: string;
  readonly impact: Impact;
  readonly labels: CategorizeLabels;
}): React.JSX.Element {
  const styles = useStyles();

  return (
    <View
      testID="rod-preview"
      accessibilityLiveRegion="polite"
      style={[styles.card, styles.preview]}
    >
      <ImpactRod name={name} impact={impact} />
      <Text style={[styles.strong, impact.state === 'over' && styles.over]}>
        {labels.previewText(name, impact)}
      </Text>
    </View>
  );
}

function ImpactRod({
  name,
  impact,
}: {
  readonly name: string;
  readonly impact: Impact;
}): React.JSX.Element | null {
  const lightLabels = useLightLabels();
  if (impact.kind !== 'drain') {
    return null;
  }
  const shown: MinorUnitAmount = {
    amountMinor:
      impact.after.amountMinor < 0n ? -impact.after.amountMinor : impact.after.amountMinor,
    currency: impact.after.currency,
  };
  const rod: RodData = {
    fraction: impact.fraction,
    state: impact.state,
    size: 'category',
    ariaLabel: lightLabels.rodAria(name, impact.state, shown, impact.planned),
  };

  return <Rod rod={rod} />;
}

function ConfirmedPanel({
  session,
  labels,
}: {
  readonly session: CategorizeSession;
  readonly labels: CategorizeLabels;
}): React.JSX.Element {
  const styles = useStyles();
  const busy = session.phase === 'undoing';
  const name = session.picked?.name ?? '';
  const impact = session.impact;

  return (
    <>
      <View
        testID="confirmed-card"
        accessibilityRole="summary"
        style={[styles.card, styles.preview]}
      >
        <Text accessibilityRole="header" style={styles.strong}>
          {labels.confirmedTitle(name)}
        </Text>
        {impact === undefined ? null : <ImpactRod name={name} impact={impact} />}
        {impact === undefined ? null : (
          <Text style={[styles.dim, impact.state === 'over' && styles.over]}>
            {labels.confirmedLine(name, impact)}
          </Text>
        )}
      </View>
      <View style={styles.actions}>
        <TransactionActionButton
          primary
          label={session.nextTitle === undefined ? labels.finish() : labels.next(session.nextTitle)}
          onPress={session.next}
          disabled={busy}
        />
        <TransactionActionButton
          label={labels.undo()}
          onPress={session.undo}
          disabled={busy}
          busy={busy}
        />
      </View>
    </>
  );
}

function ConfirmButton({
  session,
  labels,
}: {
  readonly session: CategorizeSession;
  readonly labels: CategorizeLabels;
}): React.JSX.Element {
  const saving = session.phase === 'saving';
  const label =
    session.picked === undefined
      ? labels.confirmDisabledHint()
      : labels.confirm(session.picked.name);

  return (
    <TransactionActionButton
      primary
      label={label}
      onPress={session.confirm}
      disabled={saving || session.picked === undefined}
      busy={saving}
    />
  );
}

function AllSorted({
  session,
  labels,
  onClose,
  onBackToTransactions,
}: CategorizeSheetViewProps & { readonly labels: CategorizeLabels }): React.JSX.Element {
  const styles = useStyles();

  return (
    <View testID="all-sorted" accessibilityRole="summary" style={styles.centered}>
      <Text accessibilityRole="header" style={styles.merchant}>
        {labels.allSortedTitle()}
      </Text>
      <Text style={styles.dim}>{labels.allSortedSummary(session.sortedCount)}</Text>
      <View style={styles.actions}>
        {onBackToTransactions === undefined ? null : (
          <TransactionActionButton
            label={labels.backToTransactions()}
            onPress={onBackToTransactions}
          />
        )}
        <TransactionActionButton primary label={labels.done()} onPress={onClose} />
      </View>
    </View>
  );
}
