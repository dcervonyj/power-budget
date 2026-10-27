import React from 'react';
import { observer } from 'mobx-react-lite';
import type { HouseholdStore } from '../../../application/household/HouseholdStore.js';
import { HouseholdAggregatesCardView } from './HouseholdAggregatesCardView.js';

export interface HouseholdAggregatesCardProps {
  readonly store: HouseholdStore;
}

/** Both members' totals per category of a household plan, as privacy allows. */
export const HouseholdAggregatesCard = observer(function HouseholdAggregatesCard({
  store,
}: HouseholdAggregatesCardProps): React.JSX.Element {
  function selectPlan(planId: string): void {
    void store.selectPlan(planId);
  }

  return (
    <HouseholdAggregatesCardView
      plans={store.householdPlans}
      selectedPlanId={store.selectedPlanId}
      categories={store.categories}
      loading={store.aggregatesLoading}
      error={store.aggregatesError}
      onSelectPlan={selectPlan}
    />
  );
});
