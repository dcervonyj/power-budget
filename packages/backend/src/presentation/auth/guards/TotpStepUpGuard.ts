import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import type { JwtRequestUser } from './JwtAuthGuard.js';
import { REQUIRE_RECENT_TOTP_KEY } from '../decorators/RequireRecentTotp.js';
import type { RedisTotpStepUpStore } from '../../../infrastructure/auth/RedisTotpStepUpStore.js';

@Injectable()
export class TotpStepUpGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly stepUpStore: RedisTotpStepUpStore,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredMinutes = this.reflector.getAllAndOverride<number | undefined>(
      REQUIRE_RECENT_TOTP_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (requiredMinutes === undefined) {
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest & { user?: JwtRequestUser }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException({
        code: 'requires_totp',
        message: 'TOTP re-verification required',
      });
    }

    const recent = await this.stepUpStore.isRecent(user.userId);
    if (!recent) {
      throw new ForbiddenException({
        code: 'requires_totp',
        message: 'TOTP re-verification required',
      });
    }

    return true;
  }
}
