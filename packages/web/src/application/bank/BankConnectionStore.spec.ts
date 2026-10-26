import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BankConnectionDto } from '@power-budget/shared-app/contract';
import { apiClient } from '../../AppProviders.js';
import { BankConnectionStore } from './BankConnectionStore.js';
import { deferred } from '../../test/deferred.js';

vi.mock('../../AppProviders.js', () => ({
  apiClient: { get: vi.fn(), post: vi.fn() },
}));

const mockGet = vi.mocked(apiClient.get);

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
    expect(store.expiringConnections).toEqual([]);
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
});
