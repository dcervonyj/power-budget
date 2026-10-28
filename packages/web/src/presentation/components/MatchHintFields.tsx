import React from 'react';
import { defineMessages, useIntl, type MessageDescriptor } from 'react-intl';
import { type MatchHintField, type MatchHintFormValues } from '@power-budget/core';
import { Input } from './Input.js';

export interface MatchHintFieldsProps {
  /** Prefix for the input ids, unique per form on the page. */
  readonly idPrefix: string;
  readonly values: MatchHintFormValues;
  readonly invalid: readonly MatchHintField[];
  readonly onChange: (values: MatchHintFormValues) => void;
}

const GRID_STYLE: React.CSSProperties = {
  display: 'grid',
  gap: 'var(--pb-glass-space-md)',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  alignItems: 'end',
};

const MESSAGES = defineMessages({
  counterparty: { id: 'plan.matchHint.counterparty', defaultMessage: 'Counterparty contains' },
  amount: { id: 'plan.matchHint.amount', defaultMessage: 'Expected amount' },
  tolerance: { id: 'plan.matchHint.tolerance', defaultMessage: 'Amount tolerance (±)' },
  dayOfMonth: { id: 'plan.matchHint.dayOfMonth', defaultMessage: 'Day of month' },
  dayWindow: { id: 'plan.matchHint.dayWindow', defaultMessage: 'Day window (± days)' },
});

/** AI-004: the planned item's match hint (counterparty, amount +- tolerance, day +- window). */
export function MatchHintFields({
  idPrefix,
  values,
  invalid,
  onChange,
}: MatchHintFieldsProps): React.JSX.Element {
  const intl = useIntl();
  const field = (name: MatchHintField, message: MessageDescriptor): React.JSX.Element => (
    <Input
      id={`${idPrefix}-${name}`}
      label={intl.formatMessage(message)}
      value={values[name]}
      state={invalid.includes(name) ? 'error' : 'default'}
      onChange={(value) => {
        onChange({ ...values, [name]: value });
      }}
    />
  );

  return (
    <div style={GRID_STYLE}>
      {field('counterpartyPattern', MESSAGES.counterparty)}
      {field('amount', MESSAGES.amount)}
      {field('tolerance', MESSAGES.tolerance)}
      {field('dayOfMonth', MESSAGES.dayOfMonth)}
      {field('dayWindow', MESSAGES.dayWindow)}
    </div>
  );
}
