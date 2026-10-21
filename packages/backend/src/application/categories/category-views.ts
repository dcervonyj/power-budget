import type { CategoryId } from '@power-budget/core';
import type { Category, CategoryPrivacy, CategoryView } from '../../domain/categories/entities.js';
import { DEFAULT_CATEGORY_PRIVACY } from '../../domain/categories/entities.js';

/** Joins categories with the household's privacy rows (default `full_detail`). */
export function toCategoryViews(
  categories: readonly Category[],
  privacy: readonly CategoryPrivacy[],
): CategoryView[] {
  const levels = new Map<CategoryId, CategoryPrivacy['level']>();
  for (const row of privacy) {
    levels.set(row.categoryId, row.level);
  }

  return categories.map((category) => ({
    ...category,
    privacy: levels.get(category.id) ?? DEFAULT_CATEGORY_PRIVACY,
  }));
}
