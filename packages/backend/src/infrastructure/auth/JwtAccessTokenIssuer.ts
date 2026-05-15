import * as jwt from 'jsonwebtoken';
import { Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { UserId, HouseholdId } from '@power-budget/core';
import type { JwtAccessTokenIssuer } from '../../domain/auth/ports.js';

export class JwtAccessTokenIssuerAdapter implements JwtAccessTokenIssuer {
  private readonly secret: string;

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {
    this.secret = config.get<string>('JWT_SECRET') ?? 'dev-secret-change-me';
  }

  issue(payload: { userId: UserId; householdId: HouseholdId | null }): string {
    return jwt.sign({ sub: payload.userId, householdId: payload.householdId }, this.secret, {
      expiresIn: '15m',
    });
  }
}
