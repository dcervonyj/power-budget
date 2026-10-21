import type { HttpClient } from '@power-budget/shared-app';

interface CategorySummary {
  id: string;
  name: string;
}

/**
 * categoryId -> name from GET /categories. Plan items and dashboard lines carry
 * only the category id; screens still render (with ids) when this fails.
 */
export async function fetchCategoryNames(http: HttpClient): Promise<Map<string, string>> {
  try {
    const res = await http.get<CategorySummary[]>('/categories');

    return new Map(res.data.map((c) => [c.id, c.name]));
  } catch {
    return new Map();
  }
}
