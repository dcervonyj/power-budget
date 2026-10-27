import React, { useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import type { HouseholdCategoryStore } from '../../../application/household/HouseholdCategoryStore.js';
import { HouseholdCategoryDrillInView } from './HouseholdCategoryDrillInView.js';

export interface HouseholdCategoryDrillInProps {
  store: HouseholdCategoryStore;
  householdId: string;
  planId: string;
  categoryId: string;
}

export const HouseholdCategoryDrillIn = observer(function HouseholdCategoryDrillIn({
  store,
  householdId,
  planId,
  categoryId,
}: HouseholdCategoryDrillInProps): React.JSX.Element {
  useEffect(() => {
    void store.fetchCategory(householdId, planId, categoryId);
  }, [store, householdId, planId, categoryId]);

  return (
    <HouseholdCategoryDrillInView
      loading={store.loading}
      error={store.error}
      category={store.category}
    />
  );
});
