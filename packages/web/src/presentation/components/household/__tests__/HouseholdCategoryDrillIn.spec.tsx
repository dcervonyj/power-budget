import React from 'react';
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import type { HouseholdDashboardCategoryDto } from '@power-budget/shared-app/contract';
import { HouseholdCategoryDrillInView } from '../HouseholdCategoryDrillInView.js';
import { renderWithProviders } from '../../../../test/renderWithProviders.js';

function category(
  privacyLevel: HouseholdDashboardCategoryDto['privacyLevel'],
): HouseholdDashboardCategoryDto {
  return {
    categoryId: 'cat-1',
    categoryName: 'Groceries',
    privacyLevel,
    totalAmountMinor: '150000',
    currency: 'PLN',
    transactionCount: 9,
  };
}

describe('HouseholdCategoryDrillInView', () => {
  it('shows total and count for full_detail', () => {
    renderWithProviders(
      <HouseholdCategoryDrillInView
        loading={false}
        error={null}
        category={category('full_detail')}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Groceries' })).toBeInTheDocument();
    expect(screen.getAllByText('Full detail')).toHaveLength(2);
    expect(screen.getByText('9 transactions')).toBeInTheDocument();
    expect(screen.getByText('Total spend')).toBeInTheDocument();
  });

  it('shows total and count for total_with_counts', () => {
    renderWithProviders(
      <HouseholdCategoryDrillInView
        loading={false}
        error={null}
        category={category('total_with_counts')}
      />,
    );

    expect(screen.getByText('9 transactions')).toBeInTheDocument();
  });

  it('hides the count for total_only', () => {
    renderWithProviders(
      <HouseholdCategoryDrillInView
        loading={false}
        error={null}
        category={category('total_only')}
      />,
    );

    expect(screen.getByText('Total spend')).toBeInTheDocument();
    expect(screen.queryByText(/transaction/)).toBeNull();
  });

  it('shows an alert on error and nothing else', () => {
    renderWithProviders(
      <HouseholdCategoryDrillInView loading={false} error="not_found" category={null} />,
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('heading')).toBeNull();
  });
});
