import React, { useMemo } from 'react';
import type { AppStackScreenProps } from '../../navigation/types.js';
import { httpOverviewApi } from '../../../infrastructure/overview/OverviewApi.js';
import { OverviewView } from './overview/OverviewView.js';
import { useReloadOnFocus } from './overview/useReloadOnFocus.js';
import { useOverviewData, type OverviewTarget } from './overview/useOverviewData.js';

const NO_PLANS: readonly never[] = [];

/** The same Overview for one given plan (stack screen), refreshed every 30 s and on pull. */
export function PlanDashboardScreen({
  route,
  navigation,
}: AppStackScreenProps<'PlanDashboard'>): React.JSX.Element {
  const { planId } = route.params;
  const target = useMemo<OverviewTarget>(() => ({ kind: 'plan', planId }), [planId]);
  const data = useOverviewData(httpOverviewApi, target);
  useReloadOnFocus(navigation, data.reload);

  function openToSort(): void {
    navigation.navigate('Tabs', { screen: 'ToSort' });
  }

  return (
    <OverviewView
      model={data.model}
      loading={data.loading}
      refreshing={data.refreshing}
      error={data.error}
      noActivePlan={false}
      plans={NO_PLANS}
      selectedPlanId={data.selectedPlanId}
      toSortCount={data.toSortCount}
      sync={data.sync}
      onSelectPlan={data.selectPlan}
      onRefresh={data.refresh}
      onRetry={data.retry}
      onOpenToSort={openToSort}
    />
  );
}
