import React from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { parseMinorUnits, type MinorUnitAmount } from '@power-budget/core';
import type { MoneyDto } from '@power-budget/shared-app/contract';
import { formatAmountText } from '../../infrastructure/transactions/TransactionView.js';
import { AmountText } from '../glass/atoms/AmountText.js';

interface MoneyTextProps {
  /** An API amount: exact integer-string minor units, never a float. */
  readonly amount: MoneyDto;
  readonly style?: StyleProp<TextStyle>;
}

/** An API amount (`MoneyDto`) shown through the glass AmountText. */
export function MoneyText({ amount, style }: MoneyTextProps): React.JSX.Element {
  const parsed = toMinorUnitAmount(amount);
  if (parsed === null) {
    return <Text style={style}>{formatAmountText(amount)}</Text>;
  }

  return <AmountText amount={parsed} style={style} />;
}

function toMinorUnitAmount(amount: MoneyDto): MinorUnitAmount | null {
  try {
    return { amountMinor: parseMinorUnits(amount.amountMinor), currency: amount.currency };
  } catch {
    return null;
  }
}
