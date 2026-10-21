import React, { useEffect } from 'react';
import { FormattedMessage } from 'react-intl';
import { useSearchParams } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import { useTheme } from '../../components/ThemeContext.js';
import { HouseholdCategoryDrillIn } from '../../components/household/HouseholdCategoryDrillIn.js';
import { householdCategoryStore } from '../../../application/household/HouseholdCategoryStore.js';
import { settingsStore } from '../../../application/settings/SettingsStore.js';

export const HouseholdScreen = observer(function HouseholdScreen(): React.JSX.Element {
  const theme = useTheme();
  const [searchParams] = useSearchParams();
  const categoryId = searchParams.get('categoryId');
  const planId = searchParams.get('planId');
  // The household id comes from GET /users/me (UserProfileDto.householdId).
  const { householdId } = settingsStore;

  useEffect(() => {
    if (!settingsStore.profileLoaded) {
      void settingsStore.loadProfile();
    }
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: theme.space.lg,
        padding: theme.space.lg,
      }}
    >
      <span
        style={{
          fontSize: theme.fontSize.xl,
          fontWeight: theme.fontWeight.semibold,
          color: theme.color.text.primary,
        }}
      >
        <FormattedMessage id="screen.household.title" defaultMessage="Household" />
      </span>

      {categoryId !== null && planId !== null && householdId !== '' ? (
        <HouseholdCategoryDrillIn
          store={householdCategoryStore}
          householdId={householdId}
          planId={planId}
          categoryId={categoryId}
        />
      ) : (
        <span style={{ fontSize: theme.fontSize.md, color: theme.color.text.secondary }}>
          <FormattedMessage
            id="screen.household.selectCategory"
            defaultMessage="Select a category to view details"
          />
        </span>
      )}
    </div>
  );
});
