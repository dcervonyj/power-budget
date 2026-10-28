import type { CategoriesApi, PlansApi } from '@power-budget/shared-app';
import type { CategoryDto, PlanDto, PlannedItemDto } from '@power-budget/shared-app/contract';

export type CataloguePlans = Pick<PlansApi, 'list' | 'get' | 'listItems'>;
export type CatalogueCategories = Pick<CategoriesApi, 'list'>;

const ACTIVE_PLANS_KEY = 'active-plans';
const CATEGORIES_KEY = 'categories';

/**
 * Reference data that rarely changes: the active plans, one plan, its items and the
 * categories. Each is read once and shared by the dashboard and the transaction modals
 * (audit PERF-06, PERF-24). A failed read is not kept, so the next call tries again.
 * A local mutation calls `invalidate()`; sign-out calls `resetSession()` (CLN-034).
 */
export class ReferenceCatalogue {
  private readonly plans: CataloguePlans;
  private readonly categoriesApi: CatalogueCategories;
  private cache = new Map<string, Promise<unknown>>();
  private changes = 0;
  private readonly listeners = new Set<() => void>();

  constructor(plans: CataloguePlans, categories: CatalogueCategories) {
    this.plans = plans;
    this.categoriesApi = categories;
  }

  activePlans(): Promise<PlanDto[]> {
    return this.cached(ACTIVE_PLANS_KEY, () => this.plans.list('active'));
  }

  plan(planId: string): Promise<PlanDto> {
    return this.cached(`plan:${planId}`, () => this.plans.get(planId));
  }

  items(planId: string): Promise<PlannedItemDto[]> {
    return this.cached(`items:${planId}`, () => this.plans.listItems(planId));
  }

  /** All categories, archived ones included: plan items can still point at them. */
  categories(): Promise<CategoryDto[]> {
    return this.cached(CATEGORIES_KEY, () => this.categoriesApi.list({ includeArchived: true }));
  }

  /** categoryId -> name; empty when the categories cannot be read (screens then show ids). */
  async categoryNames(): Promise<Map<string, string>> {
    try {
      return toCategoryNames(await this.categories());
    } catch {
      return new Map();
    }
  }

  /** A plan, an item or a category changed here: the next read goes to the API again. */
  invalidate(): void {
    this.cache = new Map();
    this.changes += 1;
    for (const listener of [...this.listeners]) {
      listener();
    }
  }

  /** Calls `listener` after every `invalidate()`; returns the way to stop. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Changes with every `invalidate()`: a holder of older data can tell it may be out of date. */
  get version(): number {
    return this.changes;
  }

  /** Sign-out or session end: nothing of the previous user's plans stays. */
  resetSession(): void {
    this.invalidate();
  }

  private cached<T>(key: string, read: () => Promise<T>): Promise<T> {
    const cache = this.cache;
    const hit = cache.get(key);
    if (hit !== undefined) {
      // The key fixes the type: every writer of a key stores the promise of the same read.
      return hit as Promise<T>;
    }
    const pending = read();
    cache.set(key, pending);
    // Only the cache this read started in forgets it; an invalidated one is already gone.
    pending.catch(() => {
      if (cache.get(key) === pending) {
        cache.delete(key);
      }
    });

    return pending;
  }
}

export function toCategoryNames(categories: readonly CategoryDto[]): Map<string, string> {
  return new Map(categories.map((c): [string, string] => [c.id, c.name]));
}
