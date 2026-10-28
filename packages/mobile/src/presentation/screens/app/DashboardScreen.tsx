import React from 'react';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { AppTabParamList } from '../../navigation/types.js';
import { httpOverviewApi } from '../../../infrastructure/overview/OverviewApi.js';
import { OverviewView } from './overview/OverviewView.js';
import { useOverviewData, type OverviewTarget } from './overview/useOverviewData.js';

const ACTIVE_PLAN: OverviewTarget = { kind: 'active' };

/** Overview tab: the first active plan (others in a picker), refreshed every 30 s and on pull. */
export function DashboardScreen(): React.JSX.Element {
  const navigation = useNavigation<BottomTabNavigationProp<AppTabParamList>>();
  const data = useOverviewData(httpOverviewApi, ACTIVE_PLAN);

  function openToSort(): void {
    navigation.navigate('ToSort');
  }

  function openPlans(): void {
    navigation.navigate('Plans');
  }

  return (
    <OverviewView
      model={data.model}
      loading={data.loading}
      refreshing={data.refreshing}
      error={data.error}
      noActivePlan={data.noActivePlan}
      plans={data.plans}
      selectedPlanId={data.selectedPlanId}
      toSortCount={data.toSortCount}
      sync={data.sync}
      onSelectPlan={data.selectPlan}
      onRefresh={data.refresh}
      onRetry={data.retry}
      onOpenToSort={openToSort}
      onOpenPlans={openPlans}
    />
  );
}
