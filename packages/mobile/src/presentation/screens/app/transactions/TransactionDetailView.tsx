import React from 'react';
import { ScrollView, Text, TextInput, View, Pressable } from 'react-native';
import { parseMinorUnits } from '@power-budget/core';
import { makeStyles, useGlass } from '../../../theme/index.js';
import { AmountText } from '../../../glass/atoms/AmountText.js';
import { StatusTag } from '../../../glass/atoms/StatusTag.js';
import { LABEL_FONT, TOUCH_TARGET } from '../../../glass/controls/fonts.js';
import { Switch } from '../../../glass/controls/Switch.js';
import { GlassPanel } from '../../../glass/material/GlassPanel.js';
import { ErrorBanner } from '../../../glass/overlays/ErrorBanner.js';
import { EmptyState } from '../../../glass/overlays/EmptyState.js';
import { SkeletonList } from '../../../glass/overlays/Skeleton.js';
import { Sheet } from '../../../glass/overlays/Sheet.js';
import { titleOf } from '../../../../infrastructure/transactions/TransactionView.js';
import type { TransactionView } from '../../../../infrastructure/transactions/TransactionView.js';
import type { PlannedItemOption } from '../../../../infrastructure/transactions/PlannedItemCategories.js';
import { TransactionActionButton } from './TransactionActionButton.js';
import { useTransactionLabels } from './useTransactionLabels.js';

export type TransactionDetailStatus = 'loading' | 'error' | 'notFound' | 'ready';

export interface TransactionDetailViewProps {
  readonly status: TransactionDetailStatus;
  readonly transaction?: TransactionView;
  /** Category of the mapped planned item, when it is known. */
  readonly categoryName?: string;
  readonly options: readonly PlannedItemOption[];
  /** The picker pool is loaded apart from the transaction; a failure must not look like "no categories". */
  readonly optionsStatus: 'loading' | 'ready' | 'error';
  readonly onRetryOptions: () => void;
  /** The mapped item's category could not be looked up: say so instead of showing a blank. */
  readonly categoryFailed?: boolean;
  /** The transfer status could not be confirmed with the server: the switch is only the user's intent. */
  readonly transferUnresolved?: boolean;
  readonly onRetryTransfer?: () => void;
  readonly onRetryCategory?: () => void;
  readonly pickerOpen: boolean;
  readonly notes: string;
  readonly saving: boolean;
  readonly onRetry: () => void;
  readonly onOpenPicker: () => void;
  readonly onClosePicker: () => void;
  readonly onPickItem: (plannedItemId: string) => void;
  readonly onClearMapping: () => void;
  readonly onToggleTransfer: (isTransfer: boolean) => void;
  readonly onNotesChange: (notes: string) => void;
  readonly onSaveNotes: () => void;
}

const useStyles = makeStyles((glass) => ({
  page: { padding: glass.space.lg, paddingBottom: 120, gap: glass.space.md },
  panel: { padding: glass.space.lg, gap: glass.space.sm },
  title: {
    color: glass.colors.fg,
    fontFamily: LABEL_FONT,
    fontSize: glass.type.heading.mobile,
  },
  dim: {
    color: glass.colors.dim,
    fontFamily: 'Geist_400Regular',
    fontSize: glass.type.small.mobile,
  },
  label: {
    color: glass.colors.fg,
    fontFamily: LABEL_FONT,
    fontSize: glass.type.label.mobile,
  },
  body: {
    color: glass.colors.fg,
    fontFamily: 'Geist_400Regular',
    fontSize: glass.type.body.mobile,
  },
  amount: { color: glass.colors.fg },
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: glass.space.sm },
  input: {
    minHeight: 96,
    padding: glass.space.md,
    borderRadius: glass.radius.tile,
    backgroundColor: glass.colors.fill,
    boxShadow: glass.colors.clearRim,
    color: glass.colors.fg,
    fontFamily: 'Geist_400Regular',
    fontSize: glass.type.body.mobile,
    textAlignVertical: 'top',
  },
  option: {
    minHeight: TOUCH_TARGET,
    justifyContent: 'center',
    paddingHorizontal: glass.space.md,
    borderRadius: glass.radius.tile,
    backgroundColor: glass.colors.clear,
    boxShadow: glass.colors.clearRim,
  },
  options: { gap: glass.space.sm },
}));

/** TransactionDetailScreen as glass: the transaction, its category, the transfer switch, notes. */
export function TransactionDetailView(props: TransactionDetailViewProps): React.JSX.Element {
  const styles = useStyles();
  const labels = useTransactionLabels();
  const { transaction } = props;

  if (props.status === 'loading') {
    return (
      <View style={styles.page}>
        <SkeletonList rows={3} />
      </View>
    );
  }
  if (props.status === 'error') {
    return (
      <View style={styles.page}>
        <ErrorBanner message={labels.detailError()} onRetry={props.onRetry} />
      </View>
    );
  }
  if (props.status === 'notFound' || transaction === undefined) {
    return (
      <View style={styles.page}>
        <EmptyState title={labels.detailNotFound()} />
      </View>
    );
  }

  return (
    <ScrollView testID="tx-detail" contentContainerStyle={styles.page}>
      {props.transferUnresolved === true ? (
        <ErrorBanner message={labels.transferUnresolved()} onRetry={props.onRetryTransfer} />
      ) : null}
      {props.categoryFailed === true ? (
        <ErrorBanner message={labels.categoryError()} onRetry={props.onRetryCategory} />
      ) : null}
      <SummaryPanel {...props} transaction={transaction} />
      <CategoryPanel {...props} transaction={transaction} />
      <TransferPanel {...props} transaction={transaction} />
      <NotesPanel {...props} />
      <CategorySheet {...props} transaction={transaction} />
    </ScrollView>
  );
}

