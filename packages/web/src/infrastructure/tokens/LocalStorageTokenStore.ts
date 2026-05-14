import type { SecureTokenStore } from '@power-budget/shared-app/infrastructure';

export class LocalStorageTokenStore implements SecureTokenStore {
  private static ACCESS_KEY = 'pb_access_token';
  private static REFRESH_KEY = 'pb_refresh_token';

  getAccessToken(): string | null {
    return localStorage.getItem(LocalStorageTokenStore.ACCESS_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(LocalStorageTokenStore.REFRESH_KEY);
  }

  async setTokens(accessToken: string, refreshToken: string): Promise<void> {
    localStorage.setItem(LocalStorageTokenStore.ACCESS_KEY, accessToken);
    localStorage.setItem(LocalStorageTokenStore.REFRESH_KEY, refreshToken);
  }

  async clearTokens(): Promise<void> {
    localStorage.removeItem(LocalStorageTokenStore.ACCESS_KEY);
    localStorage.removeItem(LocalStorageTokenStore.REFRESH_KEY);
  }
}
