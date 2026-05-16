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
} from '@power-budget/core';
import type { PlanActualsView } from '@power-budget/core';
import type {
  Plan,
  NewPlan,
  PlannedItem,
  NewPlannedItem,
  PlannedItemPatch,
  PlannedItemVersion,
  NewPlannedItemVersion,
} from './entities.js';

export interface HouseholdScope {
  readonly householdId: HouseholdId;
}

export interface PlanRepository {
  create(plan: NewPlan): Promise<Plan>;
  findById(id: PlanId, scope: HouseholdScope): Promise<Plan | null>;
  listActive(query: { userId: UserId; householdId: HouseholdId; date: Date }): Promise<Plan[]>;
  update(id: PlanId, patch: { readonly name?: string }, scope: HouseholdScope): Promise<Plan>;
  archive(id: PlanId, at: Date): Promise<void>;
}

export interface PlannedItemRepository {
  add(item: NewPlannedItem): Promise<PlannedItem>;
  update(
    id: PlannedItemId,
    patch: PlannedItemPatch,
    changedBy: UserId,
    reason?: string,
  ): Promise<PlannedItem>;
  remove(id: PlannedItemId): Promise<void>;
  listByPlan(planId: PlanId): Promise<PlannedItem[]>;
}

export interface PlannedItemVersionRepository {
  append(version: NewPlannedItemVersion): Promise<void>;
  listByItem(itemId: PlannedItemId): Promise<PlannedItemVersion[]>;
}

export interface PlanActualsReader {
  read(planId: PlanId, asOf: Date): Promise<PlanActualsView>;
}

export interface LeftoverSnapshotRepository {
  save(snapshot: {
    readonly id: LeftoverSnapshotId;
    readonly planId: PlanId;
    readonly householdId: HouseholdId;
    readonly closedAt: IsoDateTime;
    readonly entries: LeftoverEntry[];
  }): Promise<void>;
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
  readonly periodStart: IsoDate;
  readonly periodEnd: IsoDate;
  readonly direction: 'income' | 'expense';
  readonly cursor?: string;
  readonly limit?: number;
}

export interface UnplannedTransactionReader {
  list(query: UnplannedTransactionQuery): Promise<UnplannedTransactionPage>;
}

// ─── Household dashboard ──────────────────────────────────────────────────────

export interface HouseholdDashboardData {
  readonly categories: CategoryAggregate[];
}

export interface HouseholdDashboardReader {
  read(params: {
    readonly householdId: HouseholdId;
    readonly planId: PlanId;
    readonly periodStart: IsoDate;
    readonly periodEnd: IsoDate;
    readonly viewerUserId: UserId;
  }): Promise<HouseholdDashboardData>;
}
