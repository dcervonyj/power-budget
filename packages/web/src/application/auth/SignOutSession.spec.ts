import { beforeEach, describe, expect, it, vi } from 'vitest';

// Node 25+ hides jsdom's localStorage; the session data and the settings storage read it.
const storage = vi.hoisted(() => {
  const items = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    get length(): number {
      return items.size;
    },
    key: (index: number) => [...items.keys()][index] ?? null,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => items.set(key, value),
    removeItem: (key: string) => items.delete(key),
    clear: () => items.clear(),
  });

  return items;
});

import type { HttpClient, SecureTokenStore } from '@power-budget/shared-app';
import type { PlanDto, UserProfileDto } from '@power-budget/shared-app/contract';
import { DashboardStore } from '../dashboard/DashboardStore.js';
import { PlanDashboardStore } from '../dashboard/PlanDashboardStore.js';
import { SettingsStore } from '../settings/SettingsStore.js';
// eslint-disable-next-line no-restricted-imports -- CLN-061 allow-list (temporary, see eslint.layers.js)
import { LocalStorageKeyValueStore } from '../../infrastructure/storage/LocalStorageKeyValueStore.js';
// eslint-disable-next-line no-restricted-imports -- CLN-061 allow-list (temporary, see eslint.layers.js)
import { LocalStorageSessionData } from '../../infrastructure/session/LocalStorageSessionData.js';
import { ClientSession } from './ClientSession.js';
import { SignOut } from './SignOut.js';
import { PLAN } from '../../test/dashboardFixtures.js';
import { catalogueFor } from '../../test/referenceCatalogue.js';
import { deferred } from '../../test/deferred.js';

const mockGet = vi.fn();

const ANNA_PRIVATE: PlanDto = {
  ...PLAN,
  id: 'plan-anna-personal',
  name: 'Anna personal',
  type: 'personal',
  ownerUserId: 'user-anna',
};

const ANNA: UserProfileDto = {
  id: 'user-anna',
  email: 'anna@example.com',
  displayName: 'Anna',
  locale: 'en',
  localePreference: 'en',
  defaultLocale: 'en',
  baseCurrency: 'PLN',
  timezone: 'Europe/Warsaw',
  householdId: 'hh-anna',
};

function tokenStore(): SecureTokenStore {
  return {
    getAccessToken: vi.fn().mockReturnValue('access'),
    getRefreshToken: vi.fn().mockReturnValue('refresh'),
    setTokens: vi.fn().mockResolvedValue(undefined),
    clearTokens: vi.fn().mockResolvedValue(undefined),
  };
}

function httpClient(): HttpClient {
  return {
    request: vi.fn(),
    get: vi.fn(),
    post: vi.fn().mockResolvedValue({ status: 204, data: undefined, headers: {} }),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  };
}

describe('sign-out, then another user in the same tab (FE-BUGS-01)', () => {
  let list: ReturnType<typeof vi.fn<() => Promise<PlanDto[]>>>;
  let planDashboard: PlanDashboardStore;
  let dashboard: DashboardStore;
  let settings: SettingsStore;
  let signOut: SignOut;

  beforeEach(() => {
    storage.clear();
    mockGet.mockReset();
    list = vi.fn<() => Promise<PlanDto[]>>();
    const api = { get: vi.fn(), dashboard: vi.fn(), listItems: vi.fn(), unplanned: vi.fn() };
    planDashboard = new PlanDashboardStore(api, catalogueFor(api, { list: vi.fn() }));
    vi.spyOn(planDashboard, 'load').mockResolvedValue(undefined);
    dashboard = new DashboardStore({ list }, planDashboard);
    settings = new SettingsStore(
      { get: mockGet, post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
      new LocalStorageKeyValueStore(),
    );
    const session = new ClientSession();
    session.register(planDashboard);
    session.register(dashboard);
    session.register(settings);
    session.register(new LocalStorageSessionData());
    signOut = new SignOut(httpClient(), tokenStore(), session);
  });

  it('shows the next user nothing of the previous user', async () => {
    list.mockResolvedValueOnce([ANNA_PRIVATE]);
    mockGet.mockResolvedValueOnce({ status: 200, data: ANNA, headers: {} });
    storage.set('pb_theme', 'dark');
    storage.set('pb_locale', 'uk');
    storage.set('pb_interesting_currencies', '["USD"]');
    storage.set('pb_fx_rates', '{}');
    await dashboard.open();
    await settings.loadProfile();
    expect(dashboard.selectedPlanId).toBe('plan-anna-personal');

    await signOut.execute();

    // Bob signs in; his plan list is still on its way.
    list.mockReturnValueOnce(new Promise<PlanDto[]>(vi.fn()));
    void dashboard.open();
    expect(dashboard.activePlans).toEqual([]);
    expect(dashboard.selectedPlanId).toBeNull();
    expect(settings.profileLoaded).toBe(false);
    expect(settings.userId).toBe('');
    expect(settings.householdId).toBeNull();
    expect(settings.baseCurrency).toBe('EUR');
    expect([...storage.keys()].sort()).toEqual(['pb_locale', 'pb_theme']);

    // Bob has no plans: nothing of Anna's is selected either.
    list.mockResolvedValueOnce([]);
    await dashboard.open();
    expect(dashboard.plansLoaded).toBe(true);
    expect(dashboard.selectedPlanId).toBeNull();
  });

  it("drops the previous user's answers that arrive after sign-out", async () => {
    const plans = deferred<PlanDto[]>();
    const profile = deferred<{
      status: number;
      data: UserProfileDto;
      headers: Record<string, string>;
    }>();
    list.mockReturnValueOnce(plans.promise);
    mockGet.mockReturnValueOnce(profile.promise);
    const opening = dashboard.open();
    const loading = settings.loadProfile();

    await signOut.execute();
    plans.resolve([ANNA_PRIVATE]);
    profile.resolve({ status: 200, data: ANNA, headers: {} });
    await Promise.all([opening, loading]);

    expect(dashboard.activePlans).toEqual([]);
    expect(dashboard.selectedPlanId).toBeNull();
    expect(settings.userId).toBe('');
    expect(settings.profileLoaded).toBe(false);
    expect(storage.has('pb_base_currency')).toBe(false);
  });
});
