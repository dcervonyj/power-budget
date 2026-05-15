import type { RefreshTokenStore } from '../../../domain/auth/ports.js';

export interface LogoutInput {
  readonly refreshToken: string;
}

export class LogoutUseCase {
  constructor(private readonly refreshTokenStore: RefreshTokenStore) {}

  async execute(input: LogoutInput): Promise<void> {
    await this.refreshTokenStore.revoke(input.refreshToken);
  }
}
