import { makeAutoObservable } from 'mobx';
import { readApiError, type PlansApi } from '@power-budget/shared-app';
import {
  FX_RATE_UNAVAILABLE,
  type PlanDto,
  type PlannedItemDto,
  type UnplannedTransactionPageDto,
} from '@power-budget/shared-app/contract';
import type {
  LineDirection,
  PlanDashboard,
  UnplannedTransaction,
} from '../../domain/dashboard/PlanDashboard.js';
import {
  toPlanDashboard,
  toUnplannedTransaction,
} from '../../infrastructure/api/PlanDashboardMapper.js';
import type { ReferenceCatalogue } from '../catalogue/ReferenceCatalogue.js';
import { toDashboardOverview, type DashboardOverview } from './dashboardOverview.js';

/** 404 is `not_found`; 503 fx_rate_unavailable (CLN-012) is `fx_unavailable`. */
export type PlanDashboardError = 'not_found' | 'fx_unavailable' | 'failed';

/** What the store reads from the plan and category endpoints. */
export type PlanDashboardPlans = Pick<PlansApi, 'get' | 'dashboard' | 'listItems' | 'unplanned'>;
/** What the store needs from the shared catalogue: one plan, its items and the category names. */
interface DashboardReference {
  readonly plan: PlanDto;
  readonly categoryNames: Map<string, string>;
  readonly items: PlannedItemDto[];
}

export type PlanDashboardReference = Pick<ReferenceCatalogue, 'plan' | 'items' | 'categoryNames'>;

/** One page-through list of the caller's own unplanned transactions. */
export interface UnplannedList {
  readonly items: readonly UnplannedTransaction[];
  readonly nextCursor: string | null;
  readonly loading: boolean;
  readonly failed: boolean;
}

/** What the Overview view reads: the store, or fixed data in the gallery. */
export interface PlanDashboardSource {
  readonly dashboard: PlanDashboard | null;
  readonly overview: DashboardOverview | null;
  readonly loading: boolean;
  readonly error: PlanDashboardError | null;
  readonly unplannedExpenses: UnplannedList;
  readonly unplannedIncome: UnplannedList;
  loadMoreUnplanned(direction: LineDirection): Promise<void>;
}

const EMPTY_LIST: UnplannedList = { items: [], nextCursor: null, loading: false, failed: false };

/**
 * One plan's dashboard (`GET /plans/:id/dashboard`) with the names of its categories,
 * the item amounts in their own currency and the first page of the caller's unplanned
 * transactions. A reload keeps the shown data until the new answer arrives.
 *
 * `load` reads everything (open, plan switch, retry). `poll` reads only the dashboard: the plan,
 * its items and the category names come from the shared catalogue (read once per plan), and the
 * unplanned pages the user loaded stay as they are.
 */
export class PlanDashboardStore implements PlanDashboardSource {
  planId: string | null = null;
  dashboard: PlanDashboard | null = null;
  loading = false;
  error: PlanDashboardError | null = null;
  unplannedExpenses: UnplannedList = EMPTY_LIST;
  unplannedIncome: UnplannedList = EMPTY_LIST;

  private readonly plans: PlanDashboardPlans;
  private readonly catalogue: PlanDashboardReference;
  /** What the last load read; a poll maps its one dashboard answer with it. */
  private reference: DashboardReference | null = null;
  /** Bumped by every load and by sign-out: an answer of an older one is dropped. */
  private token = 0;
  private polling = false;

  constructor(plans: PlanDashboardPlans, reference: PlanDashboardReference) {
    this.plans = plans;
    this.catalogue = reference;
    makeAutoObservable<
      PlanDashboardStore,
      'plans' | 'catalogue' | 'reference' | 'token' | 'polling'
    >(this, {
      plans: false,
      catalogue: false,
      reference: false,
      token: false,
      polling: false,
    });
  }

  /** Safe to spend, pace and forecast of the shown dashboard (core maths); null until loaded. */
  get overview(): DashboardOverview | null {
    return this.dashboard === null ? null : toDashboardOverview(this.dashboard);
  }

  async load(planId: string): Promise<void> {
    this.token += 1;
    const token = this.token;
    this.polling = false;
    if (planId !== this.planId) {
      this.planId = planId;
      this.reference = null;
      this.dashboard = null;
      this.unplannedExpenses = EMPTY_LIST;
      this.unplannedIncome = EMPTY_LIST;
    }
    this.loading = true;
    this.error = null;
    try {
      const [reference, dto] = await Promise.all([
        this.readReference(planId),
        this.plans.dashboard(planId),
      ]);
      if (this.token !== token) {
        // A newer load or the end of the session took over: start nothing for this one.
        return;
      }
      this.reference = reference;
      this.applyDashboard(planId, token, toPlanDashboard(dto, reference));
      await Promise.all([this.loadUnplanned('expense', null), this.loadUnplanned('income', null)]);
    } catch (err) {
      this.applyError(planId, token, classifyDashboardError(err));
    }
  }

