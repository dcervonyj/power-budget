import type { CategoryId, HouseholdId, UserId } from '@power-budget/core';
import type {
  Category,
  NewCategory,
  CategoryPatch,
  CategoryPrivacy,
  CategoryPrivacyLevel,
} from './entities.js';

export interface HouseholdScope {
  readonly householdId: HouseholdId;
}

export interface CategoryListOptions {
  readonly includeArchived: boolean;
}

export interface CategoryRepository {
  /** System (seeded, household_id NULL) categories plus the household's own. */
  list(scope: HouseholdScope, options: CategoryListOptions): Promise<Category[]>;
  /** A system category or one of the household's own; null otherwise. */
  findById(id: CategoryId, scope: HouseholdScope): Promise<Category | null>;
  /** Throws CATEGORY_DUPLICATE when an active category of the household has the name. */
  create(input: NewCategory): Promise<Category>;
  /** Household-owned categories only. Throws CATEGORY_NOT_FOUND / CATEGORY_DUPLICATE. */
  update(id: CategoryId, patch: CategoryPatch, scope: HouseholdScope): Promise<Category>;
  /** `null` restores an archived category. Household-owned categories only. */
  setArchivedAt(id: CategoryId, at: Date | null, scope: HouseholdScope): Promise<void>;
}

export interface CategoryPrivacyRepository {
  listByHousehold(scope: HouseholdScope): Promise<CategoryPrivacy[]>;
  set(
    categoryId: CategoryId,
    level: CategoryPrivacyLevel,
    by: UserId,
    scope: HouseholdScope,
  ): Promise<void>;
}
