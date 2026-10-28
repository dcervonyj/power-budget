import { dailyAllowance, getMinorUnitExponent, parseMoney } from '@power-budget/core';
import type { MinorUnitAmount } from '@power-budget/core';
import { lightFraction } from '@power-budget/shared-app';
import type {
  AddImpact,
  CategoryLineKind,
  CategoryOption,
  PlanSnapshot,
} from './addExpenseModel.js';

/** The typed keypad value ("", "12", "12.5", "12.") in exact minor units; never goes through a float. */
export function typedAmountMinor(typed: string, currency: string): bigint {
  const digits = typed === '' || typed === '.' ? '0' : typed;

  return parseMoney(digits, currency);
}

/** The impact of spending `amountMinor` in `category`: safe to spend per day and the category's left. */
export function computeImpact(
  plan: PlanSnapshot,
  category: CategoryOption,
  amountMinor: bigint,
): AddImpact {
  const { currency } = plan;
  const leftBefore = plan.plannedMinor - plan.spentMinor;
  const leftAfter = leftBefore - amountMinor;
  const planned = money(plan.plannedMinor, currency);
  const categoryBefore = category.plannedMinor - category.spentMinor;
  const categoryAfter = categoryBefore - amountMinor;

  return {
    safeBefore: money(dailyAllowance(leftBefore, plan.daysLeft).amount, currency),
    safeAfter: money(dailyAllowance(leftAfter, plan.daysLeft).amount, currency),
    leftAfter: money(leftAfter, currency),
    fraction: lightFraction(money(leftAfter, currency), planned),
    overPlanMinor: leftAfter < 0n ? -leftAfter : 0n,
    category: categoryImpact(category, categoryBefore, categoryAfter, amountMinor, currency),
  };
}

/** Whole currency units of an amount, truncated: 46860 minor PLN is 468. */
export function wholeUnits(amount: MinorUnitAmount): bigint {
  return amount.amountMinor / 10n ** BigInt(getMinorUnitExponent(amount.currency));
}

function categoryImpact(
  category: CategoryOption,
  before: bigint,
  after: bigint,
  amountMinor: bigint,
  currency: string,
): AddImpact['category'] {
  const planned = money(category.plannedMinor, currency);
  const spentBefore = money(category.spentMinor, currency);

  if (category.plannedMinor <= 0n) {
    return {
      kind: 'unplanned',
      before: spentBefore,
      after: money(category.spentMinor + amountMinor, currency),
      fraction: 0,
      state: 'empty',
    };
  }

  return {
    kind: lineKind(before, after),
    before: money(before, currency),
    after: money(after, currency),
    fraction: lightFraction(money(after, currency), planned),
    state: after < 0n ? 'over' : after === 0n ? 'empty' : 'under',
  };
}

function lineKind(before: bigint, after: bigint): CategoryLineKind {
  if (before < 0n) {
    return 'alreadyOver';
  }

  return after < 0n ? 'crossing' : 'under';
}

function money(amountMinor: bigint, currency: string): MinorUnitAmount {
  return { amountMinor, currency };
}
