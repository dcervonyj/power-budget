import React, { useEffect } from 'react';
import { FormattedMessage } from 'react-intl';
import { observer } from 'mobx-react-lite';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../components/ThemeContext.js';
import { ReconnectBanner } from '../../components/bank/ReconnectBanner.js';
import { BankSyncFailureBanner } from '../../components/bank/BankSyncFailureBanner.js';
import { EmptyState } from '../../components/shared/EmptyState.js';
import { bankConnectionStore } from '../../../application/bank/BankConnectionStore.js';
import { dashboardStore } from '../../../application/dashboard/DashboardStore.js';
import { ErrorBanner } from '../../components/shared/ErrorBanner.js';
import { SkeletonList } from '../../components/shared/SkeletonList.js';
import { PlanDashboardView } from '../../components/plan-dashboard/PlanDashboardView.js';

const POLL_INTERVAL_MS = 30_000;

export const DashboardScreen = observer(function DashboardScreen(): React.JSX.Element {
  const theme = useTheme();
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
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: theme.space.md,
        padding: theme.space.lg,
        maxWidth: 880,
        margin: '0 auto',
      }}
    >
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

      {/* Plan tab strip */}
      {dashboardStore.activePlans.length > 1 && (
        <div
          style={{
            display: 'flex',
            gap: theme.space.sm,
            overflowX: 'auto',
            paddingBottom: theme.space.xs,
          }}
        >
          {dashboardStore.activePlans.map((plan) => {
            const isSelected = plan.id === dashboardStore.selectedPlanId;
            return (
              <button
                key={plan.id}
                type="button"
                onClick={() => {
                  dashboardStore.selectPlan(plan.id);
                }}
                style={{
                  padding: `${String(theme.space.xs)}px ${String(theme.space.md)}px`,
                  borderRadius: theme.radius.pill,
                  border: `1px solid ${isSelected ? theme.color.accent.default : theme.color.border.subtle}`,
                  backgroundColor: isSelected
                    ? `${theme.color.accent.default}22`
                    : theme.color.surface.raised,
                  color: isSelected ? theme.color.accent.default : theme.color.text.secondary,
                  fontSize: theme.fontSize.sm,
                  fontWeight: isSelected ? theme.fontWeight.semibold : theme.fontWeight.regular,
                  cursor: 'pointer',
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                {plan.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Loading skeleton */}
      {dashboardStore.loading && !dashboardStore.plansLoaded && (
        <SkeletonList rows={5} rowHeight={64} />
      )}

      {/* No plans */}
      {dashboardStore.plansLoaded && dashboardStore.activePlans.length === 0 && (
        <EmptyState
          icon="📋"
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
              void navigate('/plans');
            },
          }}
        />
      )}

      {/* The selected plan */}
      {dashboardStore.selectedPlanId !== null && (
        <PlanDashboardView
          store={dashboardStore.planDashboard}
          onRetry={() => {
            dashboardStore.refresh();
          }}
        />
      )}
    </div>
  );
});
