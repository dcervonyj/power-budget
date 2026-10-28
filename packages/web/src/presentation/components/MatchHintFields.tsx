import React from 'react';
import { useIntl } from 'react-intl';
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

/** AI-004: the planned item's match hint (counterparty, amount +- tolerance, day +- window). */
export function MatchHintFields({
  idPrefix,
  values,
  invalid,
  onChange,
}: MatchHintFieldsProps): React.JSX.Element {
  const intl = useIntl();
  const field = (name: MatchHintField, id: string, defaultMessage: string): React.JSX.Element => (
    <Input
      id={`${idPrefix}-${name}`}
      label={intl.formatMessage({ id, defaultMessage })}
      value={values[name]}
      state={invalid.includes(name) ? 'error' : 'default'}
      onChange={(value) => {
        onChange({ ...values, [name]: value });
      }}
    />
  );

  return (
    <div style={GRID_STYLE}>
      {field('counterpartyPattern', 'plan.matchHint.counterparty', 'Counterparty contains')}
      {field('amount', 'plan.matchHint.amount', 'Expected amount')}
      {field('tolerance', 'plan.matchHint.tolerance', 'Amount tolerance (±)')}
      {field('dayOfMonth', 'plan.matchHint.dayOfMonth', 'Day of month')}
      {field('dayWindow', 'plan.matchHint.dayWindow', 'Day window (± days)')}
    </div>
  );
}
