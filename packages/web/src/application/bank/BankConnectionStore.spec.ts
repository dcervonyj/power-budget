import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BankConnectionDto } from '@power-budget/shared-app/contract';
import { apiClient } from '../../AppProviders.js';
import { BankConnectionStore } from './BankConnectionStore.js';
import { deferred } from '../../test/deferred.js';

vi.mock('../../AppProviders.js', () => ({
  apiClient: { get: vi.fn(), post: vi.fn() },
}));

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);

const CONNECTION: BankConnectionDto = {
  id: 'conn-anna',
  householdId: 'hh-anna',
  userId: 'user-anna',
  provider: 'gocardless',
  bankId: 'PKO_BPKOPLPW',
  status: 'expired',
  expiresAt: '2026-10-01T00:00:00.000Z',
  disconnectedAt: null,
  createdAt: '2026-06-01T00:00:00.000Z',
};

function ok(data: BankConnectionDto[]): {
  status: number;
  data: BankConnectionDto[];
  headers: Record<string, string>;
} {
  return { status: 200, data, headers: {} };
}

describe('BankConnectionStore', () => {
  let store: BankConnectionStore;

  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    store = new BankConnectionStore();
  });

  it('reads the connections', async () => {
    mockGet.mockResolvedValueOnce(ok([CONNECTION]));

    await store.fetchConnections();

    expect(mockGet).toHaveBeenCalledWith('/bank-connections');
    expect(store.connections.map((c) => c.id)).toEqual(['conn-anna']);
    expect(store.loading).toBe(false);
  });

  it('forgets the connections when the session ends', async () => {
    mockGet.mockResolvedValueOnce(ok([CONNECTION]));
    await store.fetchConnections();

    store.resetSession();

    expect(store.connections).toEqual([]);
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();
  });

  it('drops an answer for the previous session', async () => {
    const pending = deferred<ReturnType<typeof ok>>();
    mockGet.mockReturnValueOnce(pending.promise);
    const fetching = store.fetchConnections();

    store.resetSession();
    pending.resolve(ok([CONNECTION]));
    await fetching;

    expect(store.connections).toEqual([]);
    expect(store.loading).toBe(false);
  });

  it('drops a failure for the previous session', async () => {
    const pending = deferred<ReturnType<typeof ok>>();
    mockGet.mockReturnValueOnce(pending.promise);
    const fetching = store.fetchConnections();

    store.resetSession();
    pending.reject(new Error('offline'));
    await fetching;

    expect(store.error).toBeNull();
  });

  it('starts a connection with the bank, provider and redirect, and returns the consent page', async () => {
    mockPost.mockResolvedValueOnce({
      status: 201,
      data: { consentUrl: 'https://bank.example/consent', connectionId: 'conn-new' },
      headers: {},
    });

    const consentUrl = await store.connect('gocardless', 'PKO_BPKOPLPW', 'https://app/callback');

    expect(mockPost).toHaveBeenCalledWith('/bank-connections', {
      provider: 'gocardless',
      bankId: 'PKO_BPKOPLPW',
      redirectUri: 'https://app/callback',
    });
    expect(consentUrl).toBe('https://bank.example/consent');
  });

  it('reports a failed connect without clearing the list', async () => {
    mockGet.mockResolvedValueOnce(ok([CONNECTION]));
    await store.fetchConnections();
    mockPost.mockRejectedValueOnce(new Error('403'));

    const consentUrl = await store.connect('gocardless', 'PKO_BPKOPLPW', 'https://app/callback');

    expect(consentUrl).toBeNull();
    expect(store.actionError).toBe('connect');
    expect(store.error).toBeNull();
    expect(store.connections).toHaveLength(1);
  });

  it('drops a stale action error when the connections are fetched again', async () => {
    mockPost.mockRejectedValueOnce(new Error('403'));
    await store.connect('gocardless', 'PKO_BPKOPLPW', 'https://app/callback');
    mockGet.mockResolvedValueOnce(ok([CONNECTION]));

    await store.fetchConnections();

    expect(store.actionError).toBeNull();
  });

  it('returns the consent page of a reconnect', async () => {
    mockPost.mockResolvedValueOnce({
      status: 201,
      data: { consentUrl: 'https://bank.example/renew' },
      headers: {},
    });

    const consentUrl = await store.reconnect('conn-anna', 'https://app/callback');

    expect(mockPost).toHaveBeenCalledWith('/bank-connections/conn-anna/reconnect', {
      redirectUri: 'https://app/callback',
    });
    expect(consentUrl).toBe('https://bank.example/renew');
  });

  it('marks a connection as refreshing until the refresh and reload are done', async () => {
    const pending = deferred<{ status: number; data: unknown; headers: Record<string, string> }>();
    mockPost.mockReturnValueOnce(pending.promise);
    mockGet.mockResolvedValueOnce(ok([CONNECTION]));

    const refreshing = store.refresh('conn-anna');

    expect(store.refreshingIds).toEqual(['conn-anna']);
    pending.resolve({ status: 201, data: {}, headers: {} });
    await refreshing;

    expect(store.refreshingIds).toEqual([]);
    expect(store.actionError).toBeNull();
  });

  it('reports a failed refresh and stops the updating state', async () => {
    mockPost.mockRejectedValueOnce(new Error('500'));

    await store.refresh('conn-anna');

    expect(store.actionError).toBe('refresh');
    expect(store.refreshingIds).toEqual([]);
  });
});
