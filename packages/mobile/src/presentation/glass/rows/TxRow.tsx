import React from 'react';
import { Pressable, Text, View } from 'react-native';
import type { TxRowData } from '@power-budget/shared-app';
import { useGlass } from '../../theme/index.js';
import { AmountText } from '../atoms/AmountText.js';
import { Avatar } from '../atoms/Avatar.js';
import { Icon } from '../atoms/Icon.js';
import type { IconName } from '../atoms/iconPaths.js';
import { StatusTag } from '../atoms/StatusTag.js';
import { useRowStyles } from './rowStyles.js';
import { useRowLabels, type RowLabels, type TxProvenance, type TxRowKind } from './useRowLabels.js';

export interface TxRowProps {
  readonly transaction: TxRowData;
  /** A booked row that just arrived from the bank. */
  readonly live?: boolean;
  /** Where the transaction or its category came from. */
  readonly provenance?: TxProvenance;
  /** To-sort row: the suggestion has been accepted, so Undo replaces Confirm. */
  readonly suggestionApplied?: boolean;
  readonly onPress?: (id: string) => void;
  readonly onConfirmSuggestion?: (id: string) => void;
  readonly onUndoSuggestion?: (id: string) => void;
  readonly onChooseCategory?: (id: string) => void;
}

const PROVENANCE_ICONS: Readonly<Record<TxProvenance, IconName>> = {
  bank: 'bank',
  manual: 'edit',
  rule: 'repeat',
};

const PERCENT = 100;
const SUGGESTION_ICON_SIZE = 14;

/**
 * One transaction in a list. Live, pending and booked rows differ by a tag; a transfer is neutral
 * (dim amount, never counted as spending); a to-sort row carries the suggestion with its actions.
 */
export function TxRow({
  transaction,
  live = false,
  provenance,
  suggestionApplied = false,
  onPress,
  onConfirmSuggestion,
  onUndoSuggestion,
  onChooseCategory,
}: TxRowProps): React.JSX.Element {
  const styles = useRowStyles();
  const labels = useRowLabels();
  const kind = rowKind(transaction, live);
  const name = labels.txName({
    kind,
    title: transaction.title,
    amount: { amountMinor: transaction.amountMinor, currency: transaction.currency },
    subtitle: transaction.subtitle,
    suggestion: transaction.suggestionLabel,
  });
  const main = (
    <>
      {transaction.payer === undefined ? null : <Avatar person={{ name: transaction.payer }} />}
      <View style={styles.textColumn}>
        <Text style={styles.title}>{transaction.title}</Text>
        <Text style={styles.small}>{transaction.subtitle}</Text>
      </View>
    </>
  );

  return (
    <View testID="tx-row" role="group" accessibilityLabel={name} style={styles.row}>
      <View style={styles.line}>
        {onPress === undefined ? (
          <View testID="tx-main" style={styles.mainArea}>
            {main}
          </View>
        ) : (
          <Pressable
            testID="tx-main"
            accessibilityRole="button"
            onPress={() => onPress(transaction.id)}
            style={styles.mainArea}
          >
            {main}
          </Pressable>
        )}
        <TxAmount transaction={transaction} kind={kind} />
      </View>
      <TxTags kind={kind} provenance={provenance} labels={labels} />
      {kind === 'to-sort' ? (
        <TxSuggestion
          transaction={transaction}
          applied={suggestionApplied}
          labels={labels}
          onConfirm={onConfirmSuggestion}
          onUndo={onUndoSuggestion}
          onChoose={onChooseCategory}
        />
      ) : null}
    </View>
  );
}

function rowKind(transaction: TxRowData, live: boolean): TxRowKind {
  if (transaction.status === 'booked' && live) {
    return 'live';
  }

  return transaction.status;
}

