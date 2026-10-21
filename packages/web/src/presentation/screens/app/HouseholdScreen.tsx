import React, { useEffect } from 'react';
import { FormattedMessage } from 'react-intl';
import { Link, useSearchParams } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import { useTheme } from '../../components/ThemeContext.js';
import { ErrorBanner } from '../../components/shared/ErrorBanner.js';
import { SkeletonList } from '../../components/shared/SkeletonList.js';
import { HouseholdCategoryDrillIn } from '../../components/household/HouseholdCategoryDrillIn.js';
import { HouseholdMembersCard } from '../../components/household/HouseholdMembersCard.js';
import { HouseholdAggregatesCard } from '../../components/household/HouseholdAggregatesCard.js';
import { householdCategoryStore } from '../../../application/household/HouseholdCategoryStore.js';
import { householdStore } from '../../../application/household/HouseholdStore.js';
import { settingsStore } from '../../../application/settings/SettingsStore.js';

/**
 * `/household`: members and the partner invite, and the shared per-category totals of
 * a household plan. `?planId=&categoryId=` opens one category (full detail only).
 */
export const HouseholdScreen = observer(function HouseholdScreen(): React.JSX.Element {
  const theme = useTheme();
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
    if (profileLoaded && householdId !== '') {
      void householdStore.load(userId, householdId);
    }
  }, [profileLoaded, userId, householdId]);

  const drillIn = categoryId !== null && planId !== null && householdId !== '';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: theme.space.lg,
        padding: theme.space.lg,
        maxWidth: 880,
        margin: '0 auto',
      }}
    >
      <h1
        style={{
          margin: 0,
          fontSize: theme.fontSize.xl,
          fontWeight: theme.fontWeight.semibold,
          color: theme.color.text.primary,
        }}
      >
        <FormattedMessage id="screen.household.title" defaultMessage="Household" />
      </h1>

      {drillIn && (
        <>
          <Link
            to="/household"
            style={{ fontSize: theme.fontSize.sm, color: theme.color.accent.default }}
          >
            <FormattedMessage id="household.backToOverview" defaultMessage="Back to household" />
          </Link>
          <HouseholdCategoryDrillIn
            store={householdCategoryStore}
            householdId={householdId}
            planId={planId}
            categoryId={categoryId}
          />
        </>
      )}

      {!drillIn && profileLoaded && householdId === '' && (
        <span style={{ fontSize: theme.fontSize.md, color: theme.color.text.secondary }}>
          <FormattedMessage id="household.none" defaultMessage="You are not in a household yet." />
        </span>
      )}

      {!drillIn && householdStore.loadFailed && (
        <ErrorBanner
          message={
            <FormattedMessage
              id="household.loadFailed"
              defaultMessage="The household could not be loaded."
            />
          }
          onRetry={() => {
            void householdStore.load(userId, householdId);
          }}
        />
      )}

      {!drillIn && !householdStore.loaded && !householdStore.loadFailed && householdId !== '' && (
        <SkeletonList rows={3} rowHeight={56} />
      )}

      {!drillIn && householdStore.loaded && (
        <>
          <HouseholdMembersCard store={householdStore} />
          <HouseholdAggregatesCard store={householdStore} />
        </>
      )}
    </div>
  );
});
