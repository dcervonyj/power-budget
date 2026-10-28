import React, { useEffect, useState, useCallback } from 'react';
import { useIntl } from 'react-intl';
import { useNavigate } from 'react-router-dom';
import { ClonePlanModal } from '../../components/ClonePlanModal.js';
import { isSupportedCurrency, toLocalIsoDate } from '@power-budget/core';
import type { CreatePlanDto, PlanDto } from '@power-budget/shared-app/contract';
import { plansApi } from '../../../AppProviders.js';
import { PlansListView } from './PlansListView.js';
import { settingsStore } from '../../../application/settings/SettingsStore.js';
import { referenceCatalogue } from '../../../application/catalogue/catalogueInstance.js';

const DEFAULT_PLAN_CURRENCY = 'EUR';

/** First day of the current month, local time: the start of a new monthly plan. */
function currentMonthStart(): string {
  const today = new Date();

  return toLocalIsoDate(new Date(today.getFullYear(), today.getMonth(), 1));
}

export function PlansListScreen(): React.JSX.Element {
  const intl = useIntl();
  const navigate = useNavigate();

  const [plans, setPlans] = useState<PlanDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [cloneTarget, setCloneTarget] = useState<string | null>(null);

  const fetchPlans = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      setPlans(await plansApi.list('all'));
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
      const created = await plansApi.create(body);
      referenceCatalogue.invalidate();
      void navigate(`/plans/${created.id}`);
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
      await plansApi.archive(id);
      referenceCatalogue.invalidate();
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

  return (
    <PlansListView
      plans={plans}
      loading={loading}
      error={error}
      creating={creating}
      onCreate={() => {
        void handleCreate();
      }}
      onOpen={(planId) => {
        void navigate(`/plans/${planId}`);
      }}
      onClone={setCloneTarget}
      onDelete={(planId) => {
        void handleDelete(planId);
      }}
      onRetry={() => {
        void fetchPlans();
      }}
    >
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
    </PlansListView>
  );
}
