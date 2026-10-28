import { parseMinorUnits } from '@power-budget/core';
import type { MinorUnitAmount } from '@power-budget/core';
import { lightFraction } from '@power-budget/shared-app';
import type { PlanDashboardResponseDto } from '@power-budget/shared-app/contract';

export type Direction = 'income' | 'expense';

/** One planned item of the current plan a payment can be sorted into. */
export interface CategoryChoice {
  readonly plannedItemId: string;
  readonly name: string;
  readonly direction: Direction;
  readonly plannedMinor: bigint;
  /** What is already spent (or received) in it, from the plan dashboard. */
  readonly spentMinor: bigint;
  readonly currency: string;
}

/** The payment the sheet sorts. `amountMinor` is signed: negative is money out. */
export interface Payment {
  readonly id: string;
  readonly amountMinor: bigint;
  readonly currency: string;
  readonly suggestedPlannedItemId: string | null;
}

/**
 * `drain`: an expense in the plan's currency, so the rod can show what is left after it.
 * `income`: the payment adds to an income line, no rod. `foreign`: another currency than the plan's,
 * so no number is guessed. `noPlan`: the item has no planned amount.
 */
export type ImpactKind = 'drain' | 'income' | 'foreign' | 'noPlan';
export type ImpactPhase = 'under' | 'crossing' | 'alreadyOver';

export interface Impact {
  readonly kind: ImpactKind;
  readonly phase: ImpactPhase;
  readonly planned: MinorUnitAmount;
  readonly before: MinorUnitAmount;
  readonly after: MinorUnitAmount;
  /** Light left after the payment, 0..1. */
  readonly fraction: number;
  readonly state: 'under' | 'over' | 'empty';
}

export function choicesOf(
  dashboard: PlanDashboardResponseDto,
  categoryNames: ReadonlyMap<string, string>,
): CategoryChoice[] {
  const lines = [
    ...dashboard.expenseLines.map((line) => ({ line, direction: 'expense' as const })),
    ...dashboard.incomeLines.map((line) => ({ line, direction: 'income' as const })),
  ];

  return lines.map(({ line, direction }) => ({
    plannedItemId: line.plannedItemId,
    name: categoryNames.get(line.categoryId) ?? '',
    direction,
    plannedMinor: parseMinorUnits(line.planned.amountMinor),
    spentMinor: parseMinorUnits(line.actual.amountMinor),
    currency: dashboard.baseCurrency,
  }));
}

/** The choices that fit the payment's direction, the suggested one first, the rest in plan order. */
export function choicesFor(choices: readonly CategoryChoice[], payment: Payment): CategoryChoice[] {
  const direction: Direction = payment.amountMinor < 0n ? 'expense' : 'income';
  const fitting = choices.filter((choice) => choice.direction === direction);
  const suggested = fitting.filter((c) => c.plannedItemId === payment.suggestedPlannedItemId);
  const others = fitting.filter((c) => c.plannedItemId !== payment.suggestedPlannedItemId);

  return [...suggested, ...others];
}

/**
 * Payments already confirmed in this session count in the choices they went to, so the preview of
 * the next payment starts from what is left after them (the dashboard was loaded before).
 */
export function withSorted(
  choices: readonly CategoryChoice[],
  sorted: ReadonlyMap<string, Payment>,
  picks: ReadonlyMap<string, string>,
  skipId: string,
): CategoryChoice[] {
  return choices.map((choice) => {
    let spentMinor = choice.spentMinor;
    for (const [id, payment] of sorted) {
      if (id !== skipId && picks.get(id) === choice.plannedItemId && countsIn(choice, payment)) {
        spentMinor += payment.amountMinor < 0n ? -payment.amountMinor : payment.amountMinor;
      }
    }

    return { ...choice, spentMinor };
  });
}

/** What the payment does to the chosen item: its light left before and after. */
export function impactOf(choice: CategoryChoice, payment: Payment): Impact {
  const planned = money(choice.plannedMinor, choice.currency);
  const before = money(choice.plannedMinor - choice.spentMinor, choice.currency);
  const none = { planned, before, after: before, fraction: 0, state: 'empty' as const };
  if (choice.direction === 'income') {
    return { ...none, kind: 'income', phase: 'under' };
  }
  if (payment.currency !== choice.currency) {
    return { ...none, kind: 'foreign', phase: 'under' };
  }
  if (choice.plannedMinor <= 0n) {
    return { ...none, kind: 'noPlan', phase: 'under' };
  }
  const spent = payment.amountMinor < 0n ? -payment.amountMinor : payment.amountMinor;
  const after = money(before.amountMinor - spent, choice.currency);

  return {
    kind: 'drain',
    phase: phaseOf(before.amountMinor, after.amountMinor),
    planned,
    before,
    after,
    fraction: lightFraction(after, planned),
    state: stateOf(after.amountMinor),
  };
}

function phaseOf(before: bigint, after: bigint): ImpactPhase {
  if (before < 0n) {
    return 'alreadyOver';
  }

  return after < 0n ? 'crossing' : 'under';
}

function stateOf(after: bigint): Impact['state'] {
  if (after < 0n) {
    return 'over';
  }

  return after === 0n ? 'empty' : 'under';
}

function countsIn(choice: CategoryChoice, payment: Payment): boolean {
  const direction: Direction = payment.amountMinor < 0n ? 'expense' : 'income';

  return direction === choice.direction && payment.currency === choice.currency;
}

function money(amountMinor: bigint, currency: string): MinorUnitAmount {
  return { amountMinor, currency };
}
