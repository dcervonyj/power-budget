import type { HttpClient, SecureTokenStore } from '@power-budget/shared-app';
import type { LogoutDto } from '@power-budget/shared-app/contract';

/**
 * Ends the session: revokes the refresh token on the server, then forgets both
 * tokens locally. The local tokens are cleared even when the server call fails
 * (offline, token already expired), so the user is never stuck signed in.
 */
export class SignOut {
  constructor(
    private readonly http: HttpClient,
    private readonly tokens: SecureTokenStore,
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
    }
  }
}
