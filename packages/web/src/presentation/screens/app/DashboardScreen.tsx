import React, { useEffect } from 'react';
import { FormattedMessage } from 'react-intl';
import { observer } from 'mobx-react-lite';
import { useTheme } from '../../components/ThemeContext.js';
import { ReconnectBanner } from '../../components/bank/ReconnectBanner.js';
import { bankConnectionStore } from '../../../application/bank/BankConnectionStore.js';
import { dashboardStore } from '../../../application/dashboard/DashboardStore.js';
import { PlanHeader } from '../../components/dashboard/PlanHeader.js';
import { IncomeSection } from '../../components/dashboard/IncomeSection.js';
import { ExpenseSection } from '../../components/dashboard/ExpenseSection.js';
import { UnplannedSection } from '../../components/dashboard/UnplannedSection.js';
import { LeftoverBucket } from '../../components/dashboard/LeftoverBucket.js';
import { BottomLine } from '../../components/dashboard/BottomLine.js';
import type { Plan } from '../../../application/dashboard/DashboardStore.js';

const POLL_INTERVAL_MS = 30_000;

function selectDefaultPlan(plans: Plan[]): Plan | undefined {
  return plans.find((p) => p.type === 'personal' && p.periodType === 'monthly') ?? plans[0];
}

export const DashboardScreen = observer(function DashboardScreen(): React.JSX.Element {
  const theme = useTheme();

  useEffect(() => {
    void bankConnectionStore.fetchConnections();

    void dashboardStore.fetchPlans().then(() => {
      const plan = selectDefaultPlan(dashboardStore.activePlans);
      if (plan) {
        dashboardStore.selectPlan(plan.id);
      }
    });

    const interval = setInterval(() => {
      if (dashboardStore.selectedPlanId) {
        void dashboardStore.fetchActuals(dashboardStore.selectedPlanId);
      }
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
        maxWidth: 720,
        margin: '0 auto',
      }}
    >
      <ReconnectBanner connections={bankConnectionStore.connections} />

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

      {/* Loading */}
      {dashboardStore.loading && !dashboardStore.actuals && (
        <div style={{ color: theme.color.text.secondary, padding: theme.space.xl }}>
          <FormattedMessage id="screen.dashboard.loading" defaultMessage="Loading dashboard…" />
        </div>
      )}

      {/* Error */}
      {dashboardStore.error !== null && (
        <div
          style={{
            padding: theme.space.md,
            borderRadius: theme.radius.md,
            backgroundColor: `${theme.color.status.danger}22`,
            color: theme.color.status.danger,
            fontSize: theme.fontSize.sm,
          }}
        >
          <FormattedMessage id="screen.dashboard.error" defaultMessage="Failed to load dashboard" />
        </div>
      )}

      {/* No plans */}
      {!dashboardStore.loading &&
        dashboardStore.actuals === null &&
        dashboardStore.error === null && (
          <div style={{ color: theme.color.text.muted, padding: theme.space.xl }}>
            <FormattedMessage id="screen.dashboard.noPlan" defaultMessage="No active plan" />
          </div>
        )}

      {/* Dashboard widgets */}
      {dashboardStore.actuals !== null && (
        <>
          <PlanHeader actuals={dashboardStore.actuals} />
          <IncomeSection items={dashboardStore.actuals.items} />
          <ExpenseSection items={dashboardStore.actuals.items} />
          <UnplannedSection
            count={dashboardStore.actuals.unplannedCount}
            totalMinor={dashboardStore.actuals.unplannedTotal}
            currency={dashboardStore.actuals.currency}
          />
          <LeftoverBucket
            leftoverMinor={dashboardStore.actuals.leftover}
            currency={dashboardStore.actuals.currency}
          />
          <BottomLine store={dashboardStore} actuals={dashboardStore.actuals} />
        </>
      )}
    </div>
  );
});
