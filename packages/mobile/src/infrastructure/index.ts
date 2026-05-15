export { ExpoSecureStoreTokenStore } from './tokens/ExpoSecureStoreTokenStore.js';
export { ReactNavigationAdapter } from './navigation/ReactNavigationAdapter.js';
export { AuthService } from './auth/AuthService.js';
export type { LoginParams, RegisterParams, LoginResult } from './auth/AuthService.js';

import { ApiClient } from '@power-budget/shared-app';
import { ExpoSecureStoreTokenStore } from './tokens/ExpoSecureStoreTokenStore.js';
import { AuthService } from './auth/AuthService.js';

const API_BASE_URL = 'http://localhost:3000';

export const tokenStore = new ExpoSecureStoreTokenStore();

export const apiClient = new ApiClient(API_BASE_URL, tokenStore);

export const authService = new AuthService(apiClient, tokenStore);
