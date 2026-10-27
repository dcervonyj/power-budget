import type {
  PlanId,
  PlannedItemId,
  UserId,
  HouseholdId,
  IsoDateTime,
  IsoDate,
  LeftoverSnapshotId,
  LeftoverEntry,
  TransactionId,
  BankAccountId,
  CategoryAggregate,
  Money,
} from '@power-budget/core';
import type { PlanActualsView, Transaction, Mapping, Transfer } from '@power-budget/core';
import type {
  Plan,
  NewPlan,
  PlannedItem,
  NewPlannedItem,
  PlannedItemPatch,
  PlannedItemVersion,
  PlanPeriod,
  NewPlannedItemVersion,
} from './entities.js';

export interface HouseholdScope {
  readonly householdId: HouseholdId;
}

/** `active`: not archived; `archived`: archived only; `all`: both. */
export type PlanStatusFilter = 'active' | 'archived' | 'all';

export interface PlanListQuery {
  readonly householdId: HouseholdId;
  /** Household plans plus this user's own personal plans (a partner's personal plans stay hidden). */
  readonly viewerUserId: UserId;
  readonly status: PlanStatusFilter;
  /** When set, only plans whose period overlaps this one. */
  readonly overlapping?: PlanPeriod;
}

export interface PlanPatch {
  readonly name?: string;
  readonly period?: PlanPeriod;
  readonly baseCurrency?: string;
}

export interface PlanRepository {
  create(plan: NewPlan): Promise<Plan>;
  findById(id: PlanId, scope: HouseholdScope): Promise<Plan | null>;
  list(query: PlanListQuery): Promise<Plan[]>;
  update(id: PlanId, patch: PlanPatch, scope: HouseholdScope): Promise<Plan>;
  archive(id: PlanId, at: Date, scope: HouseholdScope): Promise<void>;
  /**
   * System-level query — no HouseholdScope needed. Returns the non-archived plans whose period
   * ended before `day` and that have no leftover snapshot yet, so a missed run is caught up.
   */
  findDueForClose(day: IsoDate): Promise<Plan[]>;
}

export interface PlannedItemRepository {
  add(item: NewPlannedItem): Promise<PlannedItem>;
  findById(id: PlannedItemId, scope: HouseholdScope): Promise<PlannedItem | null>;
  /** Updates the item and appends a PlannedItemVersion (before/after) in one transaction. */
  update(
    id: PlannedItemId,
    patch: PlannedItemPatch,
    changedBy: UserId,
    scope: HouseholdScope,
    reason?: string,
  ): Promise<PlannedItem>;
  /** Deletes the item, its versions and its transaction mappings (the transactions become unplanned). */
  remove(id: PlannedItemId, scope: HouseholdScope): Promise<void>;
  listByPlan(planId: PlanId, scope: HouseholdScope): Promise<PlannedItem[]>;
}

export interface PlannedItemVersionRepository {
  append(version: NewPlannedItemVersion): Promise<void>;
  listByItem(itemId: PlannedItemId, scope: HouseholdScope): Promise<PlannedItemVersion[]>;
}

/** The plan dashboard numbers (core computePlanActuals) of a plan the caller may see. */
export interface PlanActualsReader {
  read(plan: Plan, asOf: Date): Promise<PlanActualsView>;
}

export interface PlanActivityQuery {
  readonly householdId: HouseholdId;
  /** Inclusive range on the booking date. */
  readonly period: PlanPeriod;
}

/** Household transactions of a period with what the core functions need to count them. */
export interface PlanActivity {
  readonly transactions: readonly Transaction[];
  /** Transaction → the user who owns its account. */
  readonly owners: ReadonlyMap<TransactionId, UserId>;
  readonly mappings: readonly Mapping[];
  /** Transfers with at least one leg among `transactions`. */
  readonly transfers: readonly Transfer[];
}

export interface PlanActivityReader {
  read(query: PlanActivityQuery): Promise<PlanActivity>;
}

export interface NewLeftoverSnapshot {
  readonly id: LeftoverSnapshotId;
  readonly planId: PlanId;
  readonly householdId: HouseholdId;
  /** The plan's own period end, not the day the close job ran. */
  readonly periodEnd: IsoDate;
  readonly closedAt: IsoDateTime;
  /** Sum of the unspent planned expense, in the plan's base currency. */
  readonly leftover: Money;
  readonly entries: readonly LeftoverEntry[];
}

export interface LeftoverSnapshotRepository {
  /** Idempotent: one snapshot per (household, plan, period end). */
  save(snapshot: NewLeftoverSnapshot): Promise<void>;
}

export interface AuditLogPort {
  record(event: {
    readonly householdId: HouseholdId;
    readonly actorUserId: UserId;
    readonly action: string;
    readonly subjectType: string;
    readonly subjectId: string;
  }): Promise<void>;
}

// ─── Unplanned transactions ───────────────────────────────────────────────────

export interface UnplannedTransactionItem {
  readonly id: TransactionId;
  readonly description: string;
  readonly amountMinor: bigint;
  readonly currency: string;
  readonly occurredOn: IsoDate;
  readonly accountId: BankAccountId;
  readonly source: string;
}

export interface UnplannedTransactionPage {
  readonly items: UnplannedTransactionItem[];
  readonly nextCursor: string | null;
}

export interface UnplannedTransactionQuery {
  readonly householdId: HouseholdId;
  /** Only this user's own transactions are listed (accounts are private to their owner). */
  readonly ownerUserId: UserId;
  readonly periodStart: IsoDate;
  readonly periodEnd: IsoDate;
  readonly direction: 'income' | 'expense';
  readonly cursor?: string;
  /** Already clamped by the use case. */
  readonly limit: number;
}

export interface UnplannedTransactionReader {
  list(query: UnplannedTransactionQuery): Promise<UnplannedTransactionPage>;
}

// ─── Household dashboard ──────────────────────────────────────────────────────

export interface HouseholdDashboardData {
  readonly categories: CategoryAggregate[];
}
