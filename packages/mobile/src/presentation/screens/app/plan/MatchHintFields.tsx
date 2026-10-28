import React from 'react';
import { Text, View } from 'react-native';
import { useIntl } from 'react-intl';
import type { MatchHintField, MatchHintFormValues } from '@power-budget/core';
import { Input } from '../../../components/Input.js';
import { usePlanStyles } from './planStyles.js';

export interface MatchHintFieldsProps {
  readonly values: MatchHintFormValues;
  readonly invalid: readonly MatchHintField[];
  readonly onChange: (values: MatchHintFormValues) => void;
}

/** AI-004: the planned item's match hint (counterparty, amount +- tolerance, day +- window). */
export function MatchHintFields({
  values,
  invalid,
  onChange,
}: MatchHintFieldsProps): React.JSX.Element {
  const intl = useIntl();
  const shared = usePlanStyles();
  const field = (
    name: MatchHintField,
    id: string,
    defaultMessage: string,
    keyboardType: 'default' | 'numeric',
  ): React.JSX.Element => (
    <Input
      label={intl.formatMessage({ id, defaultMessage })}
      value={values[name]}
      keyboardType={keyboardType}
      autoCapitalize="none"
      onChangeText={(value) => {
        onChange({ ...values, [name]: value });
      }}
      {...(invalid[0] === name ? { error: ' ' } : {})}
    />
  );

  return (
    <View>
      {field(
        'counterpartyPattern',
        'plan.matchHint.counterparty',
        'Counterparty contains',
        'default',
      )}
      {field('amount', 'plan.matchHint.amount', 'Expected amount', 'numeric')}
      {field('tolerance', 'plan.matchHint.tolerance', 'Amount tolerance (±)', 'numeric')}
      {field('dayOfMonth', 'plan.matchHint.dayOfMonth', 'Day of month', 'numeric')}
      {field('dayWindow', 'plan.matchHint.dayWindow', 'Day window (± days)', 'numeric')}
      {invalid.length > 0 ? (
        <Text accessibilityRole="alert" style={shared.noticeText}>
          {intl.formatMessage({
            id: 'plan.matchHint.invalid',
            defaultMessage:
              'Check the highlighted hint fields. A tolerance needs an amount, and a day window needs a day.',
          })}
        </Text>
      ) : null}
    </View>
  );
}