  /**
   * One request: the dashboard of the shown plan. Skipped while a load or another poll is in
   * flight and for a plan that is not shown; a failed poll keeps the shown data. Before the first
   * dashboard has arrived it is a full load.
   */
  async poll(planId: string): Promise<void> {
    if (planId !== this.planId || this.loading || this.polling) {
      return;
    }
    const reference = this.reference;
    if (this.dashboard === null || reference === null) {
      await this.load(planId);

      return;
    }
    const token = this.token;
    this.polling = true;
    try {
      this.applyDashboard(
        planId,
        token,
        toPlanDashboard(await this.plans.dashboard(planId), reference),
      );
    } catch {
      // The shown data stays; the next poll tries again.
    } finally {
      if (token === this.token) {
        this.polling = false;
      }
    }
  }

  /**
   * Sign-out or session end: the shown dashboard goes; a late answer is dropped
   * because it no longer matches `planId`.
   */
  resetSession(): void {
    this.token += 1;
    this.polling = false;
    this.reference = null;
    this.planId = null;
    this.dashboard = null;
    this.loading = false;
    this.error = null;
    this.unplannedExpenses = EMPTY_LIST;
    this.unplannedIncome = EMPTY_LIST;
  }

  async loadMoreUnplanned(direction: LineDirection): Promise<void> {
    const list = this.unplannedOf(direction);
    // A failed page is read again; otherwise only while there is a next page.
    if (list.loading || (list.nextCursor === null && !list.failed)) {
      return;
    }

    await this.loadUnplanned(direction, list.nextCursor);
  }

  unplannedOf(direction: LineDirection): UnplannedList {
    return direction === 'expense' ? this.unplannedExpenses : this.unplannedIncome;
  }

  private async loadUnplanned(direction: LineDirection, cursor: string | null): Promise<void> {
    const planId = this.planId;
    if (planId === null) {
      return;
    }
    const token = this.token;
    const before = this.unplannedOf(direction);
    this.setUnplanned(direction, { ...before, loading: true, failed: false });
    try {
      const page = await this.plans.unplanned(planId, direction, cursor);
      this.applyUnplanned(
        planId,
        token,
        direction,
        appendPage(cursor === null ? EMPTY_LIST : before, page),
      );
    } catch {
      this.applyUnplanned(planId, token, direction, { ...before, loading: false, failed: true });
    }
  }

  /** Plan, category names and items, from the shared catalogue; only a load reads them. */
  private async readReference(planId: string): Promise<DashboardReference> {
    const [plan, categoryNames, items] = await Promise.all([
      this.catalogue.plan(planId),
      this.catalogue.categoryNames(),
      this.listItems(planId),
    ]);

    return { plan, categoryNames, items };
  }

  private applyDashboard(planId: string, token: number, dashboard: PlanDashboard): void {
    if (this.planId !== planId || this.token !== token) {
      return;
    }
    this.dashboard = dashboard;
    this.loading = false;
  }

  private applyError(planId: string, token: number, error: PlanDashboardError): void {
    if (this.planId !== planId || this.token !== token) {
      return;
    }
    this.error = error;
    this.loading = false;
  }

  /** A late answer for a plan that is no longer shown is dropped. */
  private applyUnplanned(
    planId: string,
    token: number,
    direction: LineDirection,
    list: UnplannedList,
  ): void {
    if (this.planId === planId && this.token === token) {
      this.setUnplanned(direction, list);
    }
  }

  private setUnplanned(direction: LineDirection, list: UnplannedList): void {
    if (direction === 'expense') {
      this.unplannedExpenses = list;
    } else {
      this.unplannedIncome = list;
    }
  }

  /** Without items the lines show only base-currency amounts. */
  private async listItems(planId: string): Promise<PlannedItemDto[]> {
    try {
      return await this.catalogue.items(planId);
    } catch {
      return [];
    }
  }
}

function appendPage(list: UnplannedList, page: UnplannedTransactionPageDto): UnplannedList {
  return {
    items: [...list.items, ...page.items.map(toUnplannedTransaction)],
    nextCursor: page.nextCursor,
    loading: false,
    failed: false,
  };
}

function classifyDashboardError(err: unknown): PlanDashboardError {
  const { status, code } = readApiError(err);
  if (code === FX_RATE_UNAVAILABLE) {
    return 'fx_unavailable';
  }
  if (status === 404) {
    return 'not_found';
  }

  return 'failed';
}
