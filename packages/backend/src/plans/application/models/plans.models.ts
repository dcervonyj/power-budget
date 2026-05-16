import type {
  PlanId,
  PlannedItemId,
  CategoryId,
  UserId,
  HouseholdId,
  Money,
  IsoDate,
  IsoDateTime,
} from '@power-budget/core';
import type { PlannedDirection, PlanType, PlanPeriodKind, PlannedItemPatch } from '../../domain/entities.js';

export interface AddPlannedItemInput {
  readonly planId: PlanId;
  readonly categoryId: CategoryId;
  readonly direction: PlannedDirection;
  readonly amount: Money;
  readonly note?: string | null;
  readonly userId: UserId;
  readonly householdId: HouseholdId;
}

export interface ArchivePlanInput {
  readonly planId: PlanId;
  readonly userId: UserId;
  readonly householdId: HouseholdId;
}

export interface ClonePlanFromPreviousInput {
  readonly sourcePlanId: PlanId;
  readonly name?: string;
  readonly periodStart?: IsoDate;
  readonly periodEnd?: IsoDate;
  readonly householdId: HouseholdId;
  readonly userId: UserId;
}

export interface ClosePeriodSnapshotInput {
  readonly planId: PlanId;
  readonly householdId: HouseholdId;
  readonly closedAt: IsoDateTime;
}

export interface CreatePlanInput {
  readonly name: string;
  readonly type: PlanType;
  readonly periodKind: PlanPeriodKind;
  readonly periodStart: IsoDate;
  readonly periodEnd: IsoDate;
  readonly baseCurrency: string;
  readonly userId: UserId;
  readonly householdId: HouseholdId;
}

export interface GetPlanDashboardInput {
  readonly planId: PlanId;
  readonly householdId: HouseholdId;
  readonly asOf: Date;
}

export interface GetPlannedItemHistoryInput {
  readonly itemId: PlannedItemId;
}

export interface GetUnplannedTransactionsInput {
  readonly planId: PlanId;
  readonly householdId: HouseholdId;
  readonly direction: 'income' | 'expense';
  readonly cursor?: string;
  readonly limit?: number;
}

export interface ListActivePlansInput {
  readonly userId: UserId;
  readonly householdId: HouseholdId;
  readonly date: Date;
}

export interface PeriodCloseResult {
  readonly plansProcessed: number;
}

export interface RemovePlannedItemInput {
  readonly planId: PlanId;
  readonly itemId: PlannedItemId;
  readonly householdId: HouseholdId;
}

export interface UpdatePlanInput {
  readonly planId: PlanId;
  readonly patch: { readonly name?: string };
  readonly userId: UserId;
  readonly householdId: HouseholdId;
}

export interface UpdatePlannedItemInput {
  readonly planId: PlanId;
  readonly itemId: PlannedItemId;
  readonly patch: PlannedItemPatch;
  readonly reason?: string;
  readonly userId: UserId;
  readonly householdId: HouseholdId;
}
