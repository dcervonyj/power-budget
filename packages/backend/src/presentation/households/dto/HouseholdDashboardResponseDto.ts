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
    description: 'Privacy level applied for the viewing user',
  })
  privacyLevel!: 'full_detail' | 'total_with_counts' | 'total_only';

  @ApiProperty({
    type: String,
    description: 'Total amount in minor currency units (e.g. cents) as an integer string',
    example: '150000',
  })
  totalAmountMinor!: string;

  @ApiProperty({ type: String, description: 'ISO 4217 currency code', example: 'PLN' })
  currency!: string;

  @ApiProperty({ type: Number, description: 'Number of transactions (0 for total_only privacy)' })
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
