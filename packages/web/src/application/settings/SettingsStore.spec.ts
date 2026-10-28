import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { UserProfileDto } from '@power-budget/shared-app/contract';
import { SettingsStore, type SettingsHttp } from './SettingsStore.js';
import type { KeyValueStore } from '../ports/KeyValueStore.js';
import { deferred } from '../../test/deferred.js';

const http = {
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
} satisfies SettingsHttp;
const mockGet = http.get;
const mockPost = http.post;
const mockPatch = http.patch;
const mockDelete = http.delete;

class MemoryKeyValueStore implements KeyValueStore {
  private readonly items = new Map<string, string>();

  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }
}

function newStore(): SettingsStore {
  return new SettingsStore(http, new MemoryKeyValueStore());
}

const profile: UserProfileDto = {
  id: 'user-1',
  email: 'ana@example.com',
  displayName: 'Ana',
  locale: 'pl',
  localePreference: 'pl',
  defaultLocale: 'en',
  baseCurrency: 'PLN',
  timezone: 'Europe/Warsaw',
  householdId: 'hh-1',
};

function ok<T>(data: T): { status: number; data: T; headers: Record<string, string> } {
  return { status: 200, data, headers: {} };
}

function apiError(status: number, code: string): Error & { response: unknown } {
  return Object.assign(new Error(`HTTP ${status}`), {
    response: { status, data: { statusCode: status, code } },
  });
}

