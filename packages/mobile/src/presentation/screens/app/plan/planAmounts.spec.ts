import { describe, expect, it } from 'vitest';
import type { PlannedItemDto } from '@power-budget/shared-app/contract';
import {
  computePlanTotals,
  stepMinorUnits,
  toAmountInput,
  toMinorUnitsString,
  toSteppableMinor,
} from './planAmounts.js';

function item(
  id: string,
  direction: PlannedItemDto['direction'],
  amountMinor: string,
  currency = 'PLN',
): PlannedItemDto {
  return {
    id,
    planId: 'plan-1',
    categoryId: 'cat',
    direction,
    amount: { amountMinor, currency },
    note: null,
    matchHint: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  };
}

describe('toMinorUnitsString', () => {
  it('parses exact major units without float rounding', () => {
    expect(toMinorUnitsString('0.30', 'PLN')).toBe('30');
    expect(toMinorUnitsString('1234.56', 'PLN')).toBe('123456');
    expect(toMinorUnitsString('1 234,56', 'PLN')).toBe('123456');
  });

  it('keeps amounts beyond the float safe range exact', () => {
    expect(toMinorUnitsString('90071992547409.93', 'PLN')).toBe('9007199254740993');
  });

  it('returns null for text that is not an amount or a currency we do not know', () => {
    expect(toMinorUnitsString('abc', 'PLN')).toBeNull();
    expect(toMinorUnitsString('', 'PLN')).toBeNull();
    expect(toMinorUnitsString('1.00', 'XXX')).toBeNull();
    expect(toMinorUnitsString('1.00', '')).toBeNull();
  });
});

describe('toAmountInput', () => {
  it('formats minor units as major-unit input text', () => {
    expect(toAmountInput('300000', 'PLN')).toBe('3000.00');
  });

  it('is empty when the amount is unreadable', () => {
    expect(toAmountInput('abc', 'PLN')).toBe('');
    expect(toAmountInput('100', 'XXX')).toBe('');
  });
});

describe('stepper helpers', () => {
  it('steps 10 major units', () => {
    expect(stepMinorUnits('PLN')).toBe(1000);
    expect(stepMinorUnits('XXX')).toBeNull();
  });

  it('only steps safe integers', () => {
    expect(toSteppableMinor('1000')).toBe(1000);
    expect(toSteppableMinor('9007199254740993')).toBeNull();
  });
});

describe('computePlanTotals', () => {
  it('sums income and expenses in the base currency and excludes the rest', () => {
    const totals = computePlanTotals(
      [
        item('a', 'income', '1000'),
        item('b', 'expense', '400'),
        item('c', 'expense', '999', 'EUR'),
      ],
      'PLN',
    );

    expect(totals).toEqual({
      currency: 'PLN',
      incomeMinor: 1000n,
      expensesMinor: 400n,
      leftMinor: 600n,
      excludedCount: 1,
    });
  });
});
