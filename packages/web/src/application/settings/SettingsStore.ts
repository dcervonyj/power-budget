import { makeAutoObservable } from 'mobx';
import { apiClient } from '../../AppProviders.js';

const BASE_CURRENCY_KEY = 'pb_base_currency';
const INTERESTING_CURRENCIES_KEY = 'pb_interesting_currencies';
const WEEKLY_DIGEST_KEY = 'pb_weekly_digest';
const OVER_BUDGET_THRESHOLD_KEY = 'pb_over_budget_threshold';
const DISPLAY_NAME_KEY = 'pb_display_name';

interface UserProfile {
  id?: string;
  email?: string;
  displayName?: string;
  householdId?: string;
}

function readInterestingCurrencies(): string[] {
  try {
    const raw = localStorage.getItem(INTERESTING_CURRENCIES_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export class SettingsStore {
  displayName: string = localStorage.getItem(DISPLAY_NAME_KEY) ?? '';
  email: string = '';
  householdId: string = '';

  baseCurrency: string = localStorage.getItem(BASE_CURRENCY_KEY) ?? 'EUR';
  interestingCurrencies: string[] = readInterestingCurrencies();

  weeklyDigest: boolean = localStorage.getItem(WEEKLY_DIGEST_KEY) === 'true';
  overBudgetThreshold: number = Number(localStorage.getItem(OVER_BUDGET_THRESHOLD_KEY) ?? '80');

  isSaving: boolean = false;
  saveError: string | null = null;

  isExporting: boolean = false;
  exportUrl: string | null = null;
  exportError: string | null = null;

  isDeleting: boolean = false;
  deleteError: string | null = null;

  profileLoaded: boolean = false;

  constructor() {
    makeAutoObservable(this);
  }

  setDisplayName(value: string): void {
    this.displayName = value;
  }

  setBaseCurrency(value: string): void {
    this.baseCurrency = value;
  }

  toggleInterestingCurrency(currency: string): void {
    if (this.interestingCurrencies.includes(currency)) {
      this.interestingCurrencies = this.interestingCurrencies.filter((c) => c !== currency);
    } else if (this.interestingCurrencies.length < 5) {
      this.interestingCurrencies = [...this.interestingCurrencies, currency];
    }
  }

  setWeeklyDigest(value: boolean): void {
    this.weeklyDigest = value;
  }

  setOverBudgetThreshold(value: number): void {
    this.overBudgetThreshold = value;
  }

  clearExportUrl(): void {
    this.exportUrl = null;
    this.exportError = null;
  }

  async loadProfile(): Promise<void> {
    try {
      const res = await apiClient.get<UserProfile>('/users/me');
      if (res.data) {
        if (res.data.email) {
          this.email = res.data.email;
        }
        if (res.data.displayName && !localStorage.getItem(DISPLAY_NAME_KEY)) {
          this.displayName = res.data.displayName;
        }
        if (res.data.householdId) {
          this.householdId = res.data.householdId;
        }
      }
    } catch {
      // silently ignore — profile may not be available
    } finally {
      this.profileLoaded = true;
    }
  }

  async saveProfile(): Promise<void> {
    this.isSaving = true;
    this.saveError = null;
    try {
      localStorage.setItem(DISPLAY_NAME_KEY, this.displayName);
      await apiClient
        .request({ url: '/users/me', method: 'PATCH', body: { displayName: this.displayName } })
        .catch(() => undefined);
    } catch {
      this.saveError = 'save_failed';
    } finally {
      this.isSaving = false;
    }
  }

  async saveCurrency(): Promise<void> {
    this.isSaving = true;
    this.saveError = null;
    try {
      localStorage.setItem(BASE_CURRENCY_KEY, this.baseCurrency);
      localStorage.setItem(INTERESTING_CURRENCIES_KEY, JSON.stringify(this.interestingCurrencies));
      await apiClient
        .request({
          url: '/users/me',
          method: 'PATCH',
          body: {
            baseCurrency: this.baseCurrency,
            interestingCurrencies: this.interestingCurrencies,
          },
        })
        .catch(() => undefined);
    } catch {
      this.saveError = 'save_failed';
    } finally {
      this.isSaving = false;
    }
  }

  async saveNotifications(): Promise<void> {
    this.isSaving = true;
    this.saveError = null;
    try {
      localStorage.setItem(WEEKLY_DIGEST_KEY, String(this.weeklyDigest));
      localStorage.setItem(OVER_BUDGET_THRESHOLD_KEY, String(this.overBudgetThreshold));
      await apiClient
        .request({
          url: '/users/me/preferences',
          method: 'PATCH',
          body: {
            weeklyDigest: this.weeklyDigest,
            overBudgetThreshold: this.overBudgetThreshold,
          },
        })
        .catch(() => undefined);
    } catch {
      this.saveError = 'save_failed';
    } finally {
      this.isSaving = false;
    }
  }

  async exportData(): Promise<void> {
    this.isExporting = true;
    this.exportUrl = null;
    this.exportError = null;
    try {
      await apiClient.post('/households/export', {});

      let attempts = 0;
      const maxAttempts = 15;
      await new Promise<void>((resolve, reject) => {
        const timer = setInterval(() => {
          attempts++;
          apiClient
            .get<{ url?: string; status?: string }>('/households/export/status')
            .then((res: { data: { url?: string; status?: string } }) => {
              if (res.data.url) {
                clearInterval(timer);
                this.exportUrl = res.data.url;
                resolve();
              } else if (attempts >= maxAttempts) {
                clearInterval(timer);
                reject(new Error('Export timed out'));
              }
            })
            .catch((err: unknown) => {
              clearInterval(timer);
              reject(err);
            });
        }, 2000);
      });
    } catch {
      this.exportError = 'export_failed';
    } finally {
      this.isExporting = false;
    }
  }

  async deleteAccount(): Promise<void> {
    this.isDeleting = true;
    this.deleteError = null;
    try {
      const id = this.householdId || 'me';
      await apiClient.delete(`/households/${id}`);
    } catch {
      this.deleteError = 'delete_failed';
      this.isDeleting = false;
    }
  }
}

export const settingsStore = new SettingsStore();
