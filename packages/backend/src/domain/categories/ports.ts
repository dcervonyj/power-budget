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

export interface CategoryRepo {
  list(scope: HouseholdScope): Promise<Category[]>;
  create(input: NewCategory): Promise<Category>;
  update(id: CategoryId, patch: CategoryPatch): Promise<Category>;
  archive(id: CategoryId, at: Date): Promise<void>;
}

export interface CategoryPrivacyRepo {
  get(categoryId: CategoryId): Promise<CategoryPrivacy | null>;
  set(categoryId: CategoryId, level: CategoryPrivacyLevel, by: UserId): Promise<void>;
}
