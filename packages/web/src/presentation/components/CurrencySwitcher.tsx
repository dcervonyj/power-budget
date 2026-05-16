import React, { useCallback, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { useTheme } from './ThemeContext.js';

const BASE_CURRENCY_KEY = 'pb_base_currency';
const INTERESTING_CURRENCIES_KEY = 'pb_interesting_currencies';
const DEFAULT_BASE_CURRENCY = 'EUR';

const COMMON_CURRENCIES = ['EUR', 'USD', 'GBP', 'PLN', 'UAH', 'CHF', 'CZK', 'HUF', 'SEK', 'NOK'];

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

export function CurrencySwitcher(): React.JSX.Element {
  const theme = useTheme();
  const intl = useIntl();
  const [baseCurrency, setBaseCurrency] = useState<string>(readBaseCurrency);
  const [interestingCurrencies, setInterestingCurrencies] =
    useState<string[]>(readInterestingCurrencies);

  const handleBaseChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setBaseCurrency(value);
    localStorage.setItem(BASE_CURRENCY_KEY, value);
  }, []);

  const handleInterestingToggle = useCallback((currency: string) => {
    setInterestingCurrencies((prev) => {
      const next = prev.includes(currency)
        ? prev.filter((c) => c !== currency)
        : [...prev, currency];
      localStorage.setItem(INTERESTING_CURRENCIES_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const baseCurrencyLabel = intl.formatMessage({
    id: 'component.currencySwitcher.baseCurrency.label',
    defaultMessage: 'Base currency',
  });

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: theme.space.md,
        padding: theme.space.md,
        backgroundColor: theme.color.surface.raised,
        borderRadius: theme.radius.md,
        border: `1px solid ${theme.color.border.subtle}`,
      }}
    >
      <h3
        style={{
          margin: 0,
          fontSize: theme.fontSize.md,
          fontWeight: theme.fontWeight.semibold,
          color: theme.color.text.primary,
        }}
      >
        <FormattedMessage
          id="component.currencySwitcher.title"
          defaultMessage="Currency settings"
        />
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space.xs }}>
        <label
          htmlFor="pb-base-currency"
          style={{ color: theme.color.text.secondary, fontSize: theme.fontSize.sm }}
        >
          <FormattedMessage
            id="component.currencySwitcher.baseCurrency.label"
            defaultMessage="Base currency"
          />
        </label>
        <select
          id="pb-base-currency"
          value={baseCurrency}
          onChange={handleBaseChange}
          aria-label={baseCurrencyLabel}
          style={{
            backgroundColor: theme.color.surface.mid,
            color: theme.color.text.primary,
            border: `1px solid ${theme.color.border.subtle}`,
            borderRadius: theme.radius.sm,
            padding: `${theme.space.sm}px ${theme.space.md}px`,
            fontSize: theme.fontSize.md,
          }}
        >
          {COMMON_CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space.xs }}>
        <span style={{ color: theme.color.text.secondary, fontSize: theme.fontSize.sm }}>
          <FormattedMessage
            id="component.currencySwitcher.interestingCurrencies.label"
            defaultMessage="Also show in"
          />
        </span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.space.xs }}>
          {COMMON_CURRENCIES.filter((c) => c !== baseCurrency).map((c) => {
            const isSelected = interestingCurrencies.includes(c);
            return (
              <button
                key={c}
                type="button"
                onClick={() => {
                  handleInterestingToggle(c);
                }}
                style={{
                  backgroundColor: isSelected
                    ? theme.color.accent.default
                    : theme.color.surface.mid,
                  color: isSelected ? theme.color.accent.onAccent : theme.color.text.primary,
                  border: `1px solid ${isSelected ? theme.color.accent.default : theme.color.border.subtle}`,
                  borderRadius: theme.radius.pill,
                  padding: `${theme.space.xs}px ${theme.space.sm}px`,
                  fontSize: theme.fontSize.sm,
                  cursor: 'pointer',
                }}
              >
                {c}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
