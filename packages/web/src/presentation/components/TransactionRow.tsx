import React from 'react';
import { useIntl, type IntlShape } from 'react-intl';
import { parseLocalIsoDate } from '@power-budget/core';
import type { TxRowData } from '@power-budget/shared-app';
import { TxRow } from '../glass/rows/TxRow.js';
import type { TxProvenance } from '../glass/rows/useRowLabels.js';
import type { MappedBy, Transaction } from '../../domain/transactions/Transaction.js';
import type { MappingView } from '../../application/transactions/MappingView.js';

export interface TransactionRowProps {
  transaction: Transaction;
  /** What the row is: mapped to an item (and by whom), transfer, ignored or unmapped. */
  mapping: MappingView;
  /** Opens the detail modal. */
  onClick: (id: string) => void;
  /** Opens the map modal. */
  onMap: (id: string) => void;
  /** Category of the planned item the API suggests for an unmapped row, when it is known. */
  suggestionLabel?: string;
  /** Maps the row to the suggested item; without it the row offers no Confirm. */
  onConfirmSuggestion?: (id: string) => void;
}

const WRAP_STYLE: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 'var(--pb-glass-space-sm)',
};

const CHANGE_STYLE: React.CSSProperties = {
  minHeight: 44,
  padding: '0 var(--pb-glass-space-lg)',
  border: 'none',
  borderRadius: 'var(--pb-glass-radius-control)',
  background: 'var(--pb-glass-fill2)',
  boxShadow: 'var(--pb-glass-clear-rim)',
  color: 'var(--pb-glass-fg)',
  fontFamily: 'inherit',
  fontSize: 'var(--pb-glass-type-label-web)',
  fontWeight: 'var(--pb-glass-type-label-weight)',
  whiteSpace: 'nowrap',
  cursor: 'pointer',
};

/**
 * One transaction of the list, on the glass TxRow: booked, just in, pending, transfer or to sort
 * (with the suggestion and Confirm / Choose). A mapped row names its category and keeps a Change button.
 */
export function TransactionRow({
  transaction,
  mapping,
  onClick,
  onMap,
  suggestionLabel,
  onConfirmSuggestion,
}: TransactionRowProps): React.JSX.Element {
  const intl = useIntl();
  const data = toTxRowData(transaction, mapping, suggestionLabel, intl);
  const toSort = data.status === 'to-sort';

  return (
    <div style={WRAP_STYLE}>
      <div style={{ flex: '1 1 240px', minWidth: 0 }}>
        <TxRow
          transaction={data}
          live={transaction.status === 'live'}
          provenance={provenanceOf(transaction, mapping)}
          onPress={onClick}
          onConfirmSuggestion={
            toSort && suggestionLabel !== undefined ? onConfirmSuggestion : undefined
          }
          onChooseCategory={toSort ? onMap : undefined}
        />
      </div>
      {mapping.kind === 'mapped' ? (
        <button
          type="button"
          className="pbg-ctl"
          aria-label={intl.formatMessage(
            { id: 'tx.row.change.aria', defaultMessage: 'Change the category of {title}' },
            { title: data.title },
          )}
          onClick={() => {
            onMap(transaction.id);
          }}
          style={CHANGE_STYLE}
        >
          {intl.formatMessage({ id: 'component.transactionRow.remap', defaultMessage: 'Change' })}
        </button>
      ) : null}
    </div>
  );
}

function toTxRowData(
  tx: Transaction,
  mapping: MappingView,
  suggestionLabel: string | undefined,
  intl: IntlShape,
): TxRowData {
  return {
    id: tx.id,
    title: tx.merchant ?? tx.description,
    subtitle: subtitleOf(tx, mapping, intl),
    amountMinor: tx.amount.amountMinor,
    currency: tx.amount.currency,
    status: statusOf(tx, mapping),
    suggestionLabel: mapping.kind === 'unmapped' ? suggestionLabel : undefined,
  };
}

function statusOf(tx: Transaction, mapping: MappingView): TxRowData['status'] {
  if (mapping.kind === 'transfer') {
    return 'transfer';
  }
  if (tx.status === 'pending') {
    return 'pending';
  }
  if (mapping.kind === 'unmapped' && !isUncounted(tx)) {
    return 'to-sort';
  }

  return 'booked';
}

/** Cancelled and expired rows count in no total: they never wait to be sorted. */
function isUncounted(tx: Transaction): boolean {
  return tx.status === 'cancelled' || tx.status === 'expired';
}

/** Date first, then what the row is: its category, an archived plan, ignored or cancelled. */
function subtitleOf(tx: Transaction, mapping: MappingView, intl: IntlShape): string {
  const parts = [
    parseLocalIsoDate(tx.occurredOn).toLocaleDateString(intl.locale, {
      month: 'short',
      day: 'numeric',
    }),
  ];
  if (mapping.kind === 'mapped') {
    parts.push(mapping.categoryName || mapping.planName || mapping.plannedItemId);
    if (mapping.planArchived) {
      parts.push(
        intl.formatMessage({
          id: 'component.transactionRow.archivedPlan',
          defaultMessage: 'Archived plan',
        }),
      );
    }
  }
  if (mapping.kind === 'ignored') {
    parts.push(
      intl.formatMessage({ id: 'component.transactionRow.ignored', defaultMessage: 'Ignored' }),
    );
  }
  if (isUncounted(tx)) {
    parts.push(
      intl.formatMessage({ id: 'transaction.status.cancelled', defaultMessage: 'Cancelled' }),
    );
  }

  return parts.join(' · ');
}

/** Who sorted a mapped row; an AI mapping reads as a rule (the kit has no AI provenance). */
function provenanceOf(tx: Transaction, mapping: MappingView): TxProvenance | undefined {
  if (mapping.kind === 'mapped') {
    return provenanceOfMapping(mapping.by);
  }

  return tx.source === 'manual' ? 'manual' : undefined;
}

function provenanceOfMapping(by: MappedBy): TxProvenance {
  return by === 'manual' ? 'manual' : 'rule';
}
