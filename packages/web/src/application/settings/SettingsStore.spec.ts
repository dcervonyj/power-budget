import { beforeEach, describe, expect, it, vi } from 'vitest';

// Node 25+ hides jsdom's localStorage; the store reads it when the module loads.
vi.hoisted(() => {
  const items = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => items.set(key, value),
    removeItem: (key: string) => items.delete(key),
    clear: () => items.clear(),
  });
});

vi.mock('../../AppProviders.js', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), delete: vi.fn(), request: vi.fn() },
}));

import { apiClient } from '../../AppProviders.js';
import { SettingsStore } from './SettingsStore.js';

const mockPost = vi.mocked(apiClient.post);
const mockDelete = vi.mocked(apiClient.delete);

function apiError(status: number, code: string): Error & { response: unknown } {
  return Object.assign(new Error(`HTTP ${status}`), {
    response: { status, data: { statusCode: status, code } },
  });
}

describe('SettingsStore.deleteAccount', () => {
  let store: SettingsStore;

  beforeEach(() => {
    vi.resetAllMocks();
    store = new SettingsStore();
    store.householdId = 'hh-1';
  });

  it('reports requires_totp when the API wants a recent TOTP verification', async () => {
    mockDelete.mockRejectedValueOnce(apiError(403, 'requires_totp'));

    await store.deleteAccount();

    expect(store.deleteError).toBe('requires_totp');
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('verifies the code first, then deletes the household', async () => {
    mockPost.mockResolvedValueOnce({ status: 204, data: undefined, headers: {} });
    mockDelete.mockResolvedValueOnce({ status: 202, data: undefined, headers: {} });

    await store.deleteAccount('123456');

    expect(mockPost).toHaveBeenCalledWith('/auth/totp/verify', { code: '123456' });
    expect(mockDelete).toHaveBeenCalledWith('/households/hh-1');
    expect(store.deleteError).toBeNull();
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
