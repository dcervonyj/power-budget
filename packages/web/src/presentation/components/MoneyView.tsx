import { apiClient } from '../../composition.js';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import { formatMoney, type MinorUnitAmount } from '@power-budget/core';
import { fetchAndCacheRates, getCachedRates } from '../../infrastructure/fx/FxRateCache.js';
import type { FxRateTable } from '../../infrastructure/fx/FxRateCache.js';
import { toSupportedLocale } from '../i18n/supportedLocale.js';
import { AmountText } from '../glass/atoms/AmountText.js';
import {
  convertDisplayMoney,
  displayFxRatio,
  formatDisplayRate,
} from '../glass/atoms/convertDisplayMoney.js';

export interface MoneyViewProps {
  /** Exact minor units; shown in its own currency without any float maths. */
  amount: MinorUnitAmount;
  showTooltip?: boolean;
}

const BASE_CURRENCY_KEY = 'pb_base_currency';
const INTERESTING_CURRENCIES_KEY = 'pb_interesting_currencies';
const DEFAULT_BASE_CURRENCY = 'EUR';

function readBaseCurrency(): string {
  return localStorage.getItem(BASE_CURRENCY_KEY) ?? DEFAULT_BASE_CURRENCY;
}

function readInterestingCurrencies(): string[] {
  try {
    const raw = localStorage.getItem(INTERESTING_CURRENCIES_KEY);
    if (!raw) {
      return [];
    }

    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

export function MoneyView({ amount, showTooltip = true }: MoneyViewProps): React.JSX.Element {
  const intl = useIntl();
  const { currency } = amount;
  const [modeIndex, setModeIndex] = useState(0);
  const [fxRates, setFxRates] = useState<FxRateTable | null>(getCachedRates);

  useEffect(() => {
    void fetchAndCacheRates(apiClient).then(setFxRates);
  }, []);

  const modes = useMemo(() => {
    const base = readBaseCurrency();
    const interesting = readInterestingCurrencies();
    const all = [currency, base, ...interesting];
    // deduplicate while preserving order
    const seen = new Set<string>();

    return all.filter((c) => {
      if (seen.has(c)) {
        return false;
      }
      seen.add(c);

      return true;
    });
  }, [currency]);

  const handleClick = useCallback(() => {
    setModeIndex((prev) => (prev + 1) % modes.length);
  }, [modes.length]);

  const targetCurrency = modes[modeIndex] ?? currency;

  const locale = toSupportedLocale(intl.locale);
  const shown =
    targetCurrency === currency ? amount : toTargetAmount(amount, targetCurrency, fxRates);
  const rate = fxRates === null ? null : displayFxRatio(currency, targetCurrency, fxRates);

  let tooltipText = '';
  if (showTooltip && targetCurrency !== currency) {
    tooltipText =
      rate === null
        ? intl.formatMessage({
            id: 'component.moneyView.rateUnavailable',
            defaultMessage: 'Rate unavailable',
          })
        : intl.formatMessage(
            { id: 'component.moneyView.tooltip', defaultMessage: '1 {from} = {rate} {to}' },
            { from: currency, rate: formatDisplayRate(rate), to: targetCurrency },
          );
  }

  const label = shown === null ? `≈ ${targetCurrency} –` : formatMoney(shown, locale);
  const content = shown === null ? label : <AmountText amount={shown} locale={locale} />;

  return (
    <span
      onClick={handleClick}
      title={showTooltip ? tooltipText : undefined}
      style={{ cursor: modes.length > 1 ? 'pointer' : 'default', userSelect: 'none' }}
      role="button"
      tabIndex={modes.length > 1 ? 0 : undefined}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          handleClick();
        }
      }}
      aria-label={label}
    >
      {content}
    </span>
  );
}

function toTargetAmount(
  amount: MinorUnitAmount,
  targetCurrency: string,
  fxRates: FxRateTable | null,
): MinorUnitAmount | null {
  if (fxRates === null) {
    return null;
  }

  return convertDisplayMoney(amount, targetCurrency, fxRates);
}
