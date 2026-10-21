import type { HttpClient } from '@power-budget/shared-app';
import type { components } from '@power-budget/shared-app/contract';

type CategoryDto = components['schemas']['CategoryDto'];

/**
 * categoryId -> name from GET /categories. Plan items and dashboard lines carry
 * only the category id; screens still render (with ids) when this fails.
 */
export async function fetchCategoryNames(http: HttpClient): Promise<Map<string, string>> {
  try {
    const res = await http.get<CategoryDto[]>('/categories');

    return new Map(res.data.map((c) => [c.id, c.name]));
  } catch {
    return new Map();
  }
}
