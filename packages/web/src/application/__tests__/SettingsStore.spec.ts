import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from '../../AppProviders.js';

vi.mock('../../AppProviders.js', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    put: vi.fn(),
    request: vi.fn(),
  },
}));

// Must import after mocking
const { SettingsStore } = await import('../../application/settings/SettingsStore.js');

const mockGet = vi.mocked(apiClient.get);
const mockRequest = vi.mocked(apiClient.request);
const mockDelete = vi.mocked(apiClient.delete);

describe('SettingsStore', () => {
  let store: InstanceType<typeof SettingsStore>;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    store = new SettingsStore();
  });

  describe('loadProfile()', () => {
    it('fetches /users/me and updates email and householdId', async () => {
      mockGet.mockResolvedValue({
        data: { email: 'alice@example.com', householdId: 'hh-1', displayName: 'Alice' },
        status: 200,
        headers: {},
      });

      await store.loadProfile();

      expect(mockGet).toHaveBeenCalledWith('/users/me');
      expect(store.email).toBe('alice@example.com');
      expect(store.householdId).toBe('hh-1');
      expect(store.profileLoaded).toBe(true);
    });

    it('sets profileLoaded even when fetch fails', async () => {
      mockGet.mockRejectedValue(new Error('Network error'));
      await store.loadProfile();
      expect(store.profileLoaded).toBe(true);
    });
  });

  describe('saveProfile()', () => {
    it('calls PATCH /users/me with displayName', async () => {
      mockRequest.mockResolvedValue({ data: {}, status: 204, headers: {} });
      store.setDisplayName('Bob');

      await store.saveProfile();

      expect(mockRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          url: '/users/me',
          method: 'PATCH',
          body: expect.objectContaining({ displayName: 'Bob' }),
        }),
      );
    });

    it('sets isSaving=false after completion', async () => {
      mockRequest.mockResolvedValue({ data: {}, status: 204, headers: {} });
      await store.saveProfile();
      expect(store.isSaving).toBe(false);
    });
  });

  describe('saveCurrency()', () => {
    it('saves baseCurrency and interestingCurrencies to localStorage', async () => {
      mockRequest.mockResolvedValue({ data: {}, status: 204, headers: {} });
      store.setBaseCurrency('PLN');

      await store.saveCurrency();

      expect(localStorage.getItem('pb_base_currency')).toBe('PLN');
    });
  });

  describe('deleteAccount()', () => {
    it('calls DELETE /households/{householdId}', async () => {
      mockDelete.mockResolvedValue({ data: {}, status: 204, headers: {} });
      store['householdId'] = 'hh-123';

      await store.deleteAccount();

      expect(mockDelete).toHaveBeenCalledWith('/households/hh-123');
    });
  });

  describe('setters', () => {
    it('setBaseCurrency updates baseCurrency', () => {
      store.setBaseCurrency('USD');
      expect(store.baseCurrency).toBe('USD');
    });

    it('setWeeklyDigest updates weeklyDigest', () => {
      store.setWeeklyDigest(true);
      expect(store.weeklyDigest).toBe(true);
    });

    it('setOverBudgetThreshold updates threshold', () => {
      store.setOverBudgetThreshold(90);
      expect(store.overBudgetThreshold).toBe(90);
    });

    it('toggleInterestingCurrency adds currency when not present', () => {
      store.toggleInterestingCurrency('USD');
      expect(store.interestingCurrencies).toContain('USD');
    });

    it('toggleInterestingCurrency removes currency when already present', () => {
      store.toggleInterestingCurrency('USD');
      store.toggleInterestingCurrency('USD');
      expect(store.interestingCurrencies).not.toContain('USD');
    });
  });
});
