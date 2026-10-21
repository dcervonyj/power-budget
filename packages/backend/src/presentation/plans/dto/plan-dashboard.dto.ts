import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import type { PlanActualsView, PlannedItemActuals } from '@power-budget/core';
import type {
  UnplannedTransactionItem,
  UnplannedTransactionPage,
} from '../../../domain/plans/ports.js';
import { MoneyDto, minorUnitsToString, toMoneyDto } from '../../http/money.js';
import { ClampMax } from '../../http/validators.js';

export const UNPLANNED_PAGE_MAX = 200;

export class UnplannedQueryDto {
  @ApiProperty({ enum: ['income', 'expense'], description: 'Filter by transaction direction' })
  @IsIn(['income', 'expense'])
  direction!: 'income' | 'expense';

  @ApiPropertyOptional({
    type: String,
    description: 'Pagination cursor (opaque, from previous response)',
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({
    type: Number,
    description: `Page size (default 50, values above ${UNPLANNED_PAGE_MAX} are clamped)`,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @ClampMax(UNPLANNED_PAGE_MAX)
  limit?: number;
}

export class DateRangeDto {
  @ApiProperty({ type: String, example: '2024-06-01' })
  start!: string;

  @ApiProperty({ type: String, example: '2024-06-30' })
  end!: string;
}

export class PlannedItemActualsDto {
  @ApiProperty({ type: String })
  plannedItemId!: string;

  @ApiProperty({ type: String })
  categoryId!: string;

  @ApiProperty({ enum: ['income', 'expense'] })
  direction!: string;

  @ApiProperty({ type: MoneyDto })
  planned!: MoneyDto;

  @ApiProperty({ type: MoneyDto })
  actual!: MoneyDto;

  @ApiProperty({ type: MoneyDto })
  remaining!: MoneyDto;

  @ApiProperty({ enum: ['ok', 'warning', 'over'] })
  progressBand!: string;
}

export class PlanDashboardResponseDto {
  @ApiProperty({ type: String })
  planId!: string;

  @ApiProperty({ type: DateRangeDto })
  period!: DateRangeDto;

  @ApiProperty({ type: String, example: 'PLN' })
  baseCurrency!: string;

  @ApiProperty({ type: [PlannedItemActualsDto] })
  incomeLines!: PlannedItemActualsDto[];

  @ApiProperty({ type: [PlannedItemActualsDto] })
  expenseLines!: PlannedItemActualsDto[];

  @ApiProperty({ type: MoneyDto })
  totalPlannedIncome!: MoneyDto;

  @ApiProperty({ type: MoneyDto })
  totalActualIncome!: MoneyDto;

  @ApiProperty({ type: MoneyDto })
  totalPlannedExpenses!: MoneyDto;

  @ApiProperty({ type: MoneyDto })
  totalActualExpenses!: MoneyDto;

  @ApiProperty({ type: MoneyDto })
  unplannedExpenses!: MoneyDto;

  @ApiProperty({ type: MoneyDto })
  unplannedIncome!: MoneyDto;

  @ApiProperty({ type: MoneyDto })
  net!: MoneyDto;

  @ApiProperty({ type: String, example: '2024-06-15' })
  asOf!: string;
}

export class UnplannedTransactionDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  description!: string;

  @ApiProperty({ type: String, description: 'Minor units as an integer string', example: '1500' })
  amountMinor!: string;

  @ApiProperty({ type: String, example: 'PLN' })
  currency!: string;

  @ApiProperty({ type: String, example: '2024-06-15' })
  occurredOn!: string;

  @ApiProperty({ type: String })
  accountId!: string;

  @ApiProperty({ type: String })
  source!: string;
}

export class UnplannedTransactionPageDto {
  @ApiProperty({ type: [UnplannedTransactionDto] })
  items!: UnplannedTransactionDto[];

  @ApiProperty({ type: String, nullable: true })
  nextCursor!: string | null;
}

export function toPlanDashboardDto(view: PlanActualsView): PlanDashboardResponseDto {
  return {
    planId: view.planId,
    period: { start: view.period.start, end: view.period.end },
    baseCurrency: view.baseCurrency,
    incomeLines: view.incomeLines.map(toPlannedItemActualsDto),
    expenseLines: view.expenseLines.map(toPlannedItemActualsDto),
    totalPlannedIncome: toMoneyDto(view.totalPlannedIncome),
    totalActualIncome: toMoneyDto(view.totalActualIncome),
    totalPlannedExpenses: toMoneyDto(view.totalPlannedExpenses),
    totalActualExpenses: toMoneyDto(view.totalActualExpenses),
    unplannedExpenses: toMoneyDto(view.unplannedExpenses),
    unplannedIncome: toMoneyDto(view.unplannedIncome),
    net: toMoneyDto(view.net),
    asOf: view.asOf,
  };
}

export function toUnplannedTransactionPageDto(
  page: UnplannedTransactionPage,
): UnplannedTransactionPageDto {
  return { items: page.items.map(toUnplannedTransactionDto), nextCursor: page.nextCursor };
}

function toPlannedItemActualsDto(line: PlannedItemActuals): PlannedItemActualsDto {
  return {
    plannedItemId: line.plannedItemId,
    categoryId: line.categoryId,
    direction: line.direction,
    planned: toMoneyDto(line.planned),
    actual: toMoneyDto(line.actual),
    remaining: toMoneyDto(line.remaining),
    progressBand: line.progressBand,
  };
}

function toUnplannedTransactionDto(item: UnplannedTransactionItem): UnplannedTransactionDto {
  return {
    id: item.id,
    description: item.description,
    amountMinor: minorUnitsToString(item.amountMinor),
    currency: item.currency,
    occurredOn: item.occurredOn,
    accountId: item.accountId,
    source: item.source,
  };
}
