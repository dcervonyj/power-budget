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
import type { UserId, HouseholdId } from '@power-budget/core';
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
      const payload = jwt.verify(token, this.secret, { algorithms: [JWT_ALGORITHM] }) as {
        sub: string;
        householdId: string | null;
      };
      (request as FastifyRequest & { user: JwtRequestUser }).user = {
        userId: payload.sub as UserId,
        householdId: payload.householdId as HouseholdId | null,
      };

      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
