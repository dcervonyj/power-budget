import { makeAutoObservable, runInAction } from 'mobx';
import { apiClient } from '../../AppProviders.js';
import type { CategoryAggregate } from '../../domain/household/CategoryAggregate.js';

export class HouseholdCategoryStore {
  aggregate: CategoryAggregate | null = null;
  loading = false;
  error: string | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  async fetchAggregate(categoryId: string): Promise<void> {
    this.loading = true;
    this.error = null;
    try {
      const res = await apiClient.get<CategoryAggregate>(`/categories/${categoryId}/aggregate`);
      runInAction(() => {
        this.aggregate = res.data;
        this.loading = false;
      });
    } catch {
      runInAction(() => {
        this.error = 'Failed to load category details';
        this.loading = false;
      });
    }
  }
}

export const householdCategoryStore = new HouseholdCategoryStore();
