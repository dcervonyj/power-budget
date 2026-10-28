import React from 'react';
import type { TxRowData } from '@power-budget/shared-app';
import { AmountText } from '../atoms/AmountText.js';
import { Avatar } from '../atoms/Avatar.js';
import { Icon } from '../atoms/Icon.js';
import type { IconName } from '../atoms/iconPaths.js';
import { StatusTag } from '../atoms/StatusTag.js';
import '../controls/controls.css';
import {
  LINE_STYLE,
  MAIN_BUTTON_STYLE,
  PLAIN_MAIN_STYLE,
  ROW_STYLE,
  SMALL_STYLE,
  TEXT_COLUMN_STYLE,
  TITLE_STYLE,
} from './rowStyles.js';
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

const ACTION_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 44,
  padding: '0 var(--pb-glass-space-lg)',
  border: 'none',
  borderRadius: 'var(--pb-glass-radius-control)',
  background: 'var(--pb-glass-fill2)',
  color: 'var(--pb-glass-fg)',
  fontSize: 'var(--pb-glass-type-label-web)',
  fontWeight: 'var(--pb-glass-type-label-weight)',
  cursor: 'pointer',
};

const PRIMARY_ACTION_STYLE: React.CSSProperties = {
  ...ACTION_STYLE,
  boxShadow: 'var(--pb-glass-clear-rim)',
};

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
  const labels = useRowLabels();
  const kind = rowKind(transaction, live);
  const amount = { amountMinor: transaction.amountMinor, currency: transaction.currency };
  const name = labels.txName({
    kind,
    title: transaction.title,
    amount,
    subtitle: transaction.subtitle,
    suggestion: transaction.suggestionLabel,
  });
  const hasMain = onPress !== undefined;

  return (
    <div role="group" aria-label={name} data-kind={kind} style={ROW_STYLE}>
      <div style={LINE_STYLE}>
        {hasMain ? (
          <button
            type="button"
            className="pbg-ctl"
            onClick={() => onPress(transaction.id)}
            style={MAIN_BUTTON_STYLE}
          >
            <TxMain transaction={transaction} />
          </button>
        ) : (
          <div style={PLAIN_MAIN_STYLE}>
            <TxMain transaction={transaction} />
          </div>
        )}
        <TxAmount transaction={transaction} kind={kind} />
      </div>
      <TxTags kind={kind} provenance={provenance} labels={labels} />
      {kind === 'to-sort' && transaction.suggestionLabel !== undefined ? (
        <TxSuggestion
          transaction={transaction}
          applied={suggestionApplied}
          labels={labels}
          onConfirm={onConfirmSuggestion}
          onUndo={onUndoSuggestion}
          onChoose={onChooseCategory}
        />
      ) : null}
      {kind === 'to-sort' && transaction.suggestionLabel === undefined && onChooseCategory ? (
        <div style={{ display: 'flex', gap: 'var(--pb-glass-space-sm)' }}>
          <ChooseButton transaction={transaction} labels={labels} onChoose={onChooseCategory} />
        </div>
      ) : null}
    </div>
  );
}

function rowKind(transaction: TxRowData, live: boolean): TxRowKind {
  if (transaction.status === 'booked' && live) {
    return 'live';
  }

  return transaction.status;
}

function TxMain({ transaction }: { transaction: TxRowData }): React.JSX.Element {
  return (
    <>
      {transaction.payer === undefined ? null : <Avatar person={{ name: transaction.payer }} />}
      <span style={TEXT_COLUMN_STYLE}>
        <span style={TITLE_STYLE}>{transaction.title}</span>
        <span style={SMALL_STYLE}>{transaction.subtitle}</span>
      </span>
    </>
  );
}

function TxAmount({
  transaction,
  kind,
}: {
  transaction: TxRowData;
  kind: TxRowKind;
}): React.JSX.Element {
  const { originalAmountMinor, originalCurrency } = transaction;

  return (
    <span
      data-testid="tx-amount"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 2,
        color: kind === 'transfer' ? 'var(--pb-glass-dim)' : 'var(--pb-glass-fg)',
        fontSize: 'var(--pb-glass-type-panel-label-web)',
      }}
    >
      <AmountText
        amount={{ amountMinor: transaction.amountMinor, currency: transaction.currency }}
      />
      {originalAmountMinor !== undefined && originalCurrency !== undefined ? (
        <span aria-hidden="true" style={SMALL_STYLE}>
          <AmountText
            amount={{
              amountMinor: originalAmountMinor,
              currency: originalCurrency,
            }}
          />
        </span>
      ) : null}
    </span>
  );
}

function TxTags({
  kind,
  provenance,
  labels,
}: {
  kind: TxRowKind;
  provenance?: TxProvenance;
  labels: RowLabels;
}): React.JSX.Element | null {
  if (kind === 'booked' && provenance === undefined) {
    return null;
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--pb-glass-space-sm)' }}>
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
    </div>
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
}: TxSuggestionProps): React.JSX.Element {
  const category = transaction.suggestionLabel ?? '';
  const percent =
    transaction.suggestionConfidence === undefined
      ? undefined
      : Math.round(transaction.suggestionConfidence * 100);

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 'var(--pb-glass-space-md)',
      }}
    >
      <span
        style={{
          ...SMALL_STYLE,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--pb-glass-space-xs)',
          color: 'var(--pb-glass-fg)',
          flex: '1 1 140px',
        }}
      >
        <Icon name="tag" size={14} />
        {applied ? labels.suggestionApplied(category) : labels.suggestionText(category, percent)}
      </span>
      {applied ? (
        onUndo && (
          <button
            type="button"
            className="pbg-ctl"
            aria-label={labels.undoAction(transaction.title)}
            onClick={() => onUndo(transaction.id)}
            style={ACTION_STYLE}
          >
            {labels.undoText()}
          </button>
        )
      ) : (
        <>
          {onConfirm && (
            <button
              type="button"
              className="pbg-ctl"
              aria-label={labels.confirmAction(transaction.title)}
              onClick={() => onConfirm(transaction.id)}
              style={PRIMARY_ACTION_STYLE}
            >
              {labels.confirmText()}
            </button>
          )}
          {onChoose && (
            <ChooseButton transaction={transaction} labels={labels} onChoose={onChoose} />
          )}
        </>
      )}
    </div>
  );
}

function ChooseButton({
  transaction,
  labels,
  onChoose,
}: {
  transaction: TxRowData;
  labels: RowLabels;
  onChoose: (id: string) => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      className="pbg-ctl"
      aria-label={labels.chooseAction(transaction.title)}
      onClick={() => onChoose(transaction.id)}
      style={ACTION_STYLE}
    >
      {labels.chooseText()}
    </button>
  );
}
