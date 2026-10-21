import { parseMinorUnits } from '@power-budget/core';
import type { components } from '@power-budget/shared-app/contract';
import type { PlanActualsView, PlannedItemActual } from '../../domain/dashboard/PlanActualsView.js';

export type PlanDashboardResponseDto = components['schemas']['PlanDashboardResponseDto'];
type PlannedItemActualsDto = components['schemas']['PlannedItemActualsDto'];
type MoneyDto = components['schemas']['MoneyDto'];

export interface PlanDashboardContext {
  /** From the plans list; the dashboard response has no name. */
  readonly planName: string;
  /** categoryId -> name, from GET /categories; empty when unavailable. */
  readonly categoryNames: ReadonlyMap<string, string>;
}

/**
 * `GET /plans/:id/dashboard` (string minor units, nested lines) to the view the
 * dashboard components render. Minor units become numbers here: exact for any
 * amount below 2^53 minor units, and formatted back through core formatMoney.
 */
export function toPlanActualsView(
  dto: PlanDashboardResponseDto,
  context: PlanDashboardContext,
): PlanActualsView {
  const toLine = (line: PlannedItemActualsDto): PlannedItemActual =>
    toPlannedItemActual(line, context.categoryNames);

  return {
    planId: dto.planId,
    planName: context.planName,
    periodStart: dto.period.start,
    periodEnd: dto.period.end,
    currency: dto.baseCurrency,
    items: [...dto.incomeLines.map(toLine), ...dto.expenseLines.map(toLine)],
    // The response has the unplanned total but not how many transactions it holds.
    unplannedCount: null,
    unplannedTotal: minor(dto.unplannedExpenses),
    totalIncomePlanned: minor(dto.totalPlannedIncome),
    totalIncomeActual: minor(dto.totalActualIncome),
    totalExpensePlanned: minor(dto.totalPlannedExpenses),
    totalExpenseActual: minor(dto.totalActualExpenses),
    leftover: minor(dto.net),
  };
}

function toPlannedItemActual(
  line: PlannedItemActualsDto,
  categoryNames: ReadonlyMap<string, string>,
): PlannedItemActual {
  return {
    id: line.plannedItemId,
    category: categoryNames.get(line.categoryId) ?? '',
    direction: line.direction,
    planned: minor(line.planned),
    actual: minor(line.actual),
    currency: line.planned.currency,
  };
}

function minor(money: MoneyDto): number {
  return Number(parseMinorUnits(money.amountMinor));
}
