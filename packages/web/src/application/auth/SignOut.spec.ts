import { describe, expect, it, vi } from 'vitest';
import type { HttpClient, SecureTokenStore } from '@power-budget/shared-app';
import { SignOut } from './SignOut.js';

function tokenStore(refreshToken: string | null): SecureTokenStore {
  return {
    getAccessToken: vi.fn().mockReturnValue('access'),
    getRefreshToken: vi.fn().mockReturnValue(refreshToken),
    setTokens: vi.fn().mockResolvedValue(undefined),
    clearTokens: vi.fn().mockResolvedValue(undefined),
  };
}

function httpClient(post: HttpClient['post']): HttpClient {
  return {
    request: vi.fn(),
    get: vi.fn(),
    post,
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  };
}

describe('SignOut', () => {
  it('revokes the refresh token, then clears the local tokens', async () => {
    const post = vi.fn().mockResolvedValue({ status: 204, data: undefined, headers: {} });
    const tokens = tokenStore('refresh-1');

    await new SignOut(httpClient(post), tokens).execute();

    expect(post).toHaveBeenCalledWith('/auth/logout', { refreshToken: 'refresh-1' });
    expect(tokens.clearTokens).toHaveBeenCalledOnce();
  });

  it('still clears the local tokens when the server call fails', async () => {
    const post = vi.fn().mockRejectedValue(new Error('offline'));
    const tokens = tokenStore('refresh-1');

    await new SignOut(httpClient(post), tokens).execute();

    expect(tokens.clearTokens).toHaveBeenCalledOnce();
  });

  it('skips the server call without a refresh token', async () => {
    const post = vi.fn();
    const tokens = tokenStore(null);

    await new SignOut(httpClient(post), tokens).execute();

    expect(post).not.toHaveBeenCalled();
    expect(tokens.clearTokens).toHaveBeenCalledOnce();
  });
});
