export { ExpoSecureStoreTokenStore } from './tokens/ExpoSecureStoreTokenStore.js';
export { ReactNavigationAdapter } from './navigation/ReactNavigationAdapter.js';
export { AuthService } from './auth/AuthService.js';
export type { LoginParams, RegisterParams, LoginResult } from './auth/AuthService.js';
export { LocaleResolver, LOCALE_STORAGE_KEY } from './locale/index.js';
export type { SupportedLocale } from './locale/index.js';
export { PlanService } from './plans/index.js';
export type {
  Plan,
  PlannedItem,
  PlanType,
  PlanPeriodKind,
  PlannedDirection,
  PlanPeriod,
  CreatePlanDto,
  UpdatePlanDto,
} from './plans/index.js';

import { ApiClient } from '@power-budget/shared-app';
import { ExpoSecureStoreTokenStore } from './tokens/ExpoSecureStoreTokenStore.js';
import { AuthService } from './auth/AuthService.js';
import { PlanService } from './plans/index.js';

const API_BASE_URL = 'http://localhost:3000';

export const tokenStore = new ExpoSecureStoreTokenStore();

export const apiClient = new ApiClient(API_BASE_URL, tokenStore);

export const authService = new AuthService(apiClient, tokenStore);

export const planService = new PlanService(apiClient);
