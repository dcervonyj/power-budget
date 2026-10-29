import { plansApi, referenceCatalogue, settingsStore } from '../../../composition.js';
import React, { useEffect, useState, useCallback } from 'react';
import { useIntl } from 'react-intl';
import { useNavigate } from 'react-router-dom';
import { ClonePlanModal } from '../../components/ClonePlanModal.js';
import { CreatePlanModal } from '../../components/CreatePlanModal.js';
import { observer } from 'mobx-react-lite';
import type { PlanDto } from '@power-budget/shared-app/contract';
import { PlansListView } from './PlansListView.js';

export const PlansListScreen = observer(function PlansListScreen(): React.JSX.Element {
  const intl = useIntl();
  const navigate = useNavigate();

  const [plans, setPlans] = useState<PlanDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
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

  useEffect(() => {
    // The household membership and the profile currency come from the profile.
    if (!settingsStore.profileLoaded) {
      void settingsStore.loadProfile();
    }
  }, []);

  const handleCreated = (created: PlanDto): void => {
    referenceCatalogue.invalidate();
    setCreateOpen(false);
    void navigate(`/plans/${created.id}`);
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
      creating={!settingsStore.profileLoaded}
      onCreate={() => {
        setCreateOpen(true);
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
      {createOpen && (
        <CreatePlanModal
          isOpen
          hasHousehold={settingsStore.householdId !== null}
          profileCurrency={settingsStore.baseCurrency}
          onClose={() => {
            setCreateOpen(false);
          }}
          onCreated={handleCreated}
        />
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
    </PlansListView>
  );
});
