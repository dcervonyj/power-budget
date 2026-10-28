import { makeAutoObservable } from 'mobx';
import { readApiError, type PlansApi } from '@power-budget/shared-app';
import {
  FX_RATE_UNAVAILABLE,
  type PlanDashboardResponseDto,
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
import { toCategoryNames, type ReferenceCatalogue } from '../catalogue/ReferenceCatalogue.js';
import { toDashboardOverview, type DashboardOverview } from './dashboardOverview.js';

/** 404 is `not_found`; 503 fx_rate_unavailable (CLN-012) is `fx_unavailable`. */
export type PlanDashboardError = 'not_found' | 'fx_unavailable' | 'failed';

/** What the store reads from the plan and category endpoints. */
export type PlanDashboardPlans = Pick<PlansApi, 'get' | 'dashboard' | 'listItems' | 'unplanned'>;
/** What the store needs from the shared catalogue: one plan, its items and the categories. */
interface DashboardReference {
  readonly plan: PlanDto;
  readonly categoryNames: Map<string, string>;
  readonly items: PlannedItemDto[];
}

/** A burst of local changes starts one reference refresh. */
const REFERENCE_DEBOUNCE_MS = 250;
/** A failed reference read is tried again after 1 s, 2 s, 4 s ... up to 30 s. */
const REFERENCE_RETRY_MS = 1000;
const MAX_REFERENCE_RETRY_MS = 30_000;
/** Ticks a failed full load waits before a tick tries it again: 1, 2, 4, 8, 8, ... */
const MAX_LOAD_BACKOFF_TICKS = 8;

export type PlanDashboardReference = Pick<
  ReferenceCatalogue,
  'plan' | 'items' | 'categories' | 'version' | 'subscribe'
>;

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
 * Two independent parts. The dashboard: `load` reads everything (open, plan switch, retry), `poll`
 * sends one dashboard request per tick and never loads. The reference data (plan, items, category
 * names from the shared catalogue): read by `load`; when a read failed, or the catalogue is
 * invalidated by a local change, a separate refresh (debounced, one at a time, own retry timer with
 * backoff) replaces the fallback. Ticks send no reference request. A tick retries a failed full
 * load (with backoff). The unplanned pages the user loaded stay as they are.
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
  /** What the last load or refresh read; the dashboard answers are mapped with it. */
  private reference: DashboardReference | null = null;
  /** The last dashboard answer, mapped again when a refresh brings better reference data. */
  private lastDto: PlanDashboardResponseDto | null = null;
  /** The catalogue version the reference data was read at. */
  private referenceVersion = 0;
  /** A part of the last read failed: the data holds fallbacks (no names, no original amounts). */
  private referenceDegraded = false;
  private refreshing = false;
  private referenceFailures = 0;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private loadFailures = 0;
  private loadSkipTicks = 0;
  /** Bumped by every load and by sign-out: an answer of an older one is dropped. */
  private token = 0;
  private polling = false;

  constructor(plans: PlanDashboardPlans, reference: PlanDashboardReference) {
    this.plans = plans;
    this.catalogue = reference;
    makeAutoObservable<
      PlanDashboardStore,
      | 'plans'
      | 'catalogue'
      | 'reference'
      | 'lastDto'
      | 'referenceVersion'
      | 'referenceDegraded'
      | 'refreshing'
      | 'referenceFailures'
      | 'refreshTimer'
      | 'loadFailures'
      | 'loadSkipTicks'
      | 'token'
      | 'polling'
    >(this, {
      plans: false,
      catalogue: false,
      reference: false,
      lastDto: false,
      referenceVersion: false,
      referenceDegraded: false,
      refreshing: false,
      referenceFailures: false,
      refreshTimer: false,
      loadFailures: false,
      loadSkipTicks: false,
      token: false,
      polling: false,
    });
    reference.subscribe(() => {
      this.onCatalogueChanged();
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
    this.refreshing = false;
    this.cancelRefreshTimer();
    if (planId !== this.planId) {
      this.loadFailures = 0;
      this.loadSkipTicks = 0;
      this.planId = planId;
      this.reference = null;
      this.lastDto = null;
      this.dashboard = null;
      this.unplannedExpenses = EMPTY_LIST;
      this.unplannedIncome = EMPTY_LIST;
    }
    this.loading = true;
    this.error = null;
    try {
      const [reference, dto] = await Promise.all([
        this.readReference(planId, true),
        this.plans.dashboard(planId),
      ]);
      if (this.token !== token) {
        // A newer load or the end of the session took over: start nothing for this one.
        return;
      }
      this.lastDto = dto;
      this.applyReference(reference);
      this.applyDashboard(planId, token, toPlanDashboard(dto, reference.data));
      this.loadFailures = 0;
      this.loadSkipTicks = 0;
      this.scheduleRefreshIfNeeded(planId, REFERENCE_RETRY_MS);
      await Promise.all([this.loadUnplanned('expense', null), this.loadUnplanned('income', null)]);
    } catch (err) {
      this.applyError(planId, token, classifyDashboardError(err));
    }
  }

  /**
   * One dashboard request while a dashboard is shown, and nothing else: reference data is never
   * read here. Skipped while a load or another poll is in flight and for a plan that is not shown;
   * a failed poll keeps the shown data. When the last load failed and nothing is shown, a tick
   * retries the full load after a backoff of 1, 2, 4, 8 ticks (one at a time).
   */
  async poll(planId: string): Promise<void> {
    if (planId !== this.planId || this.loading || this.polling) {
      return;
    }
    if (this.dashboard === null) {
      await this.retryFailedLoad(planId);

      return;
    }
    const token = this.token;
    this.polling = true;
    try {
      this.showPolled(planId, token, await this.plans.dashboard(planId));
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
    this.refreshing = false;
    this.cancelRefreshTimer();
    this.loadFailures = 0;
    this.loadSkipTicks = 0;
    this.reference = null;
    this.lastDto = null;
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

  /** A load needs the plan; missing categories or items only leave the fallbacks. */
  private async readReference(planId: string, tolerant: boolean): Promise<ReferenceRead> {
    const version = this.catalogue.version;
    const [plan, categories, items] = await Promise.all([
      this.catalogue.plan(planId),
      tolerant ? this.catalogue.categories().catch(failedRead) : this.catalogue.categories(),
      tolerant ? this.catalogue.items(planId).catch(failedRead) : this.catalogue.items(planId),
    ]);
    const degraded = categories === FAILED || items === FAILED;

    return {
      version,
      degraded,
      data: {
        plan,
        categoryNames: categories === FAILED ? new Map() : toCategoryNames(categories),
        items: items === FAILED ? [] : items,
      },
    };
  }

  private applyReference(read: ReferenceRead): void {
    this.reference = read.data;
    this.referenceVersion = read.version;
    this.referenceDegraded = read.degraded;
    this.referenceFailures = 0;
  }

  private showPolled(planId: string, token: number, dto: PlanDashboardResponseDto): void {
    const reference = this.reference;
    if (reference === null || this.planId !== planId || this.token !== token) {
      return;
    }
    this.lastDto = dto;
    this.applyDashboard(planId, token, toPlanDashboard(dto, reference));
  }

  private async retryFailedLoad(planId: string): Promise<void> {
    if (this.error === null) {
      return;
    }
    if (this.loadSkipTicks > 0) {
      this.loadSkipTicks -= 1;

      return;
    }
    await this.load(planId);
  }

  private onCatalogueChanged(): void {
    if (this.planId !== null && this.dashboard !== null) {
      this.scheduleRefresh(REFERENCE_DEBOUNCE_MS);
    }
  }

  private scheduleRefreshIfNeeded(planId: string, delayMs: number): void {
    if (planId === this.planId && this.referenceNeedsRefresh()) {
      this.scheduleRefresh(delayMs);
    }
  }

  private referenceNeedsRefresh(): boolean {
    return this.referenceDegraded || this.catalogue.version !== this.referenceVersion;
  }

  /** At most one timer and one refresh at a time; a later request waits for them. */
  private scheduleRefresh(delayMs: number): void {
    if (this.refreshTimer !== null || this.refreshing) {
      return;
    }
    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = null;
      this.startReferenceRefresh();
    }, delayMs);
  }

  private cancelRefreshTimer(): void {
    if (this.refreshTimer !== null) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  private startReferenceRefresh(): void {
    const planId = this.planId;
    if (planId === null || this.refreshing || !this.referenceNeedsRefresh()) {
      return;
    }
    this.refreshing = true;
    void this.refreshReference(planId, this.token);
  }

  /** Re-reads plan, items and categories strictly; a good answer replaces the fallback. */
  private async refreshReference(planId: string, token: number): Promise<void> {
    try {
      const read = await this.readReference(planId, false);
      if (this.planId !== planId || this.token !== token) {
        return;
      }
      this.applyReference(read);
      if (this.lastDto !== null) {
        this.applyDashboard(planId, token, toPlanDashboard(this.lastDto, read.data));
      }
    } catch {
      if (this.planId === planId && this.token === token) {
        this.referenceFailures += 1;
      }
    } finally {
      if (this.token === token) {
        this.refreshing = false;
        this.scheduleRefreshIfNeeded(planId, this.nextReferenceDelay());
      }
    }
  }

  /** Right after a local change again: debounce; after a failure: backoff. */
  private nextReferenceDelay(): number {
    if (this.referenceFailures === 0) {
      return REFERENCE_DEBOUNCE_MS;
    }

    return Math.min(REFERENCE_RETRY_MS * 2 ** (this.referenceFailures - 1), MAX_REFERENCE_RETRY_MS);
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
    this.loadFailures += 1;
    this.loadSkipTicks = Math.min(2 ** (this.loadFailures - 1), MAX_LOAD_BACKOFF_TICKS);
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
}

interface ReferenceRead {
  readonly version: number;
  readonly degraded: boolean;
  readonly data: DashboardReference;
}

const FAILED = Symbol('failed');

function failedRead(): typeof FAILED {
  return FAILED;
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
