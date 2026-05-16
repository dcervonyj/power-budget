import { describe, it, expect, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { RefreshTokenStore } from '../../domain/ports.js';
import { LogoutUseCase } from './LogoutUseCase.js';

describe('LogoutUseCase', () => {
  let refreshTokenStore: ReturnType<typeof mock<RefreshTokenStore>>;
  let useCase: LogoutUseCase;

  beforeEach(() => {
    refreshTokenStore = mock<RefreshTokenStore>();
    useCase = new LogoutUseCase(refreshTokenStore);
  });

  it('revokes the refresh token', async () => {
    refreshTokenStore.revoke.mockResolvedValue(undefined);

    await useCase.execute({ refreshToken: 'token-to-revoke' });

    expect(refreshTokenStore.revoke).toHaveBeenCalledWith('token-to-revoke');
  });
});
