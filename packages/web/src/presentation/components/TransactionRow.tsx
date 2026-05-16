import React from 'react';
import { useIntl } from 'react-intl';
import { useTheme } from './ThemeContext.js';
import { MoneyView } from './MoneyView.js';
import type { Transaction } from './TransactionDetailModal.js';

export interface TransactionRowProps {
  transaction: Transaction;
  onClick: (id: string) => void;
}

export function TransactionRow({ transaction, onClick }: TransactionRowProps): React.JSX.Element {
  const theme = useTheme();
  const intl = useIntl();

  const dateStr = new Date(transaction.occurredOn).toLocaleDateString(intl.locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const isTransfer = transaction.isTransfer;
  const isMapped = transaction.mapping !== null && !isTransfer;
  const isUnmapped = !transaction.mapping && !isTransfer;

  const chipLabel = isTransfer
    ? intl.formatMessage({
        id: 'component.transactionRow.transfer',
        defaultMessage: 'Transfer',
      })
    : isUnmapped
      ? intl.formatMessage({
          id: 'component.transactionRow.unmapped',
          defaultMessage: 'Unmapped',
        })
      : null;

  const chipColor = isTransfer ? theme.color.accent.default : theme.color.status.danger;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => {
        onClick(transaction.id);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClick(transaction.id);
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: theme.space.md,
        padding: `${theme.space.md}px ${theme.space.lg}px`,
        backgroundColor: theme.color.surface.raised,
        borderRadius: theme.radius.md,
        border: `1px solid ${theme.color.border.subtle}`,
        cursor: 'pointer',
      }}
    >
      <span
        style={{ color: theme.color.text.secondary, fontSize: theme.fontSize.sm, minWidth: 100 }}
      >
        {dateStr}
      </span>

      <span
        style={{
          flex: 1,
          color: theme.color.text.primary,
          fontSize: theme.fontSize.md,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {transaction.merchant ?? transaction.description}
      </span>

      {isMapped && transaction.mapping && (
        <span
          style={{
            fontSize: theme.fontSize.sm,
            color: theme.color.text.secondary,
            maxWidth: 140,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {transaction.mapping.categoryName}
        </span>
      )}

      {chipLabel !== null && (
        <span
          style={{
            fontSize: theme.fontSize.xs,
            color: chipColor,
            border: `1px solid ${chipColor}`,
            borderRadius: theme.radius.sm,
            padding: `2px ${theme.space.sm}px`,
            whiteSpace: 'nowrap',
          }}
        >
          {chipLabel}
        </span>
      )}

      <span
        style={{ fontWeight: theme.fontWeight.medium, minWidth: 110, textAlign: 'right' }}
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <MoneyView
          amountMinor={transaction.amountMinor}
          currency={transaction.currency}
          showTooltip={false}
        />
      </span>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick(transaction.id);
        }}
        style={{
          background: 'none',
          border: `1px solid ${theme.color.border.strong}`,
          borderRadius: theme.radius.sm,
          color: theme.color.text.primary,
          cursor: 'pointer',
          padding: `${theme.space.xs}px ${theme.space.sm}px`,
          fontSize: theme.fontSize.sm,
          whiteSpace: 'nowrap',
        }}
      >
        {transaction.mapping
          ? intl.formatMessage({ id: 'screen.transactionDetail.mapping', defaultMessage: 'Mapped' })
          : intl.formatMessage({ id: 'screen.transactionDetail.mapTo', defaultMessage: 'Map' })}
      </button>
    </div>
  );
}
