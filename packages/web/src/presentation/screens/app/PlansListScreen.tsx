import React, { useEffect, useState, useCallback } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../components/ThemeContext.js';
import { Button } from '../../components/Button.js';
import { ClonePlanModal } from '../../components/ClonePlanModal.js';
import { isSupportedCurrency, toLocalIsoDate } from '@power-budget/core';
import { apiClient } from '../../../AppProviders.js';
import { settingsStore } from '../../../application/settings/SettingsStore.js';
import {
  PlanMapper,
  type CreatePlanDto,
  type PlanDto,
  type PlanSummary,
} from '../../../infrastructure/api/PlanMapper.js';

type PlanPeriod = PlanSummary['period'];
type PlanStatus = PlanSummary['status'];
type Plan = PlanSummary;

const DEFAULT_PLAN_CURRENCY = 'EUR';

/** First day of the current month, local time: the start of a new monthly plan. */
function currentMonthStart(): string {
  const today = new Date();

  return toLocalIsoDate(new Date(today.getFullYear(), today.getMonth(), 1));
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
      const res = await apiClient.get<PlanDto[]>('/plans?status=all');
      setPlans(res.data.map(PlanMapper.toPlan));
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
      const body: CreatePlanDto = {
        name: intl.formatMessage({
          id: 'screen.plansList.defaultPlanName',
          defaultMessage: 'New Plan',
        }),
        type: 'personal',
        periodKind: 'monthly',
        periodStart: currentMonthStart(),
        baseCurrency: isSupportedCurrency(settingsStore.baseCurrency)
          ? settingsStore.baseCurrency
          : DEFAULT_PLAN_CURRENCY,
      };
      const res = await apiClient.post<PlanDto>('/plans', body);
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
      // Plans are archived, not deleted (CLN-011).
      await apiClient.post(`/plans/${id}/archive`, {});
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
