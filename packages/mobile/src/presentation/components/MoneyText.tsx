import React from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { rnDarkTheme } from '@power-budget/design-tokens/rn';

const t = rnDarkTheme;

interface MoneyTextProps {
  readonly amountMinor: number;
  readonly currency: string;
  readonly style?: StyleProp<TextStyle>;
}

export function MoneyText({ amountMinor, currency, style }: MoneyTextProps): React.JSX.Element {
  const formatted = (amountMinor / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return (
    <Text style={[{ color: t.colorTextPrimary, fontSize: t.fontSizeSm }, style]}>
      {formatted} {currency}
    </Text>
  );
}
