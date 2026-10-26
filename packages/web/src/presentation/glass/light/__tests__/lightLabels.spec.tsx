import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderLight } from './lightTestUtils.js';
import { formatAmount } from '../../../i18n/formatAmount.js';
import { useLightLabels } from '../useLightLabels.js';

const PER_DAY = { amountMinor: 47700n, currency: 'PLN' };
const PLAN = { amountMinor: 1180000n, currency: 'PLN' };

function Labels({ days }: { days: number }): React.JSX.Element {
  const labels = useLightLabels();

  return (
    <ul>
      <li data-testid="lens">{labels.lensAria(PER_DAY, days)}</li>
      <li data-testid="under">{labels.rodAria('Rent', 'under', PER_DAY, PLAN)}</li>
      <li data-testid="over">{labels.rodAria('Eating out', 'over', PER_DAY, PLAN)}</li>
      <li data-testid="paid">{labels.rodAria('Rent', 'paid', PER_DAY, PLAN)}</li>
      <li data-testid="empty">{labels.rodAria('Home', 'empty', PER_DAY, PLAN)}</li>
      <li data-testid="tube">{labels.tubeAria('Lisbon', PER_DAY, PLAN)}</li>
      <li data-testid="tag-over">{labels.rodTag('over')}</li>
      <li data-testid="tag-paid">{labels.rodTag('paid')}</li>
    </ul>
  );
}

describe('light labels', () => {
  it('speaks the safe-to-spend amount and days left in English', () => {
    const { getByTestId } = renderLight(<Labels days={10} />);

    const perDay = formatAmount(PER_DAY, 'en');
    const plan = formatAmount(PLAN, 'en');

    expect(getByTestId('lens').textContent).toBe(`${perDay} a day, 10 days left`);
    expect(getByTestId('under').textContent).toBe(`Rent: ${perDay} left of ${plan}`);
    expect(getByTestId('over').textContent).toBe(`Eating out: over by ${perDay}`);
    expect(getByTestId('paid').textContent).toBe('Rent: paid');
    expect(getByTestId('empty').textContent).toBe(`Home: nothing left of ${plan}`);
    expect(getByTestId('tag-over').textContent).toBe('Over budget');
    expect(getByTestId('tag-paid').textContent).toBe('Paid');
  });

  it('uses the singular plural form for one day', () => {
    const { getByTestId } = renderLight(<Labels days={1} />);

    expect(getByTestId('lens').textContent).toBe(
      `${formatAmount(PER_DAY, 'en')} a day, 1 day left`,
    );
  });

  it.each([
    ['pl', 10, 'dni do końca'],
    ['pl', 2, 'dni do końca'],
    ['uk', 2, 'дні до кінця'],
    ['ru', 2, 'дня до конца'],
    ['ru', 5, 'дней до конца'],
  ])('translates the lens label for %s with %i days', (locale, days, expected) => {
    const { getByTestId } = renderLight(<Labels days={days} />, locale);

    expect(getByTestId('lens').textContent).toContain(`${days} ${expected}`);
  });
});
