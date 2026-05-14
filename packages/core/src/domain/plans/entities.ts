import type { PlanId, PlannedItemId, PlannedItemVersionId, LeftoverSnapshotId } from './ids.js';
import type { PlanType, PlanPeriodKind, PlannedDirection } from './enums.js';
import type { PlanPeriod } from './period.js';
import type { HouseholdId, UserId } from '../auth/ids.js';
import type { CategoryId } from '../categories/ids.js';
import type { Money } from '../shared/money.js';
import type { CurrencyCode } from '../shared/currency.js';
import type { IsoDate, IsoDateTime } from '../shared/ids.js';

export interface Plan {
  readonly id: PlanId;
  readonly householdId: HouseholdId;
  readonly name: string;
  readonly type: PlanType;
  readonly periodKind: PlanPeriodKind;
  readonly period: PlanPeriod;
  readonly baseCurrency: CurrencyCode;
  readonly createdByUserId: UserId;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
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

export interface PlannedItemVersion {
  readonly id: PlannedItemVersionId;
  readonly plannedItemId: PlannedItemId;
  readonly amount: Money;
  readonly note: string | null;
  readonly editedByUserId: UserId;
  readonly editedAt: IsoDateTime;
}

/** Derived (never stored): unspent planned expense at period end. */
export interface LeftoverEntry {
  readonly snapshotId: LeftoverSnapshotId;
  readonly planId: PlanId;
  readonly plannedItemId: PlannedItemId;
  readonly categoryId: CategoryId;
  readonly plannedAmount: Money;
  readonly actualAmount: Money;
  readonly leftover: Money;
  readonly asOf: IsoDate;
}
