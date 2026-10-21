import { makeAutoObservable } from 'mobx';
import type { PlansApi } from '@power-budget/shared-app';
import type { PlanDto } from '@power-budget/shared-app/contract';
import { categoriesApi, plansApi } from '../../AppProviders.js';
import { PlanDashboardStore } from './PlanDashboardStore.js';

export type DashboardPlans = Pick<PlansApi, 'list'>;

/** The plan shown first: the personal monthly plan, else the first active one. */
export function selectDefaultPlan(plans: readonly PlanDto[]): PlanDto | undefined {
  return plans.find(isPersonalMonthly) ?? plans[0];
}

/**
 * The home dashboard: the active plans as tabs, and the selected plan's dashboard
 * (delegated to a PlanDashboardStore, shared with /plans/:id/dashboard).
 */
export class DashboardStore {
  activePlans: PlanDto[] = [];
  selectedPlanId: string | null = null;
  loading = false;
  /** Set once the plan list has been read, so "no plans" is not shown while loading. */
  plansLoaded = false;
  plansError = false;

  readonly planDashboard: PlanDashboardStore;
  private readonly plans: DashboardPlans;

  constructor(plans: DashboardPlans, planDashboard: PlanDashboardStore) {
    this.plans = plans;
    this.planDashboard = planDashboard;
    makeAutoObservable<DashboardStore, 'plans'>(this, { plans: false, planDashboard: false });
  }

  /** Reads the active plans and opens the selected one (or the default plan). */
  async open(): Promise<void> {
    this.loading = true;
    this.plansError = false;
    try {
      this.applyPlans(await this.plans.list());
    } catch {
      this.applyPlansFailed();
    }
  }

  selectPlan(planId: string): void {
    this.selectedPlanId = planId;
    void this.planDashboard.load(planId);
  }

  /** Re-reads the selected plan's dashboard (polling, retry). */
  refresh(): void {
    if (this.selectedPlanId !== null) {
      void this.planDashboard.load(this.selectedPlanId);
    }
  }

  private applyPlans(plans: PlanDto[]): void {
    this.activePlans = plans;
    this.plansLoaded = true;
    this.loading = false;
    const plan = findPlan(plans, this.selectedPlanId) ?? selectDefaultPlan(plans);
    if (plan !== undefined) {
      this.selectPlan(plan.id);
    }
  }

  private applyPlansFailed(): void {
    this.plansError = true;
    this.loading = false;
  }
}

function findPlan(plans: readonly PlanDto[], planId: string | null): PlanDto | undefined {
  for (const plan of plans) {
    if (plan.id === planId) {
      return plan;
    }
  }

  return undefined;
}

function isPersonalMonthly(plan: PlanDto): boolean {
  return plan.type === 'personal' && plan.periodKind === 'monthly';
}

export const planDashboardStore = new PlanDashboardStore(plansApi, categoriesApi);
export const dashboardStore = new DashboardStore(plansApi, planDashboardStore);
