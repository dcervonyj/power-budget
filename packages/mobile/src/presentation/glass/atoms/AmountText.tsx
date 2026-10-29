import React from 'react';
import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';
import { useIntl } from 'react-intl';
import type { MinorUnitAmount, SupportedLocale } from '@power-budget/core';
import { formatMoneyParts, type MoneyPart } from '@power-budget/core';
import { makeStyles, useGlass } from '../../theme/index.js';
import { toSupportedLocale } from './supportedLocale.js';

export type AmountTextSize = 'inline' | 'amount' | 'figure' | 'hero' | 'display';

export interface AmountTextProps {
  readonly amount: MinorUnitAmount;
  readonly size?: AmountTextSize;
  /** Defaults to the active react-intl locale. */
  readonly locale?: SupportedLocale;
  /** Overrides the base text style (colour, font size); the currency part stays dim. */
  readonly style?: StyleProp<TextStyle>;
}

const CURRENCY_SCALE: Readonly<Record<AmountTextSize, number>> = {
  inline: 1,
  amount: 0.7,
  figure: 0.4,
  hero: 0.4,
  display: 0.4,
};

const useStyles = makeStyles((glass) => ({
  base: { color: glass.colors.fg, fontVariant: ['tabular-nums'] },
  inline: { fontFamily: 'Geist_400Regular', fontSize: glass.type.body.mobile },
  amount: { fontFamily: 'Geist_300Light', fontSize: glass.type.amount.mobile },
  figure: {
    fontFamily: 'Geist_300Light',
    fontSize: glass.type.figure.mobile,
    letterSpacing: -0.04 * glass.type.figure.mobile,
  },
  hero: {
    fontFamily: 'Geist_300Light',
    fontSize: glass.type.hero.mobile,
    letterSpacing: -0.04 * glass.type.hero.mobile,
  },
  display: {
    fontFamily: 'Geist_300Light',
    fontSize: glass.type.display.mobile,
    letterSpacing: -0.04 * glass.type.display.mobile,
  },
}));

/** An exact money amount; the currency part is dimmed and the minus is U+2212. */
export function AmountText({
  amount,
  size = 'inline',
  locale,
  style,
}: AmountTextProps): React.JSX.Element {
  const intl = useIntl();
  const styles = useStyles();
  const glass = useGlass();
  const resolvedLocale = locale ?? toSupportedLocale(intl.locale);
  const parts = formatMoneyParts(amount, resolvedLocale);
  const textStyle: StyleProp<TextStyle> = [styles.base, styles[size], style];
  const baseFontSize = StyleSheet.flatten(textStyle)?.fontSize ?? glass.type.body.mobile;

  return (
    <Text testID="amount-text" numberOfLines={1} style={textStyle}>
      {parts.map((part, index) => (
        <AmountPart
          key={`${part.type}-${String(index)}`}
          part={part}
          dim={glass.colors.dim}
          fontSize={Math.round(baseFontSize * CURRENCY_SCALE[size])}
        />
      ))}
    </Text>
  );
}

interface AmountPartProps {
  readonly part: MoneyPart;
  readonly dim: string;
  readonly fontSize: number;
}

function AmountPart({ part, dim, fontSize }: AmountPartProps): React.JSX.Element {
  if (part.type !== 'currency') {
    return <Text>{part.value}</Text>;
  }

  return <Text style={{ color: dim, fontSize }}>{part.value}</Text>;
}
