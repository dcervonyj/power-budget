import { describe, it, expect, beforeEach } from 'vitest';
import { createMock } from '@golevelup/ts-vitest';
import type { RefreshTokenStore } from '../../../domain/auth/ports.js';
import { LogoutUseCase } from './LogoutUseCase.js';

describe('LogoutUseCase', () => {
  let refreshTokenStore: ReturnType<typeof createMock<RefreshTokenStore>>;
  let useCase: LogoutUseCase;

  beforeEach(() => {
    refreshTokenStore = createMock<RefreshTokenStore>();
    useCase = new LogoutUseCase(refreshTokenStore);
  });

  it('revokes the refresh token', async () => {
    refreshTokenStore.revoke.mockResolvedValue(undefined);

    await useCase.execute({ refreshToken: 'token-to-revoke' });

    expect(refreshTokenStore.revoke).toHaveBeenCalledWith('token-to-revoke');
  });
});
