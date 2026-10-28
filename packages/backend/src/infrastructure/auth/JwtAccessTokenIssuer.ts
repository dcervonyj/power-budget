import * as jwt from 'jsonwebtoken';
import { Inject } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../config/AppConfig.js';
import type { UserId, HouseholdId } from '@power-budget/core';
import type { JwtAccessTokenIssuer } from '../../domain/auth/ports.js';
import { JWT_ALGORITHM } from './jwt-secret.js';

export class JwtAccessTokenIssuerAdapter implements JwtAccessTokenIssuer {
  private readonly secret: string;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.secret = config.jwtSecret;
  }

  issue(payload: { userId: UserId; householdId: HouseholdId | null }): string {
    return jwt.sign({ sub: payload.userId, householdId: payload.householdId }, this.secret, {
      algorithm: JWT_ALGORITHM,
      expiresIn: '15m',
    });
  }
}
