import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import * as jwt from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';
import type { UserId, HouseholdId } from '@power-budget/core';

export interface JwtRequestUser {
  userId: UserId;
  householdId: HouseholdId | null;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or malformed Authorization header');
    }

    const token = authHeader.slice(7);
    const secret = this.config.get<string>('JWT_SECRET') ?? 'dev-secret-change-me';

    try {
      const payload = jwt.verify(token, secret) as { sub: string; householdId: string | null };
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
