import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));

import * as SecureStore from 'expo-secure-store';
import { ExpoSecureStoreTokenStore } from '../ExpoSecureStoreTokenStore.js';

const mockGetItemAsync = vi.mocked(SecureStore.getItemAsync);
const mockSetItemAsync = vi.mocked(SecureStore.setItemAsync);
const mockDeleteItemAsync = vi.mocked(SecureStore.deleteItemAsync);

describe('ExpoSecureStoreTokenStore', () => {
  let store: ExpoSecureStoreTokenStore;

  beforeEach(() => {
    vi.clearAllMocks();
    store = new ExpoSecureStoreTokenStore();
  });

  it('getAccessToken returns null (sync fallback)', () => {
    expect(store.getAccessToken()).toBeNull();
  });

  it('getRefreshToken returns null (sync fallback)', () => {
    expect(store.getRefreshToken()).toBeNull();
  });

  it('getAccessTokenAsync reads from secure store', async () => {
    mockGetItemAsync.mockResolvedValue('access-token-123');
    const result = await store.getAccessTokenAsync();
    expect(result).toBe('access-token-123');
    expect(mockGetItemAsync).toHaveBeenCalledWith('pb_access_token');
  });

  it('getRefreshTokenAsync reads from secure store', async () => {
    mockGetItemAsync.mockResolvedValue('refresh-token-456');
    const result = await store.getRefreshTokenAsync();
    expect(result).toBe('refresh-token-456');
    expect(mockGetItemAsync).toHaveBeenCalledWith('pb_refresh_token');
  });

  it('setTokens stores both access and refresh tokens', async () => {
    mockSetItemAsync.mockResolvedValue(undefined);
    await store.setTokens('acc', 'ref');
    expect(mockSetItemAsync).toHaveBeenCalledWith('pb_access_token', 'acc');
    expect(mockSetItemAsync).toHaveBeenCalledWith('pb_refresh_token', 'ref');
  });

  it('clearTokens deletes both tokens from secure store', async () => {
    mockDeleteItemAsync.mockResolvedValue(undefined);
    await store.clearTokens();
    expect(mockDeleteItemAsync).toHaveBeenCalledWith('pb_access_token');
    expect(mockDeleteItemAsync).toHaveBeenCalledWith('pb_refresh_token');
  });
});
