import { makeAutoObservable } from 'mobx';
import { readApiError } from '@power-budget/shared-app';
import {
  FX_RATE_UNAVAILABLE,
  type HouseholdDashboardCategoryDto,
  type HouseholdDashboardResponseDto,
} from '@power-budget/shared-app/contract';
import { apiClient } from '../../AppProviders.js';
import { clientSession } from '../auth/ClientSession.js';

/** 503 fx_rate_unavailable (CLN-012) is `fx_unavailable`. */
export type HouseholdCategoryError = 'not_found' | 'fx_unavailable' | 'failed';

/**
 * One category of the household dashboard (`GET /households/:id/dashboard?planId=`).
 * The API has no per-category endpoint, so the store reads the dashboard and picks
 * the category; the line is already reduced to what the viewer's privacy level allows.
 */
export class HouseholdCategoryStore {
  category: HouseholdDashboardCategoryDto | null = null;
  loading = false;
  error: HouseholdCategoryError | null = null;

  /** Bumped when the session ends, so a late answer for the previous user is dropped. */
  private session = 0;

  constructor() {
    makeAutoObservable<HouseholdCategoryStore, 'session'>(this, { session: false });
  }

  async fetchCategory(householdId: string, planId: string, categoryId: string): Promise<void> {
    const session = this.session;
    this.loading = true;
    this.error = null;
    this.category = null;
    try {
      const res = await apiClient.get<HouseholdDashboardResponseDto>(
        `/households/${householdId}/dashboard?planId=${encodeURIComponent(planId)}`,
      );
      const found = res.data.categories.find((c) => c.categoryId === categoryId);
      this.applyCategory(session, found ?? null);
    } catch (err) {
      const error = readApiError(err).code === FX_RATE_UNAVAILABLE ? 'fx_unavailable' : 'failed';
      this.applyFailed(session, error);
    }
  }

  /** Sign-out or session end: the previous user's category goes. */
  resetSession(): void {
    this.session += 1;
    this.category = null;
    this.loading = false;
    this.error = null;
  }

  private applyCategory(session: number, category: HouseholdDashboardCategoryDto | null): void {
    if (session !== this.session) {
      return;
    }
    this.category = category;
    this.error = category === null ? 'not_found' : null;
    this.loading = false;
  }

  private applyFailed(session: number, error: HouseholdCategoryError): void {
    if (session !== this.session) {
      return;
    }
    this.error = error;
    this.loading = false;
  }
}

export const householdCategoryStore = new HouseholdCategoryStore();
clientSession.register(householdCategoryStore);
