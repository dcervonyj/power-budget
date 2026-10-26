import { makeAutoObservable } from 'mobx';
import { readApiError, type CategoriesApi, type PlansApi } from '@power-budget/shared-app';
import {
  FX_RATE_UNAVAILABLE,
  type CategoryDto,
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
import { toDashboardOverview, type DashboardOverview } from './dashboardOverview.js';

/** 404 is `not_found`; 503 fx_rate_unavailable (CLN-012) is `fx_unavailable`. */
export type PlanDashboardError = 'not_found' | 'fx_unavailable' | 'failed';

/** What the store reads from the plan and category endpoints. */
export type PlanDashboardPlans = Pick<PlansApi, 'get' | 'dashboard' | 'listItems' | 'unplanned'>;
export type PlanDashboardCategories = Pick<CategoriesApi, 'list'>;

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
 */
export class PlanDashboardStore implements PlanDashboardSource {
  planId: string | null = null;
  dashboard: PlanDashboard | null = null;
  loading = false;
  error: PlanDashboardError | null = null;
  unplannedExpenses: UnplannedList = EMPTY_LIST;
  unplannedIncome: UnplannedList = EMPTY_LIST;

  private readonly plans: PlanDashboardPlans;
  private readonly categories: PlanDashboardCategories;

  constructor(plans: PlanDashboardPlans, categories: PlanDashboardCategories) {
    this.plans = plans;
    this.categories = categories;
    makeAutoObservable<PlanDashboardStore, 'plans' | 'categories'>(this, {
      plans: false,
      categories: false,
    });
  }

  /** Safe to spend, pace and forecast of the shown dashboard (core maths); null until loaded. */
  get overview(): DashboardOverview | null {
    return this.dashboard === null ? null : toDashboardOverview(this.dashboard);
  }

  async load(planId: string): Promise<void> {
    if (planId !== this.planId) {
      this.planId = planId;
      this.dashboard = null;
      this.unplannedExpenses = EMPTY_LIST;
      this.unplannedIncome = EMPTY_LIST;
    }
    this.loading = true;
    this.error = null;
    try {
      const [plan, dto, categories, items] = await Promise.all([
        this.plans.get(planId),
        this.plans.dashboard(planId),
        this.listCategories(),
        this.listItems(planId),
      ]);
      this.applyDashboard(
        planId,
        toPlanDashboard(dto, { plan, categoryNames: toCategoryNames(categories), items }),
      );
      await Promise.all([this.loadUnplanned('expense', null), this.loadUnplanned('income', null)]);
    } catch (err) {
      this.applyError(planId, classifyDashboardError(err));
    }
  }

  /**
   * Sign-out or session end: the shown dashboard goes; a late answer is dropped
   * because it no longer matches `planId`.
   */
  resetSession(): void {
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
    const before = this.unplannedOf(direction);
    this.setUnplanned(direction, { ...before, loading: true, failed: false });
    try {
      const page = await this.plans.unplanned(planId, direction, cursor);
      this.applyUnplanned(
        planId,
        direction,
        appendPage(cursor === null ? EMPTY_LIST : before, page),
      );
    } catch {
      this.applyUnplanned(planId, direction, { ...before, loading: false, failed: true });
    }
  }

  private applyDashboard(planId: string, dashboard: PlanDashboard): void {
    if (this.planId !== planId) {
      return;
    }
    this.dashboard = dashboard;
    this.loading = false;
  }

  private applyError(planId: string, error: PlanDashboardError): void {
    if (this.planId !== planId) {
      return;
    }
    this.error = error;
    this.loading = false;
  }

  /** A late answer for a plan that is no longer shown is dropped. */
  private applyUnplanned(planId: string, direction: LineDirection, list: UnplannedList): void {
    if (this.planId === planId) {
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

  /** Without categories the dashboard still renders, without names. */
  private async listCategories(): Promise<CategoryDto[]> {
    try {
      return await this.categories.list({ includeArchived: true });
    } catch {
      return [];
    }
  }

  /** Without items the lines show only base-currency amounts. */
  private async listItems(planId: string): Promise<PlannedItemDto[]> {
    try {
      return await this.plans.listItems(planId);
    } catch {
      return [];
    }
  }
}

function toCategoryNames(categories: readonly CategoryDto[]): Map<string, string> {
  return new Map(categories.map(toNameEntry));
}

function toNameEntry(category: CategoryDto): [string, string] {
  return [category.id, category.name];
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
