import { householdCategoryStore, householdStore, settingsStore } from '../../../composition.js';
import React, { useEffect } from 'react';
import { FormattedMessage } from 'react-intl';
import { useSearchParams } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import { EmptyState } from '../../components/shared/EmptyState.js';
import { ErrorBanner } from '../../components/shared/ErrorBanner.js';
import { SkeletonList } from '../../components/shared/SkeletonList.js';
import { HouseholdCategoryDrillIn } from '../../components/household/HouseholdCategoryDrillIn.js';
import { HouseholdPage } from '../../components/household/HouseholdPage.js';
import { HouseholdMembersCard } from '../../components/household/HouseholdMembersCard.js';
import { HouseholdAggregatesCard } from '../../components/household/HouseholdAggregatesCard.js';

/**
 * `/household`: members and the partner invite, and the shared per-category totals of
 * a household plan. `?planId=&categoryId=` opens one category (full detail only).
 */
export const HouseholdScreen = observer(function HouseholdScreen(): React.JSX.Element {
  const [searchParams] = useSearchParams();
  const categoryId = searchParams.get('categoryId');
  const planId = searchParams.get('planId');
  // The household id comes from GET /users/me (UserProfileDto.householdId).
  const { householdId, userId, profileLoaded } = settingsStore;

  useEffect(() => {
    if (!settingsStore.profileLoaded) {
      void settingsStore.loadProfile();
    }
  }, []);

  useEffect(() => {
    if (profileLoaded && householdId !== null) {
      void householdStore.load(userId, householdId);
    }
  }, [profileLoaded, userId, householdId]);

  const drillIn = categoryId !== null && planId !== null && householdId !== null;

  function retry(): void {
    if (householdId !== null) {
      void householdStore.load(userId, householdId);
    }
  }

  return (
    <HouseholdPage backLink={drillIn}>
      {drillIn && (
        <HouseholdCategoryDrillIn
          store={householdCategoryStore}
          householdId={householdId}
          planId={planId}
          categoryId={categoryId}
        />
      )}

      {!drillIn && profileLoaded && householdId === null && (
        <EmptyState
          title={
            <FormattedMessage
              id="household.none"
              defaultMessage="You are not in a household yet."
            />
          }
        />
      )}

      {!drillIn && householdStore.loadFailed && (
        <ErrorBanner
          message={
            <FormattedMessage
              id="household.loadFailed"
              defaultMessage="The household could not be loaded."
            />
          }
          onRetry={retry}
        />
      )}

      {!drillIn && !householdStore.loaded && !householdStore.loadFailed && householdId !== null && (
        <SkeletonList rows={3} rowHeight={56} />
      )}

      {!drillIn && householdStore.loaded && (
        <>
          <HouseholdMembersCard store={householdStore} />
          <HouseholdAggregatesCard store={householdStore} />
        </>
      )}
    </HouseholdPage>
  );
});
