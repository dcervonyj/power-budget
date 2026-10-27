import type { MoneyAmount } from '../../domain/dashboard/PlanDashboard.js';

/** The category rod of a planned item as it would look once a transaction is mapped to it. */
export interface CategoryRodPreview {
  readonly state: 'under' | 'over' | 'empty';
  /** Money left of the plan, 0..1. */
  readonly fraction: number;
  readonly planned: MoneyAmount;
  /** Left when under, the excess when over. */
  readonly remaining: MoneyAmount;
}

const FRACTION_STEPS = 10_000n;

/**
 * Live preview of the rod after the pick. Only same-currency expenses are previewed: the web
 * has no rate here and shows nothing rather than a wrong number. `spentBefore` excludes the
 * transaction itself.
 */
export function previewCategoryRod(
  planned: MoneyAmount,
  spentBefore: MoneyAmount,
  transaction: MoneyAmount,
): CategoryRodPreview | null {
  const sameCurrency =
    planned.currency === spentBefore.currency && planned.currency === transaction.currency;
  if (!sameCurrency || transaction.amountMinor >= 0n || planned.amountMinor <= 0n) {
    return null;
  }
  const spend = -transaction.amountMinor;
  const left = planned.amountMinor - spentBefore.amountMinor - spend;
  const currency = planned.currency;
  if (left < 0n) {
    return { state: 'over', fraction: 0, planned, remaining: { amountMinor: -left, currency } };
  }
  const fraction = Number((left * FRACTION_STEPS) / planned.amountMinor) / Number(FRACTION_STEPS);

  return {
    state: left === 0n ? 'empty' : 'under',
    fraction,
    planned,
    remaining: { amountMinor: left, currency },
  };
}
