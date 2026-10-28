import { makeAutoObservable } from 'mobx';
import type { PlansApi } from '@power-budget/shared-app';
import type { PlanDto } from '@power-budget/shared-app/contract';
import type { PlanDashboardStore } from './PlanDashboardStore.js';

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
  /** Bumped when the session ends, so a late answer for the previous user is dropped. */
  private session = 0;

  constructor(plans: DashboardPlans, planDashboard: PlanDashboardStore) {
    this.plans = plans;
    this.planDashboard = planDashboard;
    makeAutoObservable<DashboardStore, 'plans' | 'session'>(this, {
      plans: false,
      planDashboard: false,
      session: false,
    });
  }

  /** Reads the active plans and opens the selected one (or the default plan). */
  async open(): Promise<void> {
    const session = this.session;
    this.loading = true;
    this.plansError = false;
    try {
      this.applyPlans(session, await this.plans.list());
    } catch {
      this.applyPlansFailed(session);
    }
  }

  selectPlan(planId: string): void {
    this.selectedPlanId = planId;
    void this.planDashboard.load(planId);
  }

  /** Re-reads the selected plan's dashboard in full (retry). */
  refresh(): void {
    if (this.selectedPlanId !== null) {
      void this.planDashboard.load(this.selectedPlanId);
    }
  }

  /** The 30 s poll: one dashboard request for the selected plan. */
  poll(): void {
    if (this.selectedPlanId !== null) {
      void this.planDashboard.poll(this.selectedPlanId);
    }
  }

  /** The Overview is left: timers of the shown dashboard stop and a late plan list is dropped. */
  close(): void {
    this.session += 1;
    this.loading = false;
    this.planDashboard.stop();
  }

  /** Sign-out or session end: nothing of the previous user's plans stays. */
  resetSession(): void {
    this.session += 1;
    this.activePlans = [];
    this.selectedPlanId = null;
    this.loading = false;
    this.plansLoaded = false;
    this.plansError = false;
  }

  private applyPlans(session: number, plans: PlanDto[]): void {
    if (session !== this.session) {
      return;
    }
    this.activePlans = plans;
    this.plansLoaded = true;
    this.loading = false;
    const plan = findPlan(plans, this.selectedPlanId) ?? selectDefaultPlan(plans);
    if (plan !== undefined) {
      this.selectPlan(plan.id);
    }
  }

  private applyPlansFailed(session: number): void {
    if (session !== this.session) {
      return;
    }
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
