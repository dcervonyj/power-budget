import { describe, expect, it } from 'vitest';
import { choicesFor, impactOf, withSorted } from './categorizeModel.js';
import type { CategoryChoice, Payment } from './categorizeModel.js';

function choice(overrides: Partial<CategoryChoice> = {}): CategoryChoice {
  return {
    plannedItemId: 'transport',
    name: 'Transport',
    direction: 'expense',
    plannedMinor: 70000n,
    spentMinor: 31239n,
    currency: 'PLN',
    ...overrides,
  };
}

function payment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: 'orlen',
    amountMinor: -12930n,
    currency: 'PLN',
    suggestedPlannedItemId: null,
    ...overrides,
  };
}

describe('impactOf', () => {
  it('drains the light left by the payment, in exact minor units', () => {
    const impact = impactOf(choice(), payment());

    expect(impact.kind).toBe('drain');
    expect(impact.phase).toBe('under');
    expect(impact.before.amountMinor).toBe(38761n);
    expect(impact.after.amountMinor).toBe(25831n);
    expect(impact.state).toBe('under');
    expect(impact.fraction).toBeCloseTo(25831 / 70000, 10);
  });

  it('crosses the plan when the payment is more than what is left', () => {
    const impact = impactOf(choice({ spentMinor: 65000n }), payment());

    expect(impact.phase).toBe('crossing');
    expect(impact.after.amountMinor).toBe(-7930n);
    expect(impact.state).toBe('over');
    expect(impact.fraction).toBe(0);
  });

  it('is already over before the payment', () => {
    const impact = impactOf(choice({ spentMinor: 75000n }), payment());

    expect(impact.phase).toBe('alreadyOver');
    expect(impact.before.amountMinor).toBe(-5000n);
    expect(impact.after.amountMinor).toBe(-17930n);
  });

  it('is empty when the payment takes exactly what is left', () => {
    const impact = impactOf(choice({ spentMinor: 57070n }), payment());

    expect(impact.after.amountMinor).toBe(0n);
    expect(impact.state).toBe('empty');
  });

  it('shows no number for a payment in another currency than the plan', () => {
    expect(impactOf(choice(), payment({ currency: 'EUR' })).kind).toBe('foreign');
  });

  it('shows no rod for income or for an item without a planned amount', () => {
    expect(impactOf(choice({ direction: 'income' }), payment({ amountMinor: 5000n })).kind).toBe(
      'income',
    );
    expect(impactOf(choice({ plannedMinor: 0n }), payment()).kind).toBe('noPlan');
  });
});

describe('choicesFor', () => {
  const choices = [
    choice({ plannedItemId: 'a', name: 'A' }),
    choice({ plannedItemId: 'b', name: 'B' }),
    choice({ plannedItemId: 'salary', name: 'Salary', direction: 'income' }),
  ];

  it('puts the suggested choice first and keeps the plan order of the rest', () => {
    const ids = choicesFor(choices, payment({ suggestedPlannedItemId: 'b' })).map(
      (c) => c.plannedItemId,
    );

    expect(ids).toEqual(['b', 'a']);
  });

  it('offers income items to money coming in and expense items to money going out', () => {
    expect(choicesFor(choices, payment({ amountMinor: 100n })).map((c) => c.name)).toEqual([
      'Salary',
    ]);
    expect(choicesFor(choices, payment()).map((c) => c.name)).toEqual(['A', 'B']);
  });
});

describe('withSorted', () => {
  it('counts payments confirmed earlier, but not the one being previewed', () => {
    const earlier = payment({ id: 'bolt', amountMinor: -1000n });
    const sorted = new Map([
      ['bolt', earlier],
      ['orlen', payment()],
    ]);
    const picks = new Map([
      ['bolt', 'transport'],
      ['orlen', 'transport'],
    ]);

    const [result] = withSorted([choice()], sorted, picks, 'orlen');

    expect(result?.spentMinor).toBe(32239n);
  });

  it('ignores payments of another currency and other categories', () => {
    const sorted = new Map([
      ['eur', payment({ id: 'eur', currency: 'EUR', amountMinor: -1000n })],
      ['other', payment({ id: 'other', amountMinor: -1000n })],
    ]);
    const picks = new Map([
      ['eur', 'transport'],
      ['other', 'groceries'],
    ]);

    const [result] = withSorted([choice()], sorted, picks, 'x');

    expect(result?.spentMinor).toBe(31239n);
  });
});
