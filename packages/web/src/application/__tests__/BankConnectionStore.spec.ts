import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from '../../AppProviders.js';
import { BankConnectionStore } from '../../application/bank/BankConnectionStore.js';

vi.mock('../../AppProviders.js', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    put: vi.fn(),
    request: vi.fn(),
  },
}));

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);

const RAW_CONNECTION = {
  id: 'conn-1',
  name: 'PKO BP',
  provider: 'gocardless' as const,
  status: 'active' as const,
  lastSuccessfulAt: '2024-01-10T12:00:00Z',
  expiresAt: null,
  linkedAccountIds: ['acc-1'],
};

describe('BankConnectionStore', () => {
  let store: BankConnectionStore;

  beforeEach(() => {
    vi.clearAllMocks();
    store = new BankConnectionStore();
  });

  describe('fetchConnections()', () => {
    it('fetches connections and populates state', async () => {
      mockGet.mockResolvedValue({ data: [RAW_CONNECTION], status: 200, headers: {} });

      await store.fetchConnections();

      expect(mockGet).toHaveBeenCalledWith('/bank-connections');
      expect(store.connections).toHaveLength(1);
      expect(store.connections[0]?.id).toBe('conn-1');
      expect(store.loading).toBe(false);
    });

    it('parses lastSuccessfulAt to Date', async () => {
      mockGet.mockResolvedValue({ data: [RAW_CONNECTION], status: 200, headers: {} });
      await store.fetchConnections();
      expect(store.connections[0]?.lastSuccessfulAt).toBeInstanceOf(Date);
    });

    it('sets error state on failed fetch', async () => {
      mockGet.mockRejectedValue(new Error('Network error'));
      await store.fetchConnections();
      expect(store.error).toBe('Failed to load bank connections');
      expect(store.loading).toBe(false);
    });

    it('sets loading=true during fetch and false after', async () => {
      let resolveFetch!: (val: unknown) => void;
      mockGet.mockReturnValue(
        new Promise((res) => {
          resolveFetch = res;
        }),
      );
      const promise = store.fetchConnections();
      expect(store.loading).toBe(true);
      resolveFetch({ data: [], status: 200, headers: {} });
      await promise;
      expect(store.loading).toBe(false);
    });
  });

  describe('reconnect()', () => {
    it('calls POST reconnect endpoint and refetches connections', async () => {
      mockPost.mockResolvedValue({ data: {}, status: 200, headers: {} });
      mockGet.mockResolvedValue({ data: [], status: 200, headers: {} });

      await store.reconnect('conn-1');

      expect(mockPost).toHaveBeenCalledWith('/bank-connections/conn-1/reconnect', {});
      expect(mockGet).toHaveBeenCalledWith('/bank-connections');
    });

    it('sets error on reconnect failure', async () => {
      mockPost.mockRejectedValue(new Error('Server error'));
      await store.reconnect('conn-1');
      expect(store.error).toBe('Failed to reconnect');
    });
  });

  describe('expiringConnections computed', () => {
    it('returns connections expiring within 7 days', async () => {
      const soon = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
      mockGet.mockResolvedValue({
        data: [{ ...RAW_CONNECTION, expiresAt: soon }],
        status: 200,
        headers: {},
      });
      await store.fetchConnections();
      expect(store.expiringConnections).toHaveLength(1);
    });

    it('does not include connections expiring after 7 days', async () => {
      const later = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      mockGet.mockResolvedValue({
        data: [{ ...RAW_CONNECTION, expiresAt: later }],
        status: 200,
        headers: {},
      });
      await store.fetchConnections();
      expect(store.expiringConnections).toHaveLength(0);
    });
  });
});
