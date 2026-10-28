import { CategoriesApi, HouseholdsApi, PlansApi } from '@power-budget/shared-app';
import { clientSession } from './application/auth/ClientSession.js';
import { SignOut } from './application/auth/SignOut.js';
import { BankConnectionStore } from './application/bank/BankConnectionStore.js';
import { ReferenceCatalogue } from './application/catalogue/ReferenceCatalogue.js';
import { DashboardStore } from './application/dashboard/DashboardStore.js';
import { PlanDashboardStore } from './application/dashboard/PlanDashboardStore.js';
import { HouseholdCategoryStore } from './application/household/HouseholdCategoryStore.js';
import { HouseholdStore } from './application/household/HouseholdStore.js';
import { SettingsStore } from './application/settings/SettingsStore.js';
import { ShellStore } from './application/shell/ShellStore.js';
import { BulkTransactionActions } from './application/transactions/BulkTransactionActions.js';
import { createApiClient } from './infrastructure/api/ApiClient.js';
import { HttpShellApi } from './infrastructure/api/HttpShellApi.js';
import { ReactRouterNavigationAdapter } from './infrastructure/navigation/ReactRouterNavigationAdapter.js';
import { LocalStorageSessionData } from './infrastructure/session/LocalStorageSessionData.js';
import { LocalStorageKeyValueStore } from './infrastructure/storage/LocalStorageKeyValueStore.js';
import { LocalStorageTokenStore } from './infrastructure/tokens/LocalStorageTokenStore.js';

/**
 * The web composition root: the one place that creates the app's singletons and hands each
 * store its dependencies through its constructor. Plain TypeScript (no React), so the
 * stores stay free of the UI layer and tests build them with fakes instead of module mocks.
 */

export const tokenStore = new LocalStorageTokenStore();
export const navigationAdapter = new ReactRouterNavigationAdapter();
clientSession.register(new LocalStorageSessionData());

/**
 * The API client gave up on the session (refresh failed, tokens already cleared):
 * forget the user's data the same way sign-out does, then go to the login screen,
 * which brings the user back to the current screen after logging in again.
 */
export function endSession(): void {
  clientSession.end();
  navigationAdapter.replace({ type: 'auth/login', returnToCurrent: true });
}

export const apiClient = createApiClient(tokenStore, endSession);
export const signOut = new SignOut(apiClient, tokenStore, clientSession);
export const bulkTransactionActions = new BulkTransactionActions(apiClient);
export const plansApi = new PlansApi(apiClient);
export const categoriesApi = new CategoriesApi(apiClient);
export const householdsApi = new HouseholdsApi(apiClient);

/** The app's catalogue; sign-out clears it with the other session stores. */
export const referenceCatalogue = new ReferenceCatalogue(plansApi, categoriesApi);
export const settingsStore = new SettingsStore(apiClient, new LocalStorageKeyValueStore());
export const bankConnectionStore = new BankConnectionStore(apiClient);
export const householdCategoryStore = new HouseholdCategoryStore(apiClient);
export const householdStore = new HouseholdStore(householdsApi, plansApi);
export const planDashboardStore = new PlanDashboardStore(plansApi, referenceCatalogue);
export const dashboardStore = new DashboardStore(plansApi, planDashboardStore);
/** The app shell's store, wired to the API; forgets everything when the session ends. */
export const appShellStore = new ShellStore(new HttpShellApi(apiClient, householdsApi));

clientSession.register(referenceCatalogue);
clientSession.register(settingsStore);
clientSession.register(bankConnectionStore);
clientSession.register(householdCategoryStore);
clientSession.register(householdStore);
clientSession.register(planDashboardStore);
clientSession.register(dashboardStore);
clientSession.register(appShellStore);
