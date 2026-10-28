import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { MoneyView } from '../MoneyView.js';
import { spyOnApiClient } from '../../../test/apiClientSpies.js';

spyOnApiClient();

const RATES = vi.hoisted(() => ({
  table: {
    baseCurrency: 'EUR',
    rates: { PLN: 4.2823 } as Record<string, number>,
    fetchedAt: '2026-10-21T00:00:00Z',
  },
}));

vi.mock('../../../infrastructure/fx/FxRateCache.js', () => ({
  getCachedRates: () => RATES.table,
  fetchAndCacheRates: () => Promise.resolve(RATES.table),
}));

function memoryStorage(initial: Record<string, string>): Pick<Storage, 'getItem'> {
  const entries = new Map(Object.entries(initial));

  return { getItem: (key: string) => entries.get(key) ?? null };
}

function renderMoney(amountMinor: bigint, currency: string, showTooltip = true): void {
  render(
    <IntlProvider locale="pl" messages={{}}>
      <MoneyView amount={{ amountMinor, currency }} showTooltip={showTooltip} />
    </IntlProvider>,
  );
}

describe('MoneyView', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage({ pb_base_currency: 'EUR' }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('delegates to AmountText in its own currency', () => {
    renderMoney(123456n, 'PLN');

    const button = screen.getByRole('button');

    expect(button.querySelector('[data-part="currency"]')?.textContent).toBe('zł');
    expect(button.getAttribute('aria-label')?.replace(/[  ]/g, ' ')).toBe('1 234,56 zł');
  });

  it('converts in exact minor units on click and shows the rate', () => {
    renderMoney(428230n, 'PLN');

    fireEvent.click(screen.getByRole('button'));

    const button = screen.getByRole('button');

    expect(button.textContent?.replace(/[  ]/g, ' ')).toBe('1 000,00 €');
    expect(button.getAttribute('title')).toBe('1 PLN = 0.2335 EUR');
  });

  it('does not lose a cent to float maths on a huge amount', () => {
    RATES.table.rates = { PLN: 1 };
    renderMoney(9007199254740993n, 'PLN');

    fireEvent.click(screen.getByRole('button'));

    expect(screen.getByRole('button').textContent).toContain('90');
    expect(screen.getByRole('button').textContent?.replace(/\D/g, '')).toBe('9007199254740993');
    RATES.table.rates = { PLN: 4.2823 };
  });

  it('shows a dash when the rate is missing', () => {
    renderMoney(100n, 'CHF');

    fireEvent.click(screen.getByRole('button'));

    expect(screen.getByRole('button').textContent).toBe('≈ EUR –');
  });
});
