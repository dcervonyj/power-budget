import React, { useEffect } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { observer } from 'mobx-react-lite';
import { useNavigate } from 'react-router-dom';
import { ReconnectBanner } from '../../components/bank/ReconnectBanner.js';
import { BankSyncFailureBanner } from '../../components/bank/BankSyncFailureBanner.js';
import { EmptyState } from '../../components/shared/EmptyState.js';
import { ErrorBanner } from '../../components/shared/ErrorBanner.js';
import { SkeletonList } from '../../components/shared/SkeletonList.js';
import { PlanDashboardView } from '../../components/plan-dashboard/PlanDashboardView.js';
import { OVERVIEW_CONTAINER_STYLE } from '../../components/plan-dashboard/overviewStyles.js';
import { FilterChips } from '../../glass/controls/FilterChips.js';
import { bankConnectionStore } from '../../../application/bank/BankConnectionStore.js';
import { dashboardStore } from '../../../application/dashboard/DashboardStore.js';
import { appShellStore } from '../../../application/shell/appShellStore.js';
import { ROUTE_PATHS } from '../../../infrastructure/navigation/routePaths.js';

const POLL_INTERVAL_MS = 30_000;

/** `/dashboard`: the Overview of the selected active plan (personal monthly first), polled every 30 s. */
export const DashboardScreen = observer(function DashboardScreen(): React.JSX.Element {
  const intl = useIntl();
  const navigate = useNavigate();

  useEffect(() => {
    void bankConnectionStore.fetchConnections();

    void dashboardStore.open();

    const interval = setInterval(() => {
      dashboardStore.refresh();
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);

  return (
    <div style={OVERVIEW_CONTAINER_STYLE}>
      <ReconnectBanner connections={bankConnectionStore.connections} />
      <BankSyncFailureBanner />

      {dashboardStore.plansError && (
        <ErrorBanner
          message={
            <FormattedMessage
              id="screen.dashboard.plansError"
              defaultMessage="Failed to load plans"
            />
          }
          onRetry={() => {
            void dashboardStore.open();
          }}
        />
      )}

      {dashboardStore.activePlans.length > 1 && dashboardStore.selectedPlanId !== null && (
        <FilterChips
          label={intl.formatMessage({ id: 'overview.plans.label', defaultMessage: 'Plans' })}
          options={dashboardStore.activePlans.map((plan) => ({
            value: plan.id,
            label: plan.name,
          }))}
          value={dashboardStore.selectedPlanId}
          onChange={(planId) => {
            dashboardStore.selectPlan(planId);
          }}
        />
      )}

      {dashboardStore.loading && !dashboardStore.plansLoaded && (
        <SkeletonList rows={5} rowHeight={64} />
      )}

      {dashboardStore.plansLoaded && dashboardStore.activePlans.length === 0 && (
        <EmptyState
          title={
            <FormattedMessage
              id="component.shared.empty.noPlans"
              defaultMessage="No active budget plan"
            />
          }
          action={{
            label: (
              <FormattedMessage
                id="component.shared.empty.createPlan"
                defaultMessage="Create plan"
              />
            ),
            onPress: () => {
              void navigate(ROUTE_PATHS.plans);
            },
          }}
        />
      )}

      {dashboardStore.selectedPlanId !== null && (
        <PlanDashboardView
          store={dashboardStore.planDashboard}
          toSortCount={appShellStore.toSortCount}
          onRetry={() => {
            dashboardStore.refresh();
          }}
        />
      )}
    </div>
  );
});
