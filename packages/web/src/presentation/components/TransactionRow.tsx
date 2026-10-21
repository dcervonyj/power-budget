import React from 'react';
import { useIntl } from 'react-intl';
import { useTheme } from './ThemeContext.js';
import { parseLocalIsoDate } from '@power-budget/core';
import { MoneyView } from './MoneyView.js';
import type { Transaction } from '../../domain/transactions/Transaction.js';
import type { MappingView } from '../../application/transactions/TransactionMappingStore.js';

export interface TransactionRowProps {
  transaction: Transaction;
  /** What the row is: mapped to an item, transfer, ignored, unmapped, or still being checked. */
  mapping: MappingView;
  /** Opens the detail modal. */
  onClick: (id: string) => void;
  /** Opens the map modal. */
  onMap: (id: string) => void;
}

export function TransactionRow({
  transaction,
  mapping,
  onClick,
  onMap,
}: TransactionRowProps): React.JSX.Element {
  const theme = useTheme();
  const intl = useIntl();

  const dateStr = parseLocalIsoDate(transaction.occurredOn).toLocaleDateString(intl.locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const statusLabel = statusChipLabel(transaction.status);
  const mappingChip = mappingChipOf(mapping);
  const canMap = mapping.kind !== 'transfer' && mapping.kind !== 'ignored';

  function statusChipLabel(status: Transaction['status']): string | null {
    switch (status) {
      case 'pending':
        return intl.formatMessage({ id: 'transaction.status.pending', defaultMessage: 'Pending' });
      case 'cancelled':
        return intl.formatMessage({
          id: 'transaction.status.cancelled',
          defaultMessage: 'Cancelled',
        });
      case 'posted':
        return null;
    }
  }

  function mappingChipOf(view: MappingView): { label: string; color: string } | null {
    switch (view.kind) {
      case 'checking':
        return null;
      case 'transfer':
        return {
          label: intl.formatMessage({
            id: 'component.transactionRow.transfer',
            defaultMessage: 'Transfer',
          }),
          color: theme.color.accent.default,
        };
      case 'ignored':
        return {
          label: intl.formatMessage({
            id: 'component.transactionRow.ignored',
            defaultMessage: 'Ignored',
          }),
          color: theme.color.text.secondary,
        };
      case 'unmapped':
        return {
          label: intl.formatMessage({
            id: 'component.transactionRow.unmapped',
            defaultMessage: 'Unmapped',
          }),
          color: theme.color.status.danger,
        };
      case 'mapped':
        return null;
    }
  }

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
        flexWrap: 'wrap',
        alignItems: 'center',
        columnGap: theme.space.md,
        rowGap: theme.space.xs,
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
          flex: '1 1 140px',
          minWidth: 0,
          color: theme.color.text.primary,
          fontSize: theme.fontSize.md,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {transaction.merchant ?? transaction.description}
      </span>

      {statusLabel !== null && <Chip label={statusLabel} color={theme.color.status.warning} />}

      {mapping.kind === 'mapped' && (
        <span
          data-testid="mapping-target"
          style={{
            fontSize: theme.fontSize.sm,
            color: theme.color.text.secondary,
            maxWidth: 200,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {mapping.categoryName || mapping.planName || mapping.plannedItemId}
        </span>
      )}

      {mappingChip !== null && <Chip label={mappingChip.label} color={mappingChip.color} />}

      <span
        style={{ fontWeight: theme.fontWeight.medium, minWidth: 110, textAlign: 'right' }}
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <MoneyView amount={transaction.amount} showTooltip={false} />
      </span>

      {canMap && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onMap(transaction.id);
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
          {mapping.kind === 'mapped'
            ? intl.formatMessage({
                id: 'component.transactionRow.remap',
                defaultMessage: 'Change',
              })
            : intl.formatMessage({ id: 'screen.transactionMap.action', defaultMessage: 'Map' })}
        </button>
      )}
    </div>
  );
}

function Chip({ label, color }: { label: string; color: string }): React.JSX.Element {
  const theme = useTheme();

  return (
    <span
      style={{
        fontSize: theme.fontSize.xs,
        color,
        border: `1px solid ${color}`,
        borderRadius: theme.radius.sm,
        padding: `2px ${theme.space.sm}px`,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}
