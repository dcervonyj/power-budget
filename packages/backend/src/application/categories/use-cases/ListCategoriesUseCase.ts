import type { HouseholdId } from '@power-budget/core';
import type { CategoryView } from '../../../domain/categories/entities.js';
import type {
  CategoryPrivacyRepository,
  CategoryRepository,
} from '../../../domain/categories/ports.js';
import { toCategoryViews } from '../category-views.js';

export interface ListCategoriesInput {
  readonly householdId: HouseholdId;
  readonly includeArchived: boolean;
}

export class ListCategoriesUseCase {
  constructor(
    private readonly categoryRepo: CategoryRepository,
    private readonly privacyRepo: CategoryPrivacyRepository,
  ) {}

  async execute(input: ListCategoriesInput): Promise<CategoryView[]> {
    const scope = { householdId: input.householdId };
    const [categories, privacy] = await Promise.all([
      this.categoryRepo.list(scope, { includeArchived: input.includeArchived }),
      this.privacyRepo.listByHousehold(scope),
    ]);

    return toCategoryViews(categories, privacy);
  }
}
