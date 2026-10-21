import * as jwt from 'jsonwebtoken';
import { Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { UserId, HouseholdId } from '@power-budget/core';
import type { JwtAccessTokenIssuer } from '../../domain/auth/ports.js';
import { JWT_ALGORITHM, resolveJwtSecret } from './jwt-secret.js';

export class JwtAccessTokenIssuerAdapter implements JwtAccessTokenIssuer {
  private readonly secret: string;

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {
    this.secret = resolveJwtSecret(
      config.get<string>('JWT_SECRET'),
      config.get<string>('NODE_ENV'),
    );
  }

  issue(payload: { userId: UserId; householdId: HouseholdId | null }): string {
    return jwt.sign({ sub: payload.userId, householdId: payload.householdId }, this.secret, {
      algorithm: JWT_ALGORITHM,
      expiresIn: '15m',
    });
  }
}
