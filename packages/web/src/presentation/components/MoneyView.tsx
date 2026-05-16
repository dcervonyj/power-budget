import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useIntl } from 'react-intl';
import { apiClient } from '../../AppProviders.js';
import { fetchAndCacheRates, getCachedRates } from '../../infrastructure/fx/FxRateCache.js';
import type { FxRateTable } from '../../infrastructure/fx/FxRateCache.js';

export interface MoneyViewProps {
  amountMinor: number;
  currency: string;
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
    if (!raw) return [];
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

function convertAmount(
  amountMajor: number,
  fromCurrency: string,
  toCurrency: string,
  rates: FxRateTable,
): number | null {
  if (fromCurrency === toCurrency) return amountMajor;

  const { baseCurrency } = rates;

  if (fromCurrency === baseCurrency) {
    const toRate = rates.rates[toCurrency];
    if (toRate === undefined) return null;
    return amountMajor * toRate;
  }

  if (toCurrency === baseCurrency) {
    const fromRate = rates.rates[fromCurrency];
    if (fromRate === undefined) return null;
    return amountMajor / fromRate;
  }

  const fromRate = rates.rates[fromCurrency];
  const toRate = rates.rates[toCurrency];
  if (fromRate === undefined || toRate === undefined) return null;
  return (amountMajor / fromRate) * toRate;
}

function getDisplayRate(
  fromCurrency: string,
  toCurrency: string,
  rates: FxRateTable,
): number | null {
  // Returns: 1 fromCurrency = X toCurrency
  return convertAmount(1, fromCurrency, toCurrency, rates);
}

export function MoneyView({
  amountMinor,
  currency,
  showTooltip = true,
}: MoneyViewProps): React.JSX.Element {
  const intl = useIntl();
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
      if (seen.has(c)) return false;
      seen.add(c);
      return true;
    });
  }, [currency]);

  const handleClick = useCallback(() => {
    setModeIndex((prev) => (prev + 1) % modes.length);
  }, [modes.length]);

  const targetCurrency = modes[modeIndex] ?? currency;
  const amountMajor = amountMinor / 100;

  let displayAmount: number | null = null;
  let rateAvailable = true;

  if (targetCurrency === currency) {
    displayAmount = amountMajor;
  } else if (fxRates) {
    displayAmount = convertAmount(amountMajor, currency, targetCurrency, fxRates);
    rateAvailable = displayAmount !== null;
  } else {
    rateAvailable = false;
  }

  const formattedAmount = displayAmount !== null ? displayAmount.toFixed(2) : '–';

  let tooltipText = '';
  if (showTooltip && targetCurrency !== currency) {
    if (fxRates && rateAvailable) {
      const rate = getDisplayRate(currency, targetCurrency, fxRates);
      if (rate !== null) {
        tooltipText = intl.formatMessage(
          { id: 'component.moneyView.tooltip', defaultMessage: '1 {from} = {rate} {to}' },
          { from: currency, rate: rate.toFixed(4), to: targetCurrency },
        );
      }
    } else {
      tooltipText = intl.formatMessage({
        id: 'component.moneyView.rateUnavailable',
        defaultMessage: 'Rate unavailable',
      });
    }
  }

  const prefix = !rateAvailable ? '≈ ' : '';
  const display = `${prefix}${targetCurrency} ${formattedAmount}`;

  return (
    <span
      onClick={handleClick}
      title={showTooltip ? tooltipText : undefined}
      style={{ cursor: modes.length > 1 ? 'pointer' : 'default', userSelect: 'none' }}
      role="button"
      tabIndex={modes.length > 1 ? 0 : undefined}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') handleClick();
      }}
      aria-label={display}
    >
      {display}
    </span>
  );
}
