export { ExpoSecureStoreTokenStore } from './tokens/ExpoSecureStoreTokenStore.js';
export { ReactNavigationAdapter } from './navigation/ReactNavigationAdapter.js';
export { AuthService } from './auth/AuthService.js';
export type { LoginParams, RegisterParams, LoginResult } from './auth/AuthService.js';
export { LocaleResolver, LOCALE_STORAGE_KEY } from './locale/index.js';
export type { SupportedLocale } from './locale/index.js';
export {
  BiometricUnlockService,
  biometricUnlockService,
  BIOMETRIC_PREF_KEY,
} from './biometrics/index.js';

import { ApiClient, CategoriesApi, PlansApi } from '@power-budget/shared-app';
import { ExpoSecureStoreTokenStore } from './tokens/ExpoSecureStoreTokenStore.js';
import { resolveApiBaseUrl } from './config/ApiBaseUrl.js';
import { AuthService } from './auth/AuthService.js';

// Expo only inlines the literal `process.env.EXPO_PUBLIC_*` form.
const API_BASE_URL = resolveApiBaseUrl(process.env.EXPO_PUBLIC_API_URL, __DEV__);

export const tokenStore = new ExpoSecureStoreTokenStore();

export const apiClient = new ApiClient(API_BASE_URL, tokenStore);

export const authService = new AuthService(apiClient, tokenStore);

/** The plan endpoints, typed with the generated API contract (shared with web). */
export const plansApi = new PlansApi(apiClient);

/** The category endpoints, typed with the generated API contract (shared with web). */
export const categoriesApi = new CategoriesApi(apiClient);
