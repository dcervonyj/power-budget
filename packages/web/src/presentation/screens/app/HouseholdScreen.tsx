import React from 'react';
import { FormattedMessage } from 'react-intl';
import { useSearchParams } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import { useTheme } from '../../components/ThemeContext.js';
import { HouseholdCategoryDrillIn } from '../../components/household/HouseholdCategoryDrillIn.js';
import { householdCategoryStore } from '../../../application/household/HouseholdCategoryStore.js';

export const HouseholdScreen = observer(function HouseholdScreen(): React.JSX.Element {
  const theme = useTheme();
  const [searchParams] = useSearchParams();
  const categoryId = searchParams.get('categoryId');

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

      {categoryId !== null ? (
        <HouseholdCategoryDrillIn store={householdCategoryStore} categoryId={categoryId} />
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
