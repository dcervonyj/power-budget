import React from 'react';
import { useIntl } from 'react-intl';
import type { MinorUnitAmount, SupportedLocale } from '@power-budget/core';
import { formatMoneyParts, type MoneyPart } from '@power-budget/shared-app';
import { toSupportedLocale } from '../../i18n/supportedLocale.js';

export type AmountTextSize = 'inline' | 'amount' | 'figure' | 'hero' | 'display';

export interface AmountTextProps {
  readonly amount: MinorUnitAmount;
  readonly size?: AmountTextSize;
  /** Defaults to the active react-intl locale. */
  readonly locale?: SupportedLocale;
}

interface SizeStyle {
  readonly fontSize?: string;
  readonly fontWeight: number | string;
  readonly letterSpacing?: string;
  readonly currencyScale: string;
}

const SIZE_STYLES: Readonly<Record<AmountTextSize, SizeStyle>> = {
  inline: { fontWeight: 'inherit', currencyScale: '1em' },
  amount: { fontSize: 'var(--pb-glass-type-amount-web)', fontWeight: 300, currencyScale: '0.7em' },
  figure: {
    fontSize: 'var(--pb-glass-type-figure-web)',
    fontWeight: 'var(--pb-glass-type-figure-weight)',
    letterSpacing: '-0.04em',
    currencyScale: '0.4em',
  },
  hero: {
    fontSize: 'var(--pb-glass-type-hero-web)',
    fontWeight: 'var(--pb-glass-type-hero-weight)',
    letterSpacing: '-0.04em',
    currencyScale: '0.4em',
  },
  display: {
    fontSize: 'var(--pb-glass-type-display-web)',
    fontWeight: 'var(--pb-glass-type-display-weight)',
    letterSpacing: '-0.04em',
    currencyScale: '0.4em',
  },
};

/** An exact money amount; the currency part is dimmed and the minus is U+2212. */
export function AmountText({
  amount,
  size = 'inline',
  locale,
}: AmountTextProps): React.JSX.Element {
  const intl = useIntl();
  const resolvedLocale = locale ?? toSupportedLocale(intl.locale);
  const style = SIZE_STYLES[size];
  const parts = formatMoneyParts(amount, resolvedLocale);

  return (
    <span
      data-size={size}
      style={{
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        letterSpacing: style.letterSpacing,
        fontVariantNumeric: 'tabular-nums',
        whiteSpace: 'nowrap',
      }}
    >
      {parts.map((part, index) => (
        <AmountPart key={`${part.type}-${String(index)}`} part={part} scale={style.currencyScale} />
      ))}
    </span>
  );
}

function AmountPart({ part, scale }: { part: MoneyPart; scale: string }): React.JSX.Element {
  if (part.type !== 'currency') {
    return <span data-part={part.type}>{part.value}</span>;
  }

  return (
    <span data-part="currency" style={{ color: 'var(--pb-glass-dim)', fontSize: scale }}>
      {part.value}
    </span>
  );
}
