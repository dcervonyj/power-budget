import React from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { rnDarkTheme } from '@power-budget/design-tokens/rn';
import type { MoneyDto } from '@power-budget/shared-app/contract';
import { formatAmountText } from '../../infrastructure/transactions/TransactionView.js';

const t = rnDarkTheme;

interface MoneyTextProps {
  /** An API amount: exact integer-string minor units, never a float. */
  readonly amount: MoneyDto;
  readonly style?: StyleProp<TextStyle>;
}

export function MoneyText({ amount, style }: MoneyTextProps): React.JSX.Element {
  return (
    <Text style={[{ color: t.colorTextPrimary, fontSize: t.fontSizeSm }, style]}>
      {formatAmountText(amount)}
    </Text>
  );
}
