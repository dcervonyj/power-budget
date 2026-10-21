import { CategoriesApi, type HttpClient } from '@power-budget/shared-app';

/**
 * categoryId -> name from GET /categories (archived ones included, since plan items
 * can still point at them). Plan items and dashboard lines carry only the category
 * id; screens still render (with ids) when this fails.
 */
export async function fetchCategoryNames(http: HttpClient): Promise<Map<string, string>> {
  try {
    const categories = await new CategoriesApi(http).list({ includeArchived: true });

    return new Map(categories.map((c) => [c.id, c.name]));
  } catch {
    return new Map();
  }
}
