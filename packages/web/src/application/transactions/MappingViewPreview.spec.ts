import { describe, expect, it } from 'vitest';
import { previewCategoryRod } from './MappingViewPreview.js';

const money = (amountMinor: bigint, currency = 'PLN') => ({ amountMinor, currency });

describe('previewCategoryRod', () => {
  it('shows what is left after the expense', () => {
    const preview = previewCategoryRod(money(220000n), money(114864n), money(-1890n));

    expect(preview).toEqual({
      state: 'under',
      fraction: 0.4693,
      planned: money(220000n),
      remaining: money(103246n),
    });
  });

  it('turns over when the expense passes the plan and reports the excess', () => {
    const preview = previewCategoryRod(money(50000n), money(56250n), money(-1000n));

    expect(preview?.state).toBe('over');
    expect(preview?.remaining).toEqual(money(7250n));
  });

  it('is empty when exactly nothing is left', () => {
    expect(previewCategoryRod(money(1000n), money(400n), money(-600n))?.state).toBe('empty');
  });

  it('shows nothing for income, other currencies or an empty plan', () => {
    expect(previewCategoryRod(money(1000n), money(0n), money(500n))).toBeNull();
    expect(previewCategoryRod(money(1000n), money(0n), money(-500n, 'EUR'))).toBeNull();
    expect(previewCategoryRod(money(0n), money(0n), money(-500n))).toBeNull();
  });
});
