import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import * as jwt from 'jsonwebtoken';
import { APP_CONFIG, type AppConfig } from '../../../config/AppConfig.js';
import { UserId, HouseholdId } from '@power-budget/core';
import { JWT_ALGORITHM } from '../../../infrastructure/auth/jwt-secret.js';

export interface JwtRequestUser {
  userId: UserId;
  householdId: HouseholdId | null;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly secret: string;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.secret = config.jwtSecret;
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or malformed Authorization header');
    }

    const token = authHeader.slice(7);

    try {
      const payload = this.readClaims(
        jwt.verify(token, this.secret, { algorithms: [JWT_ALGORITHM] }),
      );
      Object.assign(request, {
        user: {
          userId: UserId.of(payload.sub),
          householdId: payload.householdId === null ? null : HouseholdId.of(payload.householdId),
        } satisfies JwtRequestUser,
      });

      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private readClaims(decoded: string | jwt.JwtPayload): {
    sub: string;
    householdId: string | null;
  } {
    const householdId: unknown = typeof decoded === 'string' ? undefined : decoded['householdId'];
    if (typeof decoded === 'string' || typeof decoded.sub !== 'string') {
      throw new UnauthorizedException('Invalid or expired token');
    }
    if (householdId !== null && typeof householdId !== 'string') {
      throw new UnauthorizedException('Invalid or expired token');
    }

    return { sub: decoded.sub, householdId };
  }
}
