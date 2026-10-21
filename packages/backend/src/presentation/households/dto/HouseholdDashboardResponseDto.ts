import { ApiProperty } from '@nestjs/swagger';
import type { CategoryAggregate } from '@power-budget/core';
import { minorUnitsToString } from '../../http/money.js';

export class HouseholdDashboardCategoryDto {
  @ApiProperty({ type: String, description: 'Category ID' })
  categoryId!: string;

  @ApiProperty({ type: String, description: 'Category name' })
  categoryName!: string;

  @ApiProperty({
    enum: ['full_detail', 'total_with_counts', 'total_only'],
    description:
      "Level applied to the partner's transactions in this category (total_only when not configured); the viewer's own are always counted",
  })
  privacyLevel!: 'full_detail' | 'total_with_counts' | 'total_only';

  @ApiProperty({
    type: String,
    description:
      "Both members' total in the plan's base currency, minor units as an integer string. Expense categories: spend net of refunds; income categories: received",
    example: '150000',
  })
  totalAmountMinor!: string;

  @ApiProperty({ type: String, description: "The plan's base currency (ISO 4217)", example: 'PLN' })
  currency!: string;

  @ApiProperty({
    type: Number,
    description:
      "The viewer's own transactions, plus the partner's unless privacyLevel is total_only",
  })
  transactionCount!: number;
}

export class HouseholdDashboardResponseDto {
  @ApiProperty({ type: String, description: 'Plan ID this dashboard is computed for' })
  planId!: string;

  @ApiProperty({ type: [HouseholdDashboardCategoryDto], description: 'Per-category aggregates' })
  categories!: HouseholdDashboardCategoryDto[];
}

export function toHouseholdDashboardCategoryDto(
  aggregate: CategoryAggregate,
): HouseholdDashboardCategoryDto {
  return {
    categoryId: aggregate.categoryId,
    categoryName: aggregate.category.name,
    privacyLevel: aggregate.privacyLevel,
    totalAmountMinor: minorUnitsToString(aggregate.totalAmount.amountMinor),
    currency: aggregate.totalAmount.currency,
    transactionCount: aggregate.transactionCount,
  };
}