type ReadyProps = TransactionDetailViewProps & { readonly transaction: TransactionView };

function SummaryPanel({ transaction, categoryName }: ReadyProps): React.JSX.Element {
  const styles = useStyles();
  const labels = useTransactionLabels();
  const sourceText = transaction.source === 'manual' ? labels.sourceManual() : labels.sourceBank();
  const sourceLine = [labels.longDate(transaction.occurredOn), sourceText].join(' · ');

  return (
    <GlassPanel
      material="frosted"
      depth={1}
      decor={{ specular: true, film: true }}
      contentStyle={styles.panel}
    >
      <Text accessibilityRole="header" style={styles.title}>
        {titleOf(transaction)}
      </Text>
      <Text style={styles.dim}>{sourceLine}</Text>
      <AmountText
        amount={{
          amountMinor: parseMinorUnits(transaction.amount.amountMinor),
          currency: transaction.amount.currency,
        }}
        size="amount"
        style={styles.amount}
      />
      {transaction.isTransfer ? (
        <StatusTag kind="neutral" label={labels.statusTransfer()} icon="repeat" />
      ) : null}
      {!transaction.isTransfer && transaction.mapping === null ? (
        <StatusTag kind="neutral" label={labels.statusToSort()} icon="tag" />
      ) : null}
      {!transaction.isTransfer && transaction.mapping !== null && categoryName !== undefined ? (
        <StatusTag kind="ok" label={categoryName} icon="tag" />
      ) : null}
    </GlassPanel>
  );
}

function CategoryPanel({
  transaction,
  categoryName,
  onOpenPicker,
  onClearMapping,
}: ReadyProps): React.JSX.Element {
  const styles = useStyles();
  const labels = useTransactionLabels();
  const mapped = transaction.mapping !== null;

  return (
    <GlassPanel material="frosted" depth={1} contentStyle={styles.panel}>
      <Text accessibilityRole="header" style={styles.label}>
        {labels.category()}
      </Text>
      <Text style={styles.body}>{mapped ? (categoryName ?? '') : labels.notSorted()}</Text>
      <View style={styles.actions}>
        <TransactionActionButton
          primary={!mapped}
          label={mapped ? labels.change() : labels.choose()}
          onPress={onOpenPicker}
        />
        {mapped ? (
          <TransactionActionButton label={labels.clear()} onPress={onClearMapping} />
        ) : null}
      </View>
    </GlassPanel>
  );
}

function TransferPanel({ transaction, onToggleTransfer }: ReadyProps): React.JSX.Element {
  const styles = useStyles();
  const labels = useTransactionLabels();

  return (
    <GlassPanel material="frosted" depth={1} contentStyle={styles.panel}>
      <View style={styles.line}>
        <Text style={styles.label}>{labels.transferSwitch()}</Text>
        <Switch
          checked={transaction.isTransfer}
          onChange={onToggleTransfer}
          label={labels.transferSwitch()}
        />
      </View>
      <Text style={styles.dim}>{labels.transferHint()}</Text>
    </GlassPanel>
  );
}

function NotesPanel({
  notes,
  saving,
  onNotesChange,
  onSaveNotes,
}: TransactionDetailViewProps): React.JSX.Element {
  const styles = useStyles();
  const glass = useGlass();
  const labels = useTransactionLabels();

  return (
    <GlassPanel material="frosted" depth={1} contentStyle={styles.panel}>
      <Text accessibilityRole="header" style={styles.label}>
        {labels.notes()}
      </Text>
      <TextInput
        accessibilityLabel={labels.notes()}
        multiline
        value={notes}
        onChangeText={onNotesChange}
        placeholder={labels.notesPlaceholder()}
        placeholderTextColor={glass.colors.dim}
        style={styles.input}
      />
      <View style={styles.actions}>
        <TransactionActionButton
          primary
          disabled={saving}
          label={labels.save()}
          onPress={onSaveNotes}
        />
      </View>
    </GlassPanel>
  );
}

function CategorySheet({
  transaction,
  options,
  optionsStatus,
  onRetryOptions,
  pickerOpen,
  onClosePicker,
  onPickItem,
}: ReadyProps): React.JSX.Element {
  const styles = useStyles();
  const labels = useTransactionLabels();
  const current = transaction.mapping?.plannedItemId;

  return (
    <Sheet isOpen={pickerOpen} onClose={onClosePicker} title={labels.pickerTitle()}>
      <View style={styles.options}>
        {optionsStatus === 'loading' ? <SkeletonList rows={2} /> : null}
        {optionsStatus === 'error' ? (
          <ErrorBanner message={labels.pickerError()} onRetry={onRetryOptions} />
        ) : null}
        {optionsStatus === 'ready' && options.length === 0 ? (
          <Text style={styles.dim}>{labels.pickerEmpty()}</Text>
        ) : null}
        {options.map((option) => (
          <Pressable
            key={option.plannedItemId}
            accessibilityRole="button"
            accessibilityState={{ selected: option.plannedItemId === current }}
            onPress={() => onPickItem(option.plannedItemId)}
            style={styles.option}
          >
            <Text style={styles.body}>{option.categoryName}</Text>
            <Text style={styles.dim}>
              {labels.optionSubtitle(option.planName, option.direction)}
            </Text>
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
}
