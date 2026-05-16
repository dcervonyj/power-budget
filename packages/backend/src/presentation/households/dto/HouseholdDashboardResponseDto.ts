import { ApiProperty } from '@nestjs/swagger';

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

  @ApiProperty({ type: Number, description: 'Total amount in minor currency units (e.g. cents)' })
  totalAmountMinor!: number;

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
