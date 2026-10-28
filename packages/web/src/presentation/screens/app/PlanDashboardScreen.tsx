import React, { useCallback, useEffect } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { observer } from 'mobx-react-lite';
import { Link, useParams } from 'react-router-dom';
import { PlanDashboardView } from '../../components/plan-dashboard/PlanDashboardView.js';
import { planDashboardStore } from '../../../application/dashboard/DashboardStore.js';
import { appShellStore } from '../../../application/shell/appShellStore.js';
import { useVisiblePolling } from '../../hooks/useVisiblePolling.js';
import { ROUTE_PATHS } from '../../../infrastructure/navigation/routePaths.js';
import { OVERVIEW_CONTAINER_STYLE } from '../../components/plan-dashboard/overviewStyles.js';

const POLL_INTERVAL_MS = 30_000;

const LINK_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 44,
  padding: '0 var(--pb-glass-space-md)',
  borderRadius: 'var(--pb-glass-radius-chip)',
  background: 'var(--pb-glass-clear)',
  boxShadow: 'var(--pb-glass-clear-rim)',
  color: 'var(--pb-glass-fg)',
  fontSize: 'var(--pb-glass-type-small-web)',
  fontWeight: 'var(--pb-glass-type-label-weight)',
  textDecoration: 'none',
};

/** `/plans/:id/dashboard`: the same Overview for one plan, polled every 30 s while the tab is visible. */
export const PlanDashboardScreen = observer(function PlanDashboardScreen(): React.JSX.Element {
  const intl = useIntl();
  const { id = '' } = useParams<{ id: string }>();

  useEffect(() => {
    if (id !== '') {
      void planDashboardStore.load(id);
    }
  }, [id]);

  const poll = useCallback((): void => {
    if (id !== '') {
      void planDashboardStore.poll(id);
    }
  }, [id]);
  useVisiblePolling(poll, POLL_INTERVAL_MS);

  return (
    <div style={OVERVIEW_CONTAINER_STYLE}>
      <nav
        aria-label={intl.formatMessage({ id: 'overview.planLinks.label', defaultMessage: 'Plan' })}
        style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--pb-glass-space-sm)' }}
      >
        <Link to={ROUTE_PATHS.plans} style={LINK_STYLE}>
          <FormattedMessage id="planDashboard.backToPlans" defaultMessage="All plans" />
        </Link>
        <Link to={`${ROUTE_PATHS.plans}/${id}`} style={LINK_STYLE}>
          <FormattedMessage id="planDashboard.editPlan" defaultMessage="Edit plan" />
        </Link>
      </nav>
      <PlanDashboardView
        store={planDashboardStore}
        toSortCount={appShellStore.toSortCount}
        onRetry={() => {
          void planDashboardStore.load(id);
        }}
      />
    </div>
  );
});
