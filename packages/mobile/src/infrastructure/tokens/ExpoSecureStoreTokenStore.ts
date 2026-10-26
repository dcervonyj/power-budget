import * as SecureStore from 'expo-secure-store';
import type { SecureTokenStore } from '@power-budget/shared-app/infrastructure';

const ACCESS_KEY = 'pb_access_token';
const REFRESH_KEY = 'pb_refresh_token';

export type TokenStoreListener = () => void;

/**
 * Tokens live in SecureStore, whose reads are async, while SecureTokenStore (used by the
 * API client interceptors) is sync. So the tokens are mirrored in memory: `load()` fills the
 * cache once at startup (before the navigator renders), writes update memory first and then
 * persist. Subscribers are told whenever the signed-in state may have changed (login, logout,
 * refresh failure) so navigation can react.
 */
export class ExpoSecureStoreTokenStore implements SecureTokenStore {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private readonly listeners = new Set<TokenStoreListener>();

  getAccessToken(): string | null {
    return this.accessToken;
  }

  getRefreshToken(): string | null {
    return this.refreshToken;
  }

  isAuthenticated(): boolean {
    return this.accessToken !== null;
  }

  async load(): Promise<void> {
    this.accessToken = await SecureStore.getItemAsync(ACCESS_KEY);
    this.refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
    this.notify();
  }

  async setTokens(accessToken: string, refreshToken: string): Promise<void> {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.notify();
    await SecureStore.setItemAsync(ACCESS_KEY, accessToken);
    await SecureStore.setItemAsync(REFRESH_KEY, refreshToken);
  }

  async clearTokens(): Promise<void> {
    this.accessToken = null;
    this.refreshToken = null;
    this.notify();
    await SecureStore.deleteItemAsync(ACCESS_KEY);
    await SecureStore.deleteItemAsync(REFRESH_KEY);
  }

  subscribe(listener: TokenStoreListener): () => void {
    this.listeners.add(listener);

    return this.unsubscribe.bind(this, listener);
  }

  private unsubscribe(listener: TokenStoreListener): void {
    this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}
