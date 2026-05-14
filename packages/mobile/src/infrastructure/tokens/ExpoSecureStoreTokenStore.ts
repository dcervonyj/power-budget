import * as SecureStore from 'expo-secure-store';
import type { SecureTokenStore } from '@power-budget/shared-app/infrastructure';

const ACCESS_KEY = 'pb_access_token';
const REFRESH_KEY = 'pb_refresh_token';

export class ExpoSecureStoreTokenStore implements SecureTokenStore {
  getAccessToken(): string | null {
    // Note: SecureStore.getItem is async in Expo SDK 45+.
    // For synchronous interface compliance, use getItemAsync in React hooks.
    // This synchronous getter returns null as fallback; use getAccessTokenAsync for actual reads.
    return null;
  }

  getRefreshToken(): string | null {
    return null;
  }

  async getAccessTokenAsync(): Promise<string | null> {
    return SecureStore.getItemAsync(ACCESS_KEY);
  }

  async getRefreshTokenAsync(): Promise<string | null> {
    return SecureStore.getItemAsync(REFRESH_KEY);
  }

  async setTokens(accessToken: string, refreshToken: string): Promise<void> {
    await SecureStore.setItemAsync(ACCESS_KEY, accessToken);
    await SecureStore.setItemAsync(REFRESH_KEY, refreshToken);
  }

  async clearTokens(): Promise<void> {
    await SecureStore.deleteItemAsync(ACCESS_KEY);
    await SecureStore.deleteItemAsync(REFRESH_KEY);
  }
}
