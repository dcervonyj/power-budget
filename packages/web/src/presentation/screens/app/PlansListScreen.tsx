import React, { useEffect, useState, useCallback } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../components/ThemeContext.js';
import { Button } from '../../components/Button.js';
import { ClonePlanModal } from '../../components/ClonePlanModal.js';
import { apiClient } from '../../../AppProviders.js';

type PlanPeriod = 'weekly' | 'monthly' | 'custom';
type PlanStatus = 'active' | 'draft' | 'archived';

interface Plan {
  id: string;
  name: string;
  period: PlanPeriod;
  status: PlanStatus;
  baseCurrency: string;
  startDate?: string;
  endDate?: string;
  version: number;
  updatedAt: string;
}

export function PlansListScreen(): React.JSX.Element {
  const theme = useTheme();
  const intl = useIntl();
  const navigate = useNavigate();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [cloneTarget, setCloneTarget] = useState<string | null>(null);

  const fetchPlans = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<Plan[]>('/plans');
      setPlans(res.data);
    } catch {
      setError(
        intl.formatMessage({
          id: 'screen.plansList.error',
          defaultMessage: 'Failed to load plans',
        }),
      );
    } finally {
      setLoading(false);
    }
  }, [intl]);

  useEffect(() => {
    void fetchPlans();
  }, [fetchPlans]);

  const handleCreate = async (): Promise<void> => {
    setCreating(true);
    try {
      const res = await apiClient.post<Plan>('/plans', {
        name: intl.formatMessage({
          id: 'screen.plansList.defaultPlanName',
          defaultMessage: 'New Plan',
        }),
        period: 'monthly' as PlanPeriod,
        baseCurrency: 'USD',
      });
      void navigate(`/plans/${res.data.id}`);
    } catch {
      setError(
        intl.formatMessage({
          id: 'screen.plansList.createError',
          defaultMessage: 'Failed to create plan',
        }),
      );
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string): Promise<void> => {
    const prevPlans = plans;
    setPlans((prev) => prev.filter((p) => p.id !== id));
    try {
      await apiClient.delete(`/plans/${id}`);
    } catch {
      setPlans(prevPlans);
      setError(
        intl.formatMessage({
          id: 'screen.plansList.deleteError',
          defaultMessage: 'Failed to delete plan',
        }),
      );
    }
  };

  const periodLabel = (period: PlanPeriod): string => {
    switch (period) {
      case 'weekly':
        return intl.formatMessage({
          id: 'screen.plansList.planPeriod.weekly',
          defaultMessage: 'Weekly',
        });
      case 'monthly':
        return intl.formatMessage({
          id: 'screen.plansList.planPeriod.monthly',
          defaultMessage: 'Monthly',
        });
      case 'custom':
        return intl.formatMessage({
          id: 'screen.plansList.planPeriod.custom',
          defaultMessage: 'Custom',
        });
    }
  };

  const statusLabel = (status: PlanStatus): string => {
    switch (status) {
      case 'active':
        return intl.formatMessage({
          id: 'screen.plansList.planStatus.active',
          defaultMessage: 'Active',
        });
      case 'draft':
        return intl.formatMessage({
          id: 'screen.plansList.planStatus.draft',
          defaultMessage: 'Draft',
        });
      case 'archived':
        return intl.formatMessage({
          id: 'screen.plansList.planStatus.archived',
          defaultMessage: 'Archived',
        });
    }
  };

  return (
    <div
      style={{
        padding: theme.space['2xl'],
        maxWidth: 800,
        margin: '0 auto',
        color: theme.color.text.primary,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: theme.space.xl,
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: theme.fontSize['2xl'],
            fontWeight: theme.fontWeight.semibold,
          }}
        >
          <FormattedMessage id="screen.plansList.title" defaultMessage="Plans" />
        </h1>
        <Button
          variant="primary"
          loading={creating}
          onClick={() => {
            void handleCreate();
          }}
        >
          <FormattedMessage id="screen.plansList.createButton" defaultMessage="Create new plan" />
        </Button>
      </div>

      {loading && (
        <p style={{ color: theme.color.text.secondary }}>
          <FormattedMessage id="screen.plansList.loading" defaultMessage="Loading plans…" />
        </p>
      )}

      {error !== null && !loading && <p style={{ color: theme.color.status.danger }}>{error}</p>}

      {!loading && !error && plans.length === 0 && (
        <p style={{ color: theme.color.text.secondary }}>
          <FormattedMessage id="screen.plansList.empty" defaultMessage="No plans yet" />
        </p>
      )}

      {!loading && plans.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space.sm }}>
          {plans.map((plan) => (
            <div
              key={plan.id}
              style={{
                backgroundColor: theme.color.surface.raised,
                borderRadius: theme.radius.md,
                padding: `${theme.space.md}px ${theme.space.lg}px`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                border: `1px solid ${theme.color.border.subtle}`,
              }}
              onClick={() => {
                void navigate(`/plans/${plan.id}`);
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space.xs }}>
                <span style={{ fontWeight: theme.fontWeight.medium, fontSize: theme.fontSize.md }}>
                  {plan.name}
                </span>
                <span
                  style={{
                    color: theme.color.text.secondary,
                    fontSize: theme.fontSize.sm,
                    display: 'flex',
                    gap: theme.space.xs,
                  }}
                >
                  <span>{periodLabel(plan.period)}</span>
                  <span>{statusLabel(plan.status)}</span>
                </span>
              </div>
              <div
                style={{ display: 'flex', gap: theme.space.sm }}
                onClick={(e) => {
                  e.stopPropagation();
                }}
              >
                <Button
                  variant="secondary"
                  onClick={() => {
                    setCloneTarget(plan.id);
                  }}
                >
                  <FormattedMessage id="screen.plansList.cloneButton" defaultMessage="Clone" />
                </Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    void handleDelete(plan.id);
                  }}
                >
                  <FormattedMessage id="screen.plansList.deleteButton" defaultMessage="Delete" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {cloneTarget !== null && (
        <ClonePlanModal
          isOpen
          planId={cloneTarget}
          onClose={() => {
            setCloneTarget(null);
          }}
          onCloned={() => {
            void fetchPlans();
          }}
        />
      )}
    </div>
  );
}
