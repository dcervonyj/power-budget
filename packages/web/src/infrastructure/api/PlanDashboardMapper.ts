import { parseMinorUnits, progressBand } from '@power-budget/core';
import type {
  MoneyDto,
  PlanDashboardResponseDto,
  PlanDto,
  PlannedItemActualsDto,
  PlannedItemDto,
  UnplannedTransactionDto,
} from '@power-budget/shared-app/contract';
import type {
  DashboardCategoryGroup,
  DashboardLine,
  MoneyAmount,
  PlanDashboard,
  UnplannedTransaction,
} from '../../domain/dashboard/PlanDashboard.js';

export type { PlanDashboardResponseDto };

export interface PlanDashboardContext {
  /** The dashboard response has no name or type. */
  readonly plan: PlanDto;
  /** categoryId -> name, from GET /categories; empty when unavailable. */
  readonly categoryNames: ReadonlyMap<string, string>;
  /** The plan's items, for the amount in the item's own currency; empty when unavailable. */
  readonly items: readonly PlannedItemDto[];
}

/**
 * `GET /plans/:id/dashboard` (string minor units, one line per item) to the dashboard
 * view: lines grouped by category in the API's order, amounts as exact bigints.
 */
export function toPlanDashboard(
  dto: PlanDashboardResponseDto,
  context: PlanDashboardContext,
): PlanDashboard {
  const itemsById = new Map(context.items.map((item) => [item.id, item]));

  return {
    planId: dto.planId,
    planName: context.plan.name,
    planType: context.plan.type,
    periodStart: dto.period.start,
    periodEnd: dto.period.end,
    baseCurrency: dto.baseCurrency,
    asOf: dto.asOf,
    income: groupByCategory(dto.incomeLines, dto.baseCurrency, itemsById, context.categoryNames),
    expense: groupByCategory(dto.expenseLines, dto.baseCurrency, itemsById, context.categoryNames),
    totals: {
      plannedIncome: toMoney(dto.totalPlannedIncome),
      actualIncome: toMoney(dto.totalActualIncome),
      plannedExpenses: toMoney(dto.totalPlannedExpenses),
      actualExpenses: toMoney(dto.totalActualExpenses),
      unplannedIncome: toMoney(dto.unplannedIncome),
      unplannedExpenses: toMoney(dto.unplannedExpenses),
      net: toMoney(dto.net),
    },
  };
}

export function toUnplannedTransaction(dto: UnplannedTransactionDto): UnplannedTransaction {
  return {
    id: dto.id,
    description: dto.description,
    amount: { amountMinor: parseMinorUnits(dto.amountMinor), currency: dto.currency },
    occurredOn: dto.occurredOn,
  };
}

function groupByCategory(
  lines: readonly PlannedItemActualsDto[],
  baseCurrency: string,
  itemsById: ReadonlyMap<string, PlannedItemDto>,
  categoryNames: ReadonlyMap<string, string>,
): DashboardCategoryGroup[] {
  const byCategory = new Map<string, DashboardLine[]>();
  for (const line of lines) {
    const group = byCategory.get(line.categoryId) ?? [];
    group.push(toLine(line, baseCurrency, itemsById.get(line.plannedItemId)));
    byCategory.set(line.categoryId, group);
  }

  return [...byCategory.entries()].map(([categoryId, groupLines]) =>
    toGroup(categoryId, groupLines, baseCurrency, categoryNames.get(categoryId) ?? ''),
  );
}

function toGroup(
  categoryId: string,
  lines: readonly DashboardLine[],
  baseCurrency: string,
  categoryName: string,
): DashboardCategoryGroup {
  const planned = sum(lines, 'planned');
  const actual = sum(lines, 'actual');
  const first = lines[0];

  return {
    categoryId,
    categoryName,
    direction: first === undefined ? 'expense' : first.direction,
    planned: { amountMinor: planned, currency: baseCurrency },
    actual: { amountMinor: actual, currency: baseCurrency },
    remaining: { amountMinor: planned - actual, currency: baseCurrency },
    band: progressBand(planned, actual),
    lines,
  };
}

function toLine(
  line: PlannedItemActualsDto,
  baseCurrency: string,
  item: PlannedItemDto | undefined,
): DashboardLine {
  return {
    plannedItemId: line.plannedItemId,
    direction: line.direction,
    planned: toMoney(line.planned),
    actual: toMoney(line.actual),
    remaining: toMoney(line.remaining),
    band: line.progressBand,
    original:
      item === undefined || item.amount.currency === baseCurrency ? null : toMoney(item.amount),
    note: item?.note ?? '',
  };
}

function sum(lines: readonly DashboardLine[], pick: 'planned' | 'actual'): bigint {
  return lines.reduce((total, line) => total + line[pick].amountMinor, 0n);
}

function toMoney(money: MoneyDto): MoneyAmount {
  return { amountMinor: parseMinorUnits(money.amountMinor), currency: money.currency };
}