describe('SettingsStore.deleteAccount', () => {
  let store: SettingsStore;

  beforeEach(() => {
    vi.resetAllMocks();
    store = newStore();
    store.householdId = 'hh-1';
  });

  it('refuses to delete without a household and calls nothing', async () => {
    store.householdId = null;

    await store.deleteAccount();

    expect(store.deleteError).toBe('delete_failed');
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('reports requires_totp when the API wants a recent TOTP verification', async () => {
    mockDelete.mockRejectedValueOnce(apiError(403, 'requires_totp'));

    await store.deleteAccount();

    expect(store.deleteError).toBe('requires_totp');
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('verifies the code first, then deletes the household', async () => {
    mockPost.mockResolvedValueOnce({ status: 204, data: undefined, headers: {} });
    mockDelete.mockResolvedValueOnce({
      status: 202,
      data: { scheduledFor: '2026-11-27T10:00:00.000Z' },
      headers: {},
    });

    await store.deleteAccount('123456');

    expect(mockPost).toHaveBeenCalledWith('/auth/totp/verify', { code: '123456' });
    expect(mockDelete).toHaveBeenCalledWith('/households/hh-1');
    expect(store.deleteError).toBeNull();
    expect(store.deletionScheduledFor).toBe('2026-11-27T10:00:00.000Z');
    expect(store.isDeleting).toBe(false);
  });

  it('maps a non-owner 403 to its own error and stops the busy state', async () => {
    mockDelete.mockRejectedValueOnce(apiError(403, 'household_owner_required'));

    await store.deleteAccount();

    expect(store.deleteError).toBe('household_owner_required');
    expect(store.deletionScheduledFor).toBeNull();
    expect(store.isDeleting).toBe(false);
  });

  it('reports an invalid code without calling delete', async () => {
    mockPost.mockRejectedValueOnce(apiError(401, 'totp_invalid'));

    await store.deleteAccount('000000');

    expect(store.deleteError).toBe('totp_invalid');
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('points to TOTP enrolment when none exists', async () => {
    mockDelete.mockRejectedValueOnce(apiError(403, 'requires_totp_enrollment'));

    await store.deleteAccount();

    expect(store.deleteError).toBe('requires_totp_enrollment');
  });
});

describe('SettingsStore profile (UserProfileDto)', () => {
  let store: SettingsStore;

  beforeEach(() => {
    vi.resetAllMocks();
    store = newStore();
  });

  it('loads every profile field from GET /users/me', async () => {
    mockGet.mockResolvedValueOnce(ok(profile));

    await store.loadProfile();

    expect(mockGet).toHaveBeenCalledWith('/users/me');
    expect({
      userId: store.userId,
      email: store.email,
      displayName: store.displayName,
      timezone: store.timezone,
      householdId: store.householdId,
      baseCurrency: store.baseCurrency,
      profileLoaded: store.profileLoaded,
    }).toEqual({
      userId: 'user-1',
      email: 'ana@example.com',
      displayName: 'Ana',
      timezone: 'Europe/Warsaw',
      householdId: 'hh-1',
      baseCurrency: 'PLN',
      profileLoaded: true,
    });
  });

  it('keeps the cached base currency and no household when the profile has none', async () => {
    mockGet.mockResolvedValueOnce(ok({ ...profile, baseCurrency: null, householdId: null }));
    store.baseCurrency = 'EUR';

    await store.loadProfile();

    expect(store.baseCurrency).toBe('EUR');
    expect(store.householdId).toBeNull();
  });

  it('saves the display name and time zone with PATCH /users/me and applies the answer', async () => {
    mockPatch.mockResolvedValueOnce(ok({ ...profile, displayName: 'Ana K.', timezone: 'UTC' }));
    store.setDisplayName('  Ana K. ');
    store.setTimezone('UTC');

    await store.saveProfile();

    expect(mockPatch).toHaveBeenCalledWith('/users/me', { displayName: 'Ana K.', timezone: 'UTC' });
    expect(store.displayName).toBe('Ana K.');
    expect(store.saveError).toBeNull();
    expect(store.isSaving).toBe(false);
  });

  it('reports a failed save instead of hiding it', async () => {
    mockPatch.mockRejectedValueOnce(new Error('HTTP 400'));
    store.setDisplayName('Ana');

    await store.saveProfile();

    expect(mockPatch).toHaveBeenCalledWith('/users/me', { displayName: 'Ana' });
    expect(store.saveError).toBe('save_failed');
    expect(store.isSaving).toBe(false);
  });

  it('saves a supported base currency and refuses one the API rejects', async () => {
    mockPatch.mockResolvedValueOnce(ok({ ...profile, baseCurrency: 'EUR' }));
    store.setBaseCurrency('EUR');

    await store.saveCurrency();

    expect(mockPatch).toHaveBeenCalledWith('/users/me', { baseCurrency: 'EUR' });
    expect(store.baseCurrency).toBe('EUR');

    store.setBaseCurrency('JPY');
    await store.saveCurrency();

    expect(store.saveError).toBe('unsupported_currency');
    expect(mockPatch).toHaveBeenCalledTimes(1);
  });
});

describe('SettingsStore.exportData', () => {
  let store: SettingsStore;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    store = newStore();
    mockPost.mockResolvedValueOnce({ status: 202, data: undefined, headers: {} });
  });

  it('stops polling and reports an error when export fails', async () => {
    mockGet.mockResolvedValueOnce(ok({ status: 'failed' }));

    const exporting = store.exportData();
    await vi.advanceTimersByTimeAsync(2000);
    await exporting;

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(store.exportError).toBe('export_failed');
    expect(store.isExporting).toBe(false);
  });

  it('stops polling when export is ready', async () => {
    mockGet.mockResolvedValueOnce(ok({ status: 'ready', url: '/export.csv' }));

    const exporting = store.exportData();
    await vi.advanceTimersByTimeAsync(2000);
    await exporting;

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(store.exportUrl).toBe('/export.csv');
    expect(store.exportError).toBeNull();
  });

  it('stops polling and reports an error when the status request fails', async () => {
    mockGet.mockRejectedValueOnce(new Error('network down'));

    const exporting = store.exportData();
    await vi.advanceTimersByTimeAsync(2000);
    await exporting;

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(store.exportError).toBe('export_failed');
    expect(store.isExporting).toBe(false);
  });

  it('reports an error when the export is ready without a download url', async () => {
    mockGet.mockResolvedValueOnce(ok({ status: 'ready' }));

    const exporting = store.exportData();
    await vi.advanceTimersByTimeAsync(2000);
    await exporting;

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(store.exportUrl).toBeNull();
    expect(store.exportError).toBe('export_failed');
  });

  it('keeps polling while export is pending', async () => {
    mockGet.mockResolvedValueOnce(ok({ status: 'pending' }));
    mockGet.mockResolvedValueOnce(ok({ status: 'ready', url: '/export.csv' }));

    const exporting = store.exportData();
    await vi.advanceTimersByTimeAsync(2000);
    expect(mockGet).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2000);
    await exporting;

    expect(mockGet).toHaveBeenCalledTimes(2);
    expect(store.exportUrl).toBe('/export.csv');
  });

  afterEach(() => {
    vi.useRealTimers();
  });
});

describe('SettingsStore.resetSession', () => {
  let store: SettingsStore;

  beforeEach(() => {
    vi.resetAllMocks();
    store = newStore();
  });

  it("forgets the user's profile, currencies and progress", async () => {
    mockGet.mockResolvedValueOnce(ok(profile));
    await store.loadProfile();
    store.toggleInterestingCurrency('USD');
    store.exportUrl = '/export.csv';
    store.saveError = 'save_failed';
    store.deleteError = 'requires_totp';
    store.deletionScheduledFor = '2026-11-27T10:00:00.000Z';

    store.resetSession();

    expect(store.userId).toBe('');
    expect(store.displayName).toBe('');
    expect(store.email).toBe('');
    expect(store.householdId).toBeNull();
    expect(store.timezone).toBe('');
    expect(store.baseCurrency).toBe('EUR');
    expect(store.interestingCurrencies).toEqual([]);
    expect(store.profileLoaded).toBe(false);
    expect(store.isSaving).toBe(false);
    expect(store.saveError).toBeNull();
    expect(store.isExporting).toBe(false);
    expect(store.exportUrl).toBeNull();
    expect(store.exportError).toBeNull();
    expect(store.isDeleting).toBe(false);
    expect(store.deleteError).toBeNull();
    expect(store.deletionScheduledFor).toBeNull();
  });

  it('drops a profile that arrives after the session ended', async () => {
    const answer = deferred<ReturnType<typeof ok<UserProfileDto>>>();
    mockGet.mockReturnValueOnce(answer.promise);
    const loading = store.loadProfile();

    store.resetSession();
    answer.resolve(ok(profile));
    await loading;

    expect(store.userId).toBe('');
    expect(store.profileLoaded).toBe(false);
  });

  it('drops a saved profile that arrives after the session ended', async () => {
    const answer = deferred<ReturnType<typeof ok<UserProfileDto>>>();
    mockPatch.mockReturnValueOnce(answer.promise);
    store.setDisplayName('Ana');
    const saving = store.saveProfile();

    store.resetSession();
    answer.resolve(ok(profile));
    await saving;

    expect(store.userId).toBe('');
    expect(store.displayName).toBe('');
  });

  it('drops an export link that arrives after the session ended', async () => {
    vi.useFakeTimers();
    mockPost.mockResolvedValueOnce(ok({}));
    mockGet.mockResolvedValueOnce(ok({ status: 'ready', url: '/anna-export.csv' }));
    const exporting = store.exportData();

    store.resetSession();
    await vi.advanceTimersByTimeAsync(2000);
    await exporting;

    expect(store.exportUrl).toBeNull();
    expect(store.isExporting).toBe(false);
  });

  it('drops an export failure that arrives after the session ended', async () => {
    vi.useFakeTimers();
    mockPost.mockResolvedValueOnce(ok({}));
    mockGet.mockResolvedValueOnce(ok({ status: 'failed' }));
    const exporting = store.exportData();

    store.resetSession();
    await vi.advanceTimersByTimeAsync(2000);
    await exporting;

    expect(store.exportError).toBeNull();
  });

  afterEach(() => {
    vi.useRealTimers();
  });
});
