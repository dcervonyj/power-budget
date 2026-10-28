import { describe, expect, it } from 'vitest';
import { UnknownCategoryError } from '../../../../domain/categoryName.js';
import { balancesFor, choicesFor, choicesOf, impactOf } from './categorizeModel.js';
import type { CategoryChoice, Ledger, LedgerEntry, Payment } from './categorizeModel.js';

function choice(overrides: Partial<CategoryChoice> = {}): CategoryChoice {
  return {
    plannedItemId: 'transport',
    name: 'Transport',
    planName: 'October',
    direction: 'expense',
    plannedMinor: 70000n,
    spentMinor: 31239n,
    currency: 'PLN',
    periodStart: '2026-10-01',
    periodEnd: '2026-10-31',
    ...overrides,
  };
}

function payment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: 'orlen',
    amountMinor: -12930n,
    currency: 'PLN',
    day: '2026-10-19',
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

  it('shows no number for a payment dated outside the plan period', () => {
    expect(impactOf(choice(), payment({ day: '2026-09-30' })).kind).toBe('outside');
    expect(impactOf(choice(), payment({ day: '2026-11-01' })).kind).toBe('outside');
    expect(impactOf(choice(), payment({ day: '2026-10-31' })).kind).toBe('drain');
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

describe('choicesFor', () => {
  it('puts the plans that cover the payment day before the others', () => {
    const later = choice({
      plannedItemId: 'later',
      periodStart: '2026-11-01',
      periodEnd: '2026-11-30',
    });
    const now = choice({ plannedItemId: 'now' });

    const result = choicesFor([later, now], payment());

    expect(result.map((c) => c.plannedItemId)).toEqual(['now', 'later']);
  });
});

describe('balancesFor', () => {
  const entry = (overrides: Partial<LedgerEntry> = {}): LedgerEntry => ({
    payment: payment({ id: 'bolt', amountMinor: -1000n }),
    plannedItemId: 'transport',
    covered: false,
    undone: false,
    ...overrides,
  });
  const spent = (ledger: Ledger, skipId = 'orlen'): bigint | undefined =>
    balancesFor([choice()], ledger, skipId)[0]?.spentMinor;

  it.each([
    ['nothing confirmed', new Map(), 31239n],
    ['a confirmed payment the balances lack (confirm)', new Map([['bolt', entry()]]), 32239n],
    [
      'the same payment after a refresh covered it',
      new Map([['bolt', entry({ covered: true })]]),
      31239n,
    ],
    ['an uncovered one that was undone before any refresh', new Map(), 31239n],
    [
      'a covered one that was undone, until the next refresh',
      new Map([['bolt#undone1', entry({ covered: true, undone: true })]]),
      30239n,
    ],
    [
      'a payment dated outside the plan period, like the dashboard',
      new Map([
        ['old', entry({ payment: payment({ id: 'old', amountMinor: -1000n, day: '2026-09-30' }) })],
      ]),
      31239n,
    ],
    [
      'a payment confirmed into another item',
      new Map([['bolt', entry({ plannedItemId: 'groceries' })]]),
      31239n,
    ],
  ])('%s', (_name, ledger, expected) => {
    expect(spent(ledger)).toBe(expected);
  });

  it.each([
    ['uncovered: not counted in its own preview', false, 31239n],
    ['covered by a refresh: taken out of the balances (Confirmed card)', true, 18309n],
  ])('the previewed payment itself, %s', (_name, covered, expected) => {
    const own = entry({ payment: payment(), covered });

    expect(spent(new Map([['orlen', own]]))).toBe(expected);
  });
});

describe('choicesOf', () => {
  it('rejects a planned line whose category the list lacks', () => {
    const line = {
      plannedItemId: 'i1',
      categoryId: 'c-gone',
      planned: { amountMinor: '100', currency: 'PLN' },
      actual: { amountMinor: '0', currency: 'PLN' },
    };
    const dashboard = {
      expenseLines: [line],
      incomeLines: [],
      baseCurrency: 'PLN',
      period: { start: '2026-10-01', end: '2026-10-31' },
    };

    expect(() => choicesOf(dashboard as never, 'October', new Map())).toThrow(UnknownCategoryError);
  });
});
