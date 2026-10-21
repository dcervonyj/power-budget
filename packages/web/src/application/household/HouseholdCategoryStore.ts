import { makeAutoObservable, runInAction } from 'mobx';
import type {
  HouseholdDashboardCategoryDto,
  HouseholdDashboardResponseDto,
} from '@power-budget/shared-app/contract';
import { apiClient } from '../../AppProviders.js';

export type HouseholdCategoryError = 'not_found' | 'failed';

/**
 * One category of the household dashboard (`GET /households/:id/dashboard?planId=`).
 * The API has no per-category endpoint, so the store reads the dashboard and picks
 * the category; the line is already reduced to what the viewer's privacy level allows.
 */
export class HouseholdCategoryStore {
  category: HouseholdDashboardCategoryDto | null = null;
  loading = false;
  error: HouseholdCategoryError | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  async fetchCategory(householdId: string, planId: string, categoryId: string): Promise<void> {
    this.loading = true;
    this.error = null;
    this.category = null;
    try {
      const res = await apiClient.get<HouseholdDashboardResponseDto>(
        `/households/${householdId}/dashboard?planId=${encodeURIComponent(planId)}`,
      );
      const found = res.data.categories.find((c) => c.categoryId === categoryId);
      runInAction(() => {
        this.category = found ?? null;
        this.error = found === undefined ? 'not_found' : null;
        this.loading = false;
      });
    } catch {
      runInAction(() => {
        this.error = 'failed';
        this.loading = false;
      });
    }
  }
}

export const householdCategoryStore = new HouseholdCategoryStore();
