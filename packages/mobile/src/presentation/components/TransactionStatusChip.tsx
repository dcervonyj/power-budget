import React from 'react';
import { useIntl } from 'react-intl';
import { StatusTag } from '../glass/atoms/StatusTag.js';

export type TransactionStatus = 'mapped' | 'unmapped' | 'transfer';

interface TransactionStatusChipProps {
  readonly status: TransactionStatus;
}

/** Mapping status of a transaction, shown as a glass StatusTag (icon plus words). */
export function TransactionStatusChip({ status }: TransactionStatusChipProps): React.JSX.Element {
  const intl = useIntl();
  if (status === 'mapped') {
    return (
      <StatusTag
        kind="ok"
        label={intl.formatMessage({
          id: 'component.transactionStatus.mapped',
          defaultMessage: 'Mapped',
        })}
      />
    );
  }
  if (status === 'transfer') {
    return (
      <StatusTag
        kind="neutral"
        icon="repeat"
        label={intl.formatMessage({
          id: 'component.transactionStatus.transfer',
          defaultMessage: 'Transfer',
        })}
      />
    );
  }

  return (
    <StatusTag
      kind="neutral"
      icon="tag"
      label={intl.formatMessage({
        id: 'component.transactionStatus.unmapped',
        defaultMessage: 'Unmapped',
      })}
    />
  );
}
