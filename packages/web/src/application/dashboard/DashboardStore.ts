import { makeAutoObservable, runInAction } from 'mobx';
import { apiClient } from '../../AppProviders.js';
import { settingsStore } from '../settings/SettingsStore.js';
import type { PlanActualsView } from '../../domain/dashboard/PlanActualsView.js';

export interface Plan {
  id: string;
  name: string;
  type: 'personal' | 'household';
  periodType: 'weekly' | 'monthly' | 'custom';
  periodStart: string;
  periodEnd: string;
  currency: string;
}

const FX_CACHE_KEY = 'pb_fx_rates';

interface FxRateTable {
  baseCurrency: string;
  rates: Record<string, number>;
}

function convertMinor(amountMinor: number, fromCurrency: string, toCurrency: string): number {
  if (fromCurrency === toCurrency) return amountMinor;
  try {
    const raw = localStorage.getItem(FX_CACHE_KEY);
    if (!raw) return amountMinor;
    const table = JSON.parse(raw) as FxRateTable;
    const { baseCurrency, rates } = table;

    let amountInBase: number;
    if (fromCurrency === baseCurrency) {
      amountInBase = amountMinor;
    } else {
      const fromRate = rates[fromCurrency];
      if (fromRate === undefined) return amountMinor;
      amountInBase = amountMinor / fromRate;
    }

    if (toCurrency === baseCurrency) return Math.round(amountInBase);
    const toRate = rates[toCurrency];
    if (toRate === undefined) return amountMinor;
    return Math.round(amountInBase * toRate);
  } catch {
    return amountMinor;
  }
}

export class DashboardStore {
  activePlans: Plan[] = [];
  selectedPlanId: string | null = null;
  actuals: PlanActualsView | null = null;
  loading = false;
  error: string | null = null;
  displayCurrency: string = '';

  constructor() {
    makeAutoObservable(this);
  }

  async fetchPlans(): Promise<void> {
    this.loading = true;
    this.error = null;
    try {
      const res = await apiClient.get<Plan[]>('/plans');
      runInAction(() => {
        this.activePlans = res.data;
        this.loading = false;
      });
    } catch {
      runInAction(() => {
        this.error = 'Failed to load plans';
        this.loading = false;
      });
    }
  }

  async fetchActuals(planId: string): Promise<void> {
    this.loading = true;
    this.error = null;
    try {
      const res = await apiClient.get<PlanActualsView>(`/plans/${planId}/dashboard`);
      runInAction(() => {
        this.actuals = res.data;
        this.displayCurrency = res.data.currency;
        this.loading = false;
      });
    } catch {
      runInAction(() => {
        this.error = 'Failed to load dashboard';
        this.loading = false;
      });
    }
  }

  selectPlan(planId: string): void {
    this.selectedPlanId = planId;
    void this.fetchActuals(planId);
  }

  cycleCurrency(): void {
    if (!this.actuals) return;
    const currencies = [this.actuals.currency, ...settingsStore.interestingCurrencies].filter(
      (c, i, arr) => arr.indexOf(c) === i,
    );

    if (currencies.length <= 1) return;
    const currentIndex = currencies.indexOf(this.displayCurrency);
    const nextIndex = (currentIndex + 1) % currencies.length;
    this.displayCurrency = currencies[nextIndex] ?? this.actuals.currency;
  }

  convertAmount(amountMinor: number, fromCurrency: string): number {
    return convertMinor(amountMinor, fromCurrency, this.displayCurrency || fromCurrency);
  }
}

export const dashboardStore = new DashboardStore();
