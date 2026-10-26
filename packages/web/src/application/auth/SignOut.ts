import type { HttpClient, SecureTokenStore } from '@power-budget/shared-app';
import type { LogoutDto } from '@power-budget/shared-app/contract';
import type { ClientSession } from './ClientSession.js';

/**
 * Ends the session: revokes the refresh token on the server, then forgets both
 * tokens and every store's data locally. The local state is cleared even when the
 * server call fails (offline, token already expired), so the user is never stuck
 * signed in and the next user in the tab sees nothing of this one.
 */
export class SignOut {
  constructor(
    private readonly http: HttpClient,
    private readonly tokens: SecureTokenStore,
    private readonly session: ClientSession,
  ) {}

  async execute(): Promise<void> {
    const refreshToken = this.tokens.getRefreshToken();
    try {
      if (refreshToken) {
        const body: LogoutDto = { refreshToken };
        await this.http.post('/auth/logout', body);
      }
    } catch {
      // Revocation is best effort; the local session ends regardless.
    } finally {
      await this.tokens.clearTokens();
      this.session.end();
    }
  }
}
