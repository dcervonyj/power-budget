import { describe, expect, it } from 'vitest';
import { computeImpact, typedAmountMinor, wholeUnits } from '../addExpenseImpact.js';
import { FIXTURE_CATEGORIES, FIXTURE_PLAN } from '../addExpenseFixture.js';

const [groceries, eating, , , unplanned] = FIXTURE_CATEGORIES;

function pick<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error('fixture missing');
  }

  return value;
}

describe('typedAmountMinor', () => {
  it('reads the keypad string exactly', () => {
    expect(typedAmountMinor('84', 'PLN')).toBe(8400n);
    expect(typedAmountMinor('84.5', 'PLN')).toBe(8450n);
    expect(typedAmountMinor('84.', 'PLN')).toBe(8400n);
    expect(typedAmountMinor('0.07', 'PLN')).toBe(7n);
    expect(typedAmountMinor('', 'PLN')).toBe(0n);
    expect(typedAmountMinor('.', 'PLN')).toBe(0n);
  });
});

describe('computeImpact with the D7 fixture', () => {
  it('moves safe to spend from 477,00 to 468,60 for 84,00', () => {
    const impact = computeImpact(FIXTURE_PLAN, pick(groceries), 8400n);

    expect(impact.safeBefore).toEqual({ amountMinor: 47700n, currency: 'PLN' });
    expect(impact.safeAfter).toEqual({ amountMinor: 46860n, currency: 'PLN' });
    expect(wholeUnits(impact.safeAfter)).toBe(468n);
    expect(impact.overPlanMinor).toBe(0n);
  });

  it('draws the lens light from what the plan has left', () => {
    expect(computeImpact(FIXTURE_PLAN, pick(groceries), 0n).fraction).toBeCloseTo(4770 / 11800, 10);
    expect(computeImpact(FIXTURE_PLAN, pick(groceries), 8400n).fraction).toBeCloseTo(
      4686 / 11800,
      10,
    );
  });

  it('tracks the category before and after', () => {
    const { category } = computeImpact(FIXTURE_PLAN, pick(groceries), 8400n);

    expect(category.kind).toBe('under');
    expect(category.before.amountMinor).toBe(105136n);
    expect(category.after.amountMinor).toBe(96736n);
    expect(category.state).toBe('under');
  });

  it('flags a category already over its plan', () => {
    const { category } = computeImpact(FIXTURE_PLAN, pick(eating), 12000n);

    expect(category.kind).toBe('alreadyOver');
    expect(category.before.amountMinor).toBe(-6250n);
    expect(category.after.amountMinor).toBe(-18250n);
    expect(category.state).toBe('over');
  });

  it('flags a category the expense takes over its plan', () => {
    const { category } = computeImpact(FIXTURE_PLAN, pick(groceries), 110000n);

    expect(category.kind).toBe('crossing');
    expect(category.state).toBe('over');
  });

  it('treats the unplanned bucket as outside the plan, with no rod', () => {
    const { category } = computeImpact(FIXTURE_PLAN, pick(unplanned), 4999n);

    expect(category.kind).toBe('unplanned');
    expect(category.before.amountMinor).toBe(42500n);
    expect(category.after.amountMinor).toBe(47499n);
  });

  it('reports 0 a day and the overshoot when the amount passes what is left', () => {
    const impact = computeImpact(FIXTURE_PLAN, pick(groceries), 500000n);

    expect(impact.safeAfter.amountMinor).toBe(0n);
    expect(impact.overPlanMinor).toBe(23000n);
    expect(impact.fraction).toBe(0);
  });
});