function TxAmount({
  transaction,
  kind,
}: {
  readonly transaction: TxRowData;
  readonly kind: TxRowKind;
}): React.JSX.Element {
  const styles = useRowStyles();
  const glass = useGlass();
  const { originalAmountMinor, originalCurrency } = transaction;

  return (
    <View testID="tx-amount" style={styles.figures}>
      <AmountText
        amount={{ amountMinor: transaction.amountMinor, currency: transaction.currency }}
        style={[styles.figure, kind === 'transfer' ? { color: glass.colors.dim } : null]}
      />
      {originalAmountMinor !== undefined && originalCurrency !== undefined ? (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <AmountText
            amount={{
              amountMinor: originalAmountMinor,
              currency: originalCurrency,
            }}
            style={styles.small}
          />
        </View>
      ) : null}
    </View>
  );
}

function TxTags({
  kind,
  provenance,
  labels,
}: {
  readonly kind: TxRowKind;
  readonly provenance?: TxProvenance;
  readonly labels: RowLabels;
}): React.JSX.Element | null {
  const styles = useRowStyles();
  if (kind === 'booked' && provenance === undefined) {
    return null;
  }

  return (
    <View style={styles.tags}>
      {kind === 'live' ? <StatusTag kind="ok" label={labels.statusLive()} icon="sync" /> : null}
      {kind === 'pending' ? <StatusTag kind="neutral" label={labels.statusPending()} /> : null}
      {kind === 'transfer' ? (
        <StatusTag kind="neutral" label={labels.statusTransfer()} icon="repeat" />
      ) : null}
      {kind === 'to-sort' ? (
        <StatusTag kind="neutral" label={labels.statusToSort()} icon="tag" />
      ) : null}
      {provenance === undefined ? null : (
        <StatusTag
          kind="neutral"
          label={labels.provenance(provenance)}
          icon={PROVENANCE_ICONS[provenance]}
        />
      )}
    </View>
  );
}

interface TxSuggestionProps {
  readonly transaction: TxRowData;
  readonly applied: boolean;
  readonly labels: RowLabels;
  readonly onConfirm?: (id: string) => void;
  readonly onUndo?: (id: string) => void;
  readonly onChoose?: (id: string) => void;
}

function TxSuggestion({
  transaction,
  applied,
  labels,
  onConfirm,
  onUndo,
  onChoose,
}: TxSuggestionProps): React.JSX.Element | null {
  const styles = useRowStyles();
  const glass = useGlass();
  const { id, title, suggestionLabel } = transaction;
  const percent =
    transaction.suggestionConfidence === undefined
      ? undefined
      : Math.round(transaction.suggestionConfidence * PERCENT);
  const chooseButton =
    onChoose === undefined ? null : (
      <ActionButton
        label={labels.chooseAction(title)}
        text={labels.chooseText()}
        onPress={() => onChoose(id)}
      />
    );
  if (suggestionLabel === undefined) {
    return chooseButton === null ? null : <View style={styles.suggestion}>{chooseButton}</View>;
  }

  return (
    <View testID="tx-suggestion" style={styles.suggestion}>
      <View style={styles.suggestionText}>
        <Icon name="tag" size={SUGGESTION_ICON_SIZE} color={glass.colors.fg} />
        <Text style={styles.suggestionLabel}>
          {applied
            ? labels.suggestionApplied(suggestionLabel)
            : labels.suggestionText(suggestionLabel, percent)}
        </Text>
      </View>
      {applied ? (
        onUndo === undefined ? null : (
          <ActionButton
            label={labels.undoAction(title)}
            text={labels.undoText()}
            onPress={() => onUndo(id)}
          />
        )
      ) : (
        <>
          {onConfirm === undefined ? null : (
            <ActionButton
              primary
              label={labels.confirmAction(title)}
              text={labels.confirmText()}
              onPress={() => onConfirm(id)}
            />
          )}
          {chooseButton}
        </>
      )}
    </View>
  );
}

interface ActionButtonProps {
  readonly label: string;
  readonly text: string;
  readonly primary?: boolean;
  readonly onPress: () => void;
}

function ActionButton({
  label,
  text,
  primary = false,
  onPress,
}: ActionButtonProps): React.JSX.Element {
  const styles = useRowStyles();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        primary && styles.primaryAction,
        pressed && styles.pressed,
      ]}
    >
      <Text style={styles.actionText}>{text}</Text>
    </Pressable>
  );
}
