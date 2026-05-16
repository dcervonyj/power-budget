import type { RefreshTokenStore } from '../../domain/ports.js';
import type { LogoutInput } from '../models/index.js';
export type { LogoutInput };

export class LogoutUseCase {
  constructor(private readonly refreshTokenStore: RefreshTokenStore) {}

  async execute(input: LogoutInput): Promise<void> {
    await this.refreshTokenStore.revoke(input.refreshToken);
  }
}
