import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { IntlProvider } from 'react-intl';
import { AmountText } from '../AmountText.js';

const MINUS = '−';
const NBSP = /[  ]/g;

function renderAmount(locale: string, amountMinor: bigint, currency: string): HTMLElement {
  const { container } = render(
    <IntlProvider locale={locale} messages={{}}>
      <AmountText amount={{ amountMinor, currency }} />
    </IntlProvider>,
  );

  return container;
}

function normalisedText(container: HTMLElement): string {
  return (container.textContent ?? '').replace(NBSP, ' ');
}

describe('AmountText', () => {
  it.each([
    ['en', '1 234,56'],
    ['pl', '1 234,56'],
    ['uk', '1 234,56'],
    ['ru', '1 234,56'],
  ])('formats a positive PLN amount in %s', (locale) => {
    const container = renderAmount(locale, 123456n, 'PLN');

    expect(container.textContent).toContain('56');
    expect(container.querySelector('[data-part="currency"]')).not.toBeNull();
    expect(container.querySelector('[data-part="minusSign"]')).toBeNull();
  });

  it('uses grouping and a decimal comma in Polish', () => {
    expect(normalisedText(renderAmount('pl', 123456n, 'PLN'))).toBe('1 234,56 zł');
  });

  it.each(['en', 'pl', 'uk', 'ru'])('shows the minus as U+2212 in %s', (locale) => {
    const container = renderAmount(locale, -123456n, 'PLN');
    const minus = container.querySelector('[data-part="minusSign"]');

    expect(minus?.textContent).toBe(MINUS);
    expect(container.textContent).not.toContain('-');
  });

  it.each(['en', 'pl', 'uk', 'ru'])('dims only the currency part in %s', (locale) => {
    const container = renderAmount(locale, 123456n, 'EUR');
    const currency = container.querySelector<HTMLElement>('[data-part="currency"]');

    expect(currency?.style.color).toBe('var(--pb-glass-dim)');
    expect(container.querySelector('[data-part="integer"]')?.getAttribute('style')).toBeNull();
  });

  it('keeps exact digits beyond 2^53', () => {
    const container = renderAmount('en', 9007199254740993n, 'PLN');

    expect(normalisedText(container)).toContain('93');
    expect(container.textContent?.replace(/\D/g, '')).toContain('9007199254740993');
  });
});
