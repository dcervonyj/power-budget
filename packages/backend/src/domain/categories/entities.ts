import type { CategoryId, HouseholdId, UserId, IsoDateTime } from '@power-budget/core';

export type CategoryPrivacyLevel = 'full_detail' | 'total_with_counts' | 'total_only';
export type CategoryKind = 'income' | 'expense';

export interface Category {
  readonly id: CategoryId;
  readonly householdId: HouseholdId | null; // null for system/seed categories
  readonly seedKey: string | null; // stable key for seeded categories
  readonly name: string;
  readonly icon: string;
  readonly color: string;
  readonly kind: CategoryKind;
  readonly archivedAt: IsoDateTime | null;
  readonly createdAt: IsoDateTime;
}

export interface NewCategory {
  readonly id: CategoryId;
  readonly householdId: HouseholdId;
  readonly name: string;
  readonly icon: string;
  readonly color: string;
  readonly kind: CategoryKind;
}

export interface CategoryPatch {
  readonly name?: string;
  readonly icon?: string;
  readonly color?: string;
}

export interface CategoryPrivacy {
  readonly categoryId: CategoryId;
  readonly householdId: HouseholdId;
  readonly level: CategoryPrivacyLevel;
  readonly updatedBy: UserId;
  readonly updatedAt: IsoDateTime;
}

/** What the partner sees of a category nobody configured: total only (PRODUCT §4.9). */
export const DEFAULT_CATEGORY_PRIVACY: CategoryPrivacyLevel = 'total_only';

/** A category with the household's privacy level for it. */
export interface CategoryView extends Category {
  readonly privacy: CategoryPrivacyLevel;
}

export const CategoryRules = {
  /** Seeded system categories are shared by every household and cannot be changed. */
  isSystem(category: Category): boolean {
    return category.householdId === null;
  },

  sameName(a: string, b: string): boolean {
    return a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();
  },
};
