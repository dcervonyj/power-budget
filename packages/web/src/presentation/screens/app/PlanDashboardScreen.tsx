import React, { useEffect } from 'react';
import { FormattedMessage } from 'react-intl';
import { observer } from 'mobx-react-lite';
import { Link, useParams } from 'react-router-dom';
import { useTheme } from '../../components/ThemeContext.js';
import { PlanDashboardView } from '../../components/plan-dashboard/PlanDashboardView.js';
import { planDashboardStore } from '../../../application/dashboard/DashboardStore.js';

const POLL_INTERVAL_MS = 30_000;

/** `/plans/:id/dashboard`: one plan's dashboard, refreshed every 30 s. */
export const PlanDashboardScreen = observer(function PlanDashboardScreen(): React.JSX.Element {
  const theme = useTheme();
  const { id = '' } = useParams<{ id: string }>();

  useEffect(() => {
    if (id === '') {
      return undefined;
    }
    void planDashboardStore.load(id);
    const interval = setInterval(() => {
      void planDashboardStore.load(id);
    }, POLL_INTERVAL_MS);

    return () => {
      clearInterval(interval);
    };
  }, [id]);

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
      <nav style={{ display: 'flex', gap: theme.space.lg, fontSize: theme.fontSize.sm }}>
        <Link to="/plans" style={{ color: theme.color.accent.default }}>
          <FormattedMessage id="planDashboard.backToPlans" defaultMessage="All plans" />
        </Link>
        <Link to={`/plans/${id}`} style={{ color: theme.color.accent.default }}>
          <FormattedMessage id="planDashboard.editPlan" defaultMessage="Edit plan" />
        </Link>
      </nav>
      <PlanDashboardView
        store={planDashboardStore}
        onRetry={() => {
          void planDashboardStore.load(id);
        }}
      />
    </div>
  );
});
