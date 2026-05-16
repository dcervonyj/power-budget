import type {
  PlanId,
  PlannedItemId,
  PlannedItemVersionId,
  LeftoverSnapshotId,
  HouseholdId,
  UserId,
  CategoryId,
  Money,
  IsoDate,
  IsoDateTime,
} from '@power-budget/core';

export type PlanType = 'personal' | 'household';
export type PlanPeriodKind = 'weekly' | 'monthly' | 'custom';
export type PlannedDirection = 'income' | 'expense';

export interface PlanPeriod {
  readonly start: IsoDate;
  readonly end: IsoDate;
}

export interface Plan {
  readonly id: PlanId;
  readonly householdId: HouseholdId;
  readonly ownerUserId: UserId | null; // set only for type=personal
  readonly name: string;
  readonly type: PlanType;
  readonly periodKind: PlanPeriodKind;
  readonly period: PlanPeriod;
  readonly baseCurrency: string;
  readonly archivedAt: IsoDateTime | null;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface NewPlan {
  readonly id: PlanId;
  readonly householdId: HouseholdId;
  readonly ownerUserId: UserId | null;
  readonly name: string;
  readonly type: PlanType;
  readonly periodKind: PlanPeriodKind;
  readonly period: PlanPeriod;
  readonly baseCurrency: string;
}

export interface PlannedItem {
  readonly id: PlannedItemId;
  readonly planId: PlanId;
  readonly householdId: HouseholdId;
  readonly categoryId: CategoryId;
  readonly direction: PlannedDirection;
  readonly amount: Money;
  readonly note: string | null;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export interface NewPlannedItem {
  readonly id: PlannedItemId;
  readonly planId: PlanId;
  readonly householdId: HouseholdId;
  readonly categoryId: CategoryId;
  readonly direction: PlannedDirection;
  readonly amount: Money;
  readonly note?: string | null;
}

export interface PlannedItemPatch {
  readonly amount?: Money;
  readonly note?: string | null;
}

export interface PlannedItemVersion {
  readonly id: PlannedItemVersionId;
  readonly plannedItemId: PlannedItemId;
  readonly householdId: HouseholdId;
  readonly before: Partial<PlannedItemPatch> | null;
  readonly after: PlannedItemPatch;
  readonly changedBy: UserId;
  readonly changedAt: IsoDateTime;
  readonly reason: string | null;
}

export interface NewPlannedItemVersion {
  readonly id: PlannedItemVersionId;
  readonly plannedItemId: PlannedItemId;
  readonly householdId: HouseholdId;
  readonly before: Partial<PlannedItemPatch> | null;
  readonly after: PlannedItemPatch;
  readonly changedBy: UserId;
  readonly reason?: string | null;
}

export interface LeftoverSnapshot {
  readonly id: LeftoverSnapshotId;
  readonly householdId: HouseholdId;
  readonly planId: PlanId | null;
  readonly periodEnd: IsoDate;
  readonly amountMinor: bigint;
  readonly currency: string;
  readonly computedAt: IsoDateTime;
}
