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
// eslint-disable-next-line no-restricted-imports -- CLN-061 allow-list (temporary, see eslint.layers.js)
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
/** A failed full load is tried again after 2 s, 4 s, 8 s ... up to 60 s, by its own timer. */
const LOAD_RETRY_MS = 2000;
const MAX_LOAD_RETRY_MS = 60_000;

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
 * backoff) replaces the fallback. Ticks send no reference request. A failed full load is retried
 * by its own timer (backoff, paused while the tab is hidden), never by a tick. The unplanned pages the user loaded stay as they are.
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
  private loadRetryTimer: ReturnType<typeof setTimeout> | null = null;
  /** Bumped by every load and by sign-out: an answer of an older one is dropped. */
  private token = 0;
  private polling = false;
  /** Directions whose list the user paged past the first page: a poll leaves those alone. */
  private pagedDirections = new Set<LineDirection>();
  /** False after the dashboard was left: no timer may be started until the next load. */
  private active = true;

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
      | 'loadRetryTimer'
      | 'token'
      | 'polling'
      | 'pagedDirections'
      | 'active'
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
      loadRetryTimer: false,
      token: false,
      polling: false,
      pagedDirections: false,
      active: false,
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
    this.active = true;
    this.pagedDirections.clear();
    this.polling = false;
    this.refreshing = false;
    this.cancelRefreshTimer();
    this.cancelLoadRetry();
    if (planId !== this.planId) {
      this.loadFailures = 0;
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
      this.scheduleRefreshIfNeeded(planId, REFERENCE_RETRY_MS);
      await Promise.all([this.loadUnplanned('expense', null), this.loadUnplanned('income', null)]);
    } catch (err) {
      this.applyError(planId, token, classifyDashboardError(err));
    }
  }

  /**
   * One dashboard request while a dashboard is shown, plus the first unplanned page of a list the
   * user has not paged (so new and mapped transactions show up); reference data is never read here. Skipped while a load or another poll is in flight and for a plan that is not shown;
   * a failed poll keeps the shown data. With nothing shown (the load failed) it does nothing: the
   * load is retried by its own timer.
   */
  async poll(planId: string): Promise<void> {
    if (planId !== this.planId || this.loading || this.polling) {
      return;
    }
    if (this.dashboard === null) {
      return;
    }
    const token = this.token;
    this.polling = true;
    try {
      this.showPolled(planId, token, await this.plans.dashboard(planId));
      await Promise.all([
        this.reconcileUnplanned(planId, token, 'expense'),
        this.reconcileUnplanned(planId, token, 'income'),
      ]);
    } catch {
      // The shown data stays; the next poll tries again.
    } finally {
      if (token === this.token) {
        this.polling = false;
      }
    }
  }

  /** The dashboard is left: every timer goes and none starts until the next load. */
  stop(): void {
    this.active = false;
    this.cancelRefreshTimer();
    this.cancelLoadRetry();
  }

  /**
   * Sign-out or session end: the shown dashboard goes; a late answer is dropped
   * because it no longer matches `planId`.
   */
  resetSession(): void {
    this.token += 1;
    this.pagedDirections.clear();
    this.polling = false;
    this.refreshing = false;
    this.cancelRefreshTimer();
    this.cancelLoadRetry();
    this.loadFailures = 0;
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
    if (cursor !== null) {
      this.pagedDirections.add(direction);
    }
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

  /** A poll replaces the first page of a list that was never paged; a failure keeps the list. */
  private async reconcileUnplanned(
    planId: string,
    token: number,
    direction: LineDirection,
  ): Promise<void> {
    if (this.pagedDirections.has(direction) || this.unplannedOf(direction).loading) {
      return;
    }
    try {
      const page = await this.plans.unplanned(planId, direction, null);
      if (this.token === token && this.planId === planId && !this.pagedDirections.has(direction)) {
        this.setUnplanned(direction, appendPage(EMPTY_LIST, page));
      }
    } catch {
      // The listed transactions stay; the next poll tries again.
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

  /** After a failed load: the next try comes by timer, not by a poll tick. */
  private scheduleLoadRetry(planId: string): void {
    this.cancelLoadRetry();
    if (!this.active) {
      return;
    }
    const delay = Math.min(LOAD_RETRY_MS * 2 ** (this.loadFailures - 1), MAX_LOAD_RETRY_MS);
    this.loadRetryTimer = setTimeout(() => {
      this.loadRetryTimer = null;
      this.retryLoad(planId, delay);
    }, delay);
  }

  /** A hidden tab waits; a plan that is no longer shown or a load that works needs no retry. */
  private retryLoad(planId: string, delay: number): void {
    if (!this.active || planId !== this.planId || this.error === null || this.loading) {
      return;
    }
    if (document.visibilityState === 'hidden') {
      this.loadRetryTimer = setTimeout(() => {
        this.loadRetryTimer = null;
        this.retryLoad(planId, delay);
      }, delay);

      return;
    }
    void this.load(planId);
  }

  private cancelLoadRetry(): void {
    if (this.loadRetryTimer !== null) {
      clearTimeout(this.loadRetryTimer);
      this.loadRetryTimer = null;
    }
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
    if (!this.active || this.refreshTimer !== null || this.refreshing) {
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
    this.scheduleLoadRetry(planId);
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
