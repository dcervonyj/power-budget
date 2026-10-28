import { useCallback, useEffect, useRef, useState } from 'react';
import { readApiError } from '@power-budget/shared-app';
import {
  FX_RATE_UNAVAILABLE,
  type CategoryDto,
  type PlanDto,
} from '@power-budget/shared-app/contract';
import type { SyncChipState } from '../../../glass/atoms/syncChipState.js';
import type { OverviewApi } from '../../../../infrastructure/overview/OverviewApi.js';
import { toOverviewModel, type OverviewModel } from './overviewModel.js';
import { summariseSync } from './overviewSync.js';

export const POLL_INTERVAL_MS = 30_000;

/** `plans_failed`: the active plans could not be read; the others are about one plan's dashboard. */
export type OverviewError = 'plans_failed' | 'not_found' | 'fx_unavailable' | 'failed';

export interface OverviewPlanChoice {
  readonly id: string;
  readonly name: string;
}

/** Which plan the Overview shows: the first active one (tab), or a given one (plan stack screen). */
export type OverviewTarget =
  { readonly kind: 'active' } | { readonly kind: 'plan'; readonly planId: string };

export interface OverviewData {
  readonly model: OverviewModel | null;
  readonly loading: boolean;
  readonly refreshing: boolean;
  readonly error: OverviewError | null;
  /** The plans were read and none is active. */
  readonly noActivePlan: boolean;
  /** Active plans to pick from (tab only). */
  readonly plans: readonly OverviewPlanChoice[];
  readonly selectedPlanId: string | null;
  /** Transactions to sort; null until known (a failed read hides the card instead of guessing). */
  readonly toSortCount: number | null;
  readonly sync: SyncChipState | null;
  selectPlan(planId: string): void;
  refresh(): void;
  retry(): void;
}

/**
 * Container logic of the Overview: plans, the selected plan's dashboard with category names, the
 * to-sort count and the bank sync chip. Polls every 30 s; a silent poll that fails keeps what is shown.
 * An answer for a plan that is no longer selected is dropped.
 */
export function useOverviewData(api: OverviewApi, target: OverviewTarget): OverviewData {
  const fixedPlanId = target.kind === 'plan' ? target.planId : null;
  const [plans, setPlans] = useState<readonly PlanDto[]>([]);
  const [plansLoaded, setPlansLoaded] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(fixedPlanId);
  const [model, setModel] = useState<OverviewModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<OverviewError | null>(null);
  const [toSortCount, setToSortCount] = useState<number | null>(null);
  const [sync, setSync] = useState<SyncChipState | null>(null);
  const shownPlanId = useRef<string | null>(fixedPlanId);

  const loadPlans = useCallback(async (): Promise<void> => {
    if (fixedPlanId !== null) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const active = await api.activePlans();
      setPlans(active);
      setPlansLoaded(true);
      setSelectedPlanId(active[0]?.id ?? null);
      if (active.length === 0) {
        setLoading(false);
      }
    } catch {
      setError('plans_failed');
      setLoading(false);
    }
  }, [api, fixedPlanId]);

  const loadDashboard = useCallback(
    async (planId: string, silent: boolean): Promise<void> => {
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const [dto, categories, planName] = await Promise.all([
          api.dashboard(planId),
          listCategories(api),
          planNameOf(api, planId, plans),
        ]);
        if (shownPlanId.current === planId) {
          setModel(toOverviewModel(dto, planName, toCategoryNames(categories)));
          setError(null);
        }
      } catch (err) {
        if (!silent && shownPlanId.current === planId) {
          setError(classifyDashboardError(err));
        }
      } finally {
        if (shownPlanId.current === planId) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [api, plans],
  );

  const loadExtras = useCallback(async (): Promise<void> => {
    const [toSort, connections, accounts] = await Promise.all([
      api.toSortPage().catch(nothing),
      api.bankConnections().catch(nothing),
      api.accounts().catch(nothing),
    ]);
    if (toSort !== null) {
      setToSortCount(toSort.items.length + (toSort.hasMore ? 1 : 0));
    }
    // Both reads must succeed to change the chip; a failed refresh keeps the last one.
    if (connections !== null && accounts !== null) {
      setSync(summariseSync(connections, accounts, new Date()));
    }
  }, [api]);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  useEffect(() => {
    if (selectedPlanId === null) {
      return undefined;
    }
    shownPlanId.current = selectedPlanId;
    void loadDashboard(selectedPlanId, false);
    void loadExtras();
    const interval = setInterval(() => {
      void loadDashboard(selectedPlanId, true);
      void loadExtras();
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
    // The dashboard reload is keyed by the plan only; a new plan list must not restart polling.
  }, [selectedPlanId]);

  const selectPlan = useCallback((planId: string): void => {
    setModel(null);
    setSelectedPlanId(planId);
  }, []);

  const refresh = useCallback((): void => {
    if (selectedPlanId === null) {
      return;
    }
    setRefreshing(true);
    void loadDashboard(selectedPlanId, true);
    void loadExtras();
  }, [selectedPlanId, loadDashboard, loadExtras]);

  const retry = useCallback((): void => {
    if (selectedPlanId === null) {
      void loadPlans();

      return;
    }
    void loadDashboard(selectedPlanId, false);
  }, [selectedPlanId, loadPlans, loadDashboard]);

  return {
    model,
    loading,
    refreshing,
    error,
    noActivePlan: plansLoaded && plans.length === 0,
    plans: plans.map(toChoice),
    selectedPlanId,
    toSortCount,
    sync,
    selectPlan,
    refresh,
    retry,
  };
}

/** Without categories the dashboard still renders, without names. */
async function listCategories(api: OverviewApi): Promise<CategoryDto[]> {
  try {
    return await api.categories();
  } catch {
    return [];
  }
}

/** The name from the active plan list when it is there; otherwise the plan is read (stack screen). */
async function planNameOf(
  api: OverviewApi,
  planId: string,
  plans: readonly PlanDto[],
): Promise<string> {
  const listed = plans.find((plan) => plan.id === planId);
  if (listed !== undefined) {
    return listed.name;
  }
  try {
    const plan = await api.plan(planId);

    return plan.name;
  } catch {
    return '';
  }
}

function toCategoryNames(categories: readonly CategoryDto[]): Map<string, string> {
  return new Map(categories.map(toNameEntry));
}

function toNameEntry(category: CategoryDto): [string, string] {
  return [category.id, category.name];
}

function toChoice(plan: PlanDto): OverviewPlanChoice {
  return { id: plan.id, name: plan.name };
}

function classifyDashboardError(err: unknown): OverviewError {
  const { status, code } = readApiError(err);
  if (code === FX_RATE_UNAVAILABLE) {
    return 'fx_unavailable';
  }
  if (status === 404) {
    return 'not_found';
  }

  return 'failed';
}

function nothing(): null {
  return null;
}
