import type { CategoryId, CategoryPrivacyId } from './ids.js';
import type { CategoryPrivacyLevel } from './enums.js';
import type { HouseholdId, UserId } from '../auth/ids.js';
import type { IsoDateTime } from '../shared/ids.js';

export type CategoryKind = 'income' | 'expense';

export interface Category {
  readonly id: CategoryId;
  readonly householdId: HouseholdId | null;
  readonly name: string;
  readonly kind: CategoryKind;
  readonly sortOrder: number;
  readonly isSystem: boolean;
  readonly createdAt: IsoDateTime;
}

export interface CategoryPrivacy {
  readonly id: CategoryPrivacyId;
  readonly categoryId: CategoryId;
  readonly householdId: HouseholdId;
  readonly userId: UserId;
  readonly level: CategoryPrivacyLevel;
  readonly updatedAt: IsoDateTime;
}
