import React from 'react';
import { Text } from 'react-native';
import { screen } from '@testing-library/react-native';
import { formatLightAmount } from '../formatLightAmount.js';
import { useLightLabels } from '../useLightLabels.js';
import { renderLight } from './lightTestUtils.js';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const PER_DAY = { amountMinor: 47700n, currency: 'PLN' };
const PLAN = { amountMinor: 1180000n, currency: 'PLN' };

function Labels({ days }: { readonly days: number }): React.JSX.Element {
  const labels = useLightLabels();

  return (
    <>
      <Text testID="lens">{labels.lensAria(PER_DAY, days)}</Text>
      <Text testID="under">{labels.rodAria('Rent', 'under', PER_DAY, PLAN)}</Text>
      <Text testID="over">{labels.rodAria('Eating out', 'over', PER_DAY, PLAN)}</Text>
      <Text testID="paid">{labels.rodAria('Rent', 'paid', PER_DAY, PLAN)}</Text>
      <Text testID="empty">{labels.rodAria('Home', 'empty', PER_DAY, PLAN)}</Text>
      <Text testID="tube">{labels.tubeAria('Lisbon', PER_DAY, PLAN)}</Text>
      <Text testID="tag-over">{labels.rodTag('over')}</Text>
      <Text testID="tag-paid">{labels.rodTag('paid')}</Text>
    </>
  );
}

function text(testId: string): unknown {
  return screen.getByTestId(testId).props.children;
}

describe('light labels', () => {
  it('speaks exact money and days left in English', async () => {
    await renderLight(<Labels days={10} />);
    const perDay = formatLightAmount(PER_DAY, 'en');
    const plan = formatLightAmount(PLAN, 'en');

    expect(text('lens')).toBe(`${perDay} a day, 10 days left`);
    expect(text('under')).toBe(`Rent: ${perDay} left of ${plan}`);
    expect(text('over')).toBe(`Eating out: over by ${perDay}`);
    expect(text('paid')).toBe('Rent: paid');
    expect(text('empty')).toBe(`Home: nothing left of ${plan}`);
    expect(text('tube')).toBe(`Lisbon: ${perDay} of ${plan}`);
    expect(text('tag-over')).toBe('Over budget');
    expect(text('tag-paid')).toBe('Paid');
  });

  it('formats minor units through core without floats', () => {
    expect(
      formatLightAmount({ amountMinor: 9007199254740993n, currency: 'PLN' }, 'en-GB'),
    ).toContain('90,071,992,547,409.93');
    expect(formatLightAmount(PER_DAY, 'xx')).toBe(formatLightAmount(PER_DAY, 'en'));
  });

  it.each([
    ['pl', 10, 'dni do końca'],
    ['uk', 2, 'дні до кінця'],
    ['ru', 2, 'дня до конца'],
    ['ru', 5, 'дней до конца'],
  ])('translates the lens label for %s with %i days', async (locale, days, expected) => {
    await renderLight(<Labels days={days} />, locale);

    expect(String(text('lens'))).toContain(`${days} ${expected}`);
  });

  it.each(['pl', 'uk', 'ru'])('translates the rod tags for %s', async (locale) => {
    await renderLight(<Labels days={3} />, locale);

    expect(text('tag-paid')).not.toBe('Paid');
    expect(text('tag-over')).not.toBe('Over budget');
  });
});
