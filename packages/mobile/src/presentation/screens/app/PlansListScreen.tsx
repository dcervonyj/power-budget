import React, { useCallback, useEffect, useState } from 'react';
import { useIntl } from 'react-intl';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { toLocalIsoDate } from '@power-budget/core';
import type { CreatePlanDto, PlanDto, PlanPeriodKindDto } from '@power-budget/shared-app/contract';
import type { AppTabParamList, AppStackParamList } from '../../navigation/types.js';
import { plansApi } from '../../../infrastructure/index.js';
import { PlansListView } from './plan/PlansListView.js';

type Props = CompositeScreenProps<
  BottomTabScreenProps<AppTabParamList, 'Plans'>,
  NativeStackScreenProps<AppStackParamList>
>;

const DEFAULT_PLAN_CURRENCY = 'EUR';

type PeriodKind = PlanPeriodKindDto;

/** Local-time period a new plan of this kind starts with; custom plans get the month, editable later. */
function initialPeriod(kind: PeriodKind): { start: string; end: string } {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  if (kind === 'weekly') {
    const monday = new Date(year, month, today.getDate() - ((today.getDay() + 6) % 7));
    const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);

    return { start: toLocalIsoDate(monday), end: toLocalIsoDate(sunday) };
  }

  return {
    start: toLocalIsoDate(new Date(year, month, 1)),
    end: toLocalIsoDate(new Date(year, month + 1, 0)),
  };
}

export function PlansListScreen({ navigation }: Props): React.JSX.Element {
  const intl = useIntl();
  const [plans, setPlans] = useState<PlanDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [periodKind, setPeriodKind] = useState<PeriodKind>('monthly');
  const [error, setError] = useState<string | null>(null);

  const loadPlans = useCallback(async () => {
    setError(null);
    try {
      setPlans(await plansApi.list('all'));
    } catch {
      setError(
        intl.formatMessage({
          id: 'plan.list.error',
          defaultMessage: 'Could not load plans. Please try again.',
        }),
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [intl]);

  useEffect(() => {
    void loadPlans();

    // A plan edited or archived in the editor shows up changed when the user comes back.
    return navigation.addListener('focus', () => {
      void loadPlans();
    });
  }, [loadPlans, navigation]);

  async function handleCreate(): Promise<void> {
    setCreating(true);
    setError(null);
    try {
      const period = initialPeriod(periodKind);
      const body: CreatePlanDto = {
        name: intl.formatMessage({ id: 'plan.list.defaultName', defaultMessage: 'New plan' }),
        type: 'personal',
        periodKind,
        periodStart: period.start,
        ...(periodKind === 'custom' ? { periodEnd: period.end } : {}),
        baseCurrency: DEFAULT_PLAN_CURRENCY,
      };
      const created = await plansApi.create(body);
      navigation.navigate('PlanEditor', { planId: created.id });
    } catch {
      setError(
        intl.formatMessage({
          id: 'plan.list.createError',
          defaultMessage: 'Could not create the plan.',
        }),
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <PlansListView
      plans={plans}
      loading={loading}
      refreshing={refreshing}
      error={error}
      creating={creating}
      periodKind={periodKind}
      onPeriodKindChange={setPeriodKind}
      onCreate={() => {
        void handleCreate();
      }}
      onOpen={(planId) => {
        navigation.navigate('PlanEditor', { planId });
      }}
      onRefresh={() => {
        setRefreshing(true);
        void loadPlans();
      }}
      onRetry={() => {
        setLoading(true);
        void loadPlans();
      }}
    />
  );
}
