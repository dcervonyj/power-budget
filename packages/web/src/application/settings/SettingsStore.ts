import { makeAutoObservable, runInAction } from 'mobx';
import { isSupportedCurrency } from '@power-budget/core';
import { readApiError } from '@power-budget/shared-app';
import type {
  UpdateUserProfileDto,
  UserProfileDto,
  VerifyTotpDto,
} from '@power-budget/shared-app/contract';
import { apiClient } from '../../AppProviders.js';
import { clientSession } from '../auth/ClientSession.js';

const BASE_CURRENCY_KEY = 'pb_base_currency';
const DEFAULT_BASE_CURRENCY = 'EUR';
const INTERESTING_CURRENCIES_KEY = 'pb_interesting_currencies';

export type SaveError = 'save_failed' | 'unsupported_currency';

function readInterestingCurrencies(): string[] {
  try {
    const raw = localStorage.getItem(INTERESTING_CURRENCIES_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

/**
 * The signed-in user's settings. Profile fields come from `GET /users/me`
 * (UserProfileDto) and are saved with `PATCH /users/me`; interesting currencies are a
 * local display preference (the API has no field for them). There is no
 * notification-preferences endpoint, so the app has no notification settings.
 */
export class SettingsStore {
  userId: string = '';
  displayName: string = '';
  email: string = '';
  householdId: string = '';
  timezone: string = '';

  /** Cached so screens have a currency before the profile loads. */
  baseCurrency: string = localStorage.getItem(BASE_CURRENCY_KEY) ?? DEFAULT_BASE_CURRENCY;
  interestingCurrencies: string[] = readInterestingCurrencies();

  isSaving: boolean = false;
  saveError: SaveError | null = null;

  isExporting: boolean = false;
  exportUrl: string | null = null;
  exportError: string | null = null;

  isDeleting: boolean = false;
  deleteError: DeleteError | null = null;

  profileLoaded: boolean = false;

  /** Bumped when the session ends, so a late profile of the previous user is dropped. */
  private session = 0;

  constructor() {
    makeAutoObservable<SettingsStore, 'session'>(this, { session: false });
  }

  setDisplayName(value: string): void {
    this.displayName = value;
  }

  setTimezone(value: string): void {
    this.timezone = value;
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

  clearExportUrl(): void {
    this.exportUrl = null;
    this.exportError = null;
  }

  async loadProfile(): Promise<void> {
    const session = this.session;
    try {
      const res = await apiClient.get<UserProfileDto>('/users/me');
      this.applyProfile(session, res.data);
    } catch {
      // The screens keep their defaults when the profile is not available.
    } finally {
      this.markProfileLoaded(session);
    }
  }

  async saveProfile(): Promise<void> {
    const body: UpdateUserProfileDto = this.timezone.trim()
      ? { displayName: this.displayName.trim(), timezone: this.timezone.trim() }
      : { displayName: this.displayName.trim() };
    await this.patchProfile(body);
  }

  async saveCurrency(): Promise<void> {
    localStorage.setItem(INTERESTING_CURRENCIES_KEY, JSON.stringify(this.interestingCurrencies));
    if (!isSupportedCurrency(this.baseCurrency)) {
      this.saveError = 'unsupported_currency';

      return;
    }
    await this.patchProfile({ baseCurrency: this.baseCurrency });
  }

  async exportData(): Promise<void> {
    const session = this.session;
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
              if (res.data.status === 'failed') {
                clearInterval(timer);
                reject(new Error('Export failed'));
              } else if (typeof res.data.url === 'string' && res.data.url !== '') {
                clearInterval(timer);
                this.applyExportUrl(session, res.data.url);
                resolve();
              } else if (res.data.status === 'ready') {
                clearInterval(timer);
                reject(new Error('Export ready without a download url'));
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
      this.applyExportFailed(session);
    } finally {
      this.applyExportDone(session);
    }
  }

  /**
   * Household deletion needs a recent TOTP verification (CLN-004). Without one the
   * API answers 403 `requires_totp` (or `requires_totp_enrollment`); the screen then
   * asks for a code and calls this again with it.
   */
  async deleteAccount(totpCode = ''): Promise<void> {
    this.isDeleting = true;
    this.deleteError = null;
    if (!this.householdId) {
      // Only a member of a household can delete it (UserProfileDto.householdId).
      this.deleteError = 'delete_failed';
      this.isDeleting = false;

      return;
    }
    try {
      if (totpCode) {
        const body: VerifyTotpDto = { code: totpCode };
        await apiClient.post('/auth/totp/verify', body);
      }
      await apiClient.delete(`/households/${this.householdId}`);
    } catch (err) {
      this.deleteError = deleteErrorCode(err);
      this.isDeleting = false;
    }
  }

  /**
   * Sign-out or session end: the profile, the currency preferences and every
   * in-progress state go back to their defaults, so the next user loads their own.
   */
  resetSession(): void {
    this.session += 1;
    this.userId = '';
    this.displayName = '';
    this.email = '';
    this.householdId = '';
    this.timezone = '';
    this.baseCurrency = DEFAULT_BASE_CURRENCY;
    this.interestingCurrencies = [];
    this.isSaving = false;
    this.saveError = null;
    this.isExporting = false;
    this.exportUrl = null;
    this.exportError = null;
    this.isDeleting = false;
    this.deleteError = null;
    this.profileLoaded = false;
  }

  private async patchProfile(body: UpdateUserProfileDto): Promise<void> {
    const session = this.session;
    this.isSaving = true;
    this.saveError = null;
    try {
      const res = await apiClient.patch<UserProfileDto>('/users/me', body);
      this.applyProfile(session, res.data);
    } catch {
      runInAction(() => {
        this.saveError = 'save_failed';
      });
    } finally {
      runInAction(() => {
        this.isSaving = false;
      });
    }
  }

  /** The export link is for the household of the session that asked for it. */
  private applyExportUrl(session: number, url: string): void {
    if (session === this.session) {
      this.exportUrl = url;
    }
  }

  private applyExportFailed(session: number): void {
    if (session === this.session) {
      this.exportError = 'export_failed';
    }
  }

  private applyExportDone(session: number): void {
    if (session === this.session) {
      this.isExporting = false;
    }
  }

  private markProfileLoaded(session: number): void {
    if (session === this.session) {
      this.profileLoaded = true;
    }
  }

  private applyProfile(session: number, profile: UserProfileDto): void {
    if (session !== this.session) {
      return;
    }
    this.userId = profile.id;
    this.email = profile.email;
    this.displayName = profile.displayName;
    this.timezone = profile.timezone;
    this.householdId = profile.householdId ?? '';
    if (profile.baseCurrency !== null) {
      this.baseCurrency = profile.baseCurrency;
      localStorage.setItem(BASE_CURRENCY_KEY, profile.baseCurrency);
    }
  }
}

export type DeleteError =
  | 'requires_totp'
  | 'requires_totp_enrollment'
  | 'totp_invalid'
  | 'too_many_requests'
  | 'delete_failed';

function deleteErrorCode(err: unknown): DeleteError {
  const { code } = readApiError(err);
  switch (code) {
    case 'requires_totp':
    case 'requires_totp_enrollment':
    case 'totp_invalid':
    case 'too_many_requests':
      return code;
    default:
      return 'delete_failed';
  }
}

export const settingsStore = new SettingsStore();
clientSession.register(settingsStore);
