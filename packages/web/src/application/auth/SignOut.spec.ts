import { describe, expect, it, vi } from 'vitest';
import { createMock } from '@golevelup/ts-vitest';
import type { HttpClient, SecureTokenStore } from '@power-budget/shared-app';
import { ClientSession } from './ClientSession.js';
import { SignOut } from './SignOut.js';

function tokenStore(refreshToken: string | null): SecureTokenStore {
  return createMock<SecureTokenStore>({
    getAccessToken: vi.fn().mockReturnValue('access'),
    getRefreshToken: vi.fn().mockReturnValue(refreshToken),
  });
}

function clientSession(): ClientSession {
  const session = new ClientSession();
  vi.spyOn(session, 'end');

  return session;
}

function httpClient(post: HttpClient['post']): HttpClient {
  return createMock<HttpClient>({ post });
}

describe('SignOut', () => {
  it('revokes the refresh token, then clears the local tokens', async () => {
    const post = vi.fn().mockResolvedValue({ status: 204, data: undefined, headers: {} });
    const tokens = tokenStore('refresh-1');
    const session = clientSession();

    await new SignOut(httpClient(post), tokens, session).execute();

    expect(post).toHaveBeenCalledWith('/auth/logout', { refreshToken: 'refresh-1' });
    expect(tokens.clearTokens).toHaveBeenCalledOnce();
    expect(session.end).toHaveBeenCalledOnce();
  });

  it('still clears the local tokens when the server call fails', async () => {
    const post = vi.fn().mockRejectedValue(new Error('offline'));
    const tokens = tokenStore('refresh-1');
    const session = clientSession();

    await new SignOut(httpClient(post), tokens, session).execute();

    expect(tokens.clearTokens).toHaveBeenCalledOnce();
    expect(session.end).toHaveBeenCalledOnce();
  });

  it('skips the server call without a refresh token', async () => {
    const post = vi.fn();
    const tokens = tokenStore(null);
    const session = clientSession();

    await new SignOut(httpClient(post), tokens, session).execute();

    expect(post).not.toHaveBeenCalled();
    expect(tokens.clearTokens).toHaveBeenCalledOnce();
    expect(session.end).toHaveBeenCalledOnce();
  });
});
