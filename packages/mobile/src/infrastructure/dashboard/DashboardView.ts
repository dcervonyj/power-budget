import { NO_LABEL } from '../../domain/display.js';
import { parseMinorUnits } from '@power-budget/core';
import type {
  MoneyDto,
  PlanDashboardResponseDto,
  PlannedItemActualsDto,
} from '@power-budget/shared-app/contract';

export interface DashboardRowView {
  readonly plannedItemId: string;
  readonly name: string;
  readonly direction: 'income' | 'expense';
  readonly planned: MoneyDto;
  readonly actual: MoneyDto;
  readonly band: PlannedItemActualsDto['progressBand'];
  /** actual / planned for the progress bar, 0 when nothing is planned. */
  readonly ratio: number;
}

/** The plan dashboard as the mobile screen shows it, built from `GET /plans/:id/dashboard`. */
export interface DashboardView {
  readonly planId: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly baseCurrency: string;
  readonly incomeRows: readonly DashboardRowView[];
  readonly expenseRows: readonly DashboardRowView[];
  readonly unplannedExpenses: MoneyDto;
  readonly net: MoneyDto;
}

const RATIO_SCALE = 1000n;

export const DashboardView = {
  /** `categoryNames` (categoryId to name) labels the rows; a missing name gives an empty label. */
  fromDto(
    dto: PlanDashboardResponseDto,
    categoryNames: ReadonlyMap<string, string>,
  ): DashboardView {
    return {
      planId: dto.planId,
      periodStart: dto.period.start,
      periodEnd: dto.period.end,
      baseCurrency: dto.baseCurrency,
      incomeRows: dto.incomeLines.map((line) => toRow(line, categoryNames)),
      expenseRows: dto.expenseLines.map((line) => toRow(line, categoryNames)),
      unplannedExpenses: dto.unplannedExpenses,
      net: dto.net,
    };
  },
};

function toRow(
  line: PlannedItemActualsDto,
  categoryNames: ReadonlyMap<string, string>,
): DashboardRowView {
  return {
    plannedItemId: line.plannedItemId,
    name: categoryNames.get(line.categoryId) ?? NO_LABEL,
    direction: line.direction,
    planned: line.planned,
    actual: line.actual,
    band: line.progressBand,
    ratio: toRatio(
      parseMinorUnits(line.actual.amountMinor),
      parseMinorUnits(line.planned.amountMinor),
    ),
  };
}

function toRatio(actual: bigint, planned: bigint): number {
  if (planned <= 0n) {
    return 0;
  }

  return Number((actual * RATIO_SCALE) / planned) / Number(RATIO_SCALE);
}
