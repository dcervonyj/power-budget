import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import type { JwtRequestUser } from './JwtAuthGuard.js';
import { REQUIRE_RECENT_TOTP_KEY } from '../decorators/RequireRecentTotp.js';
import type { TotpSecretRepository, TotpStepUpStore } from '../../../domain/auth/ports.js';
// Value imports: Nest instantiates guards named in @UseGuards itself, so the
// constructor tokens must exist at runtime (explicit @Inject also covers
// vitest, whose esbuild transform emits no decorator metadata).
import { RedisTotpStepUpStore } from '../../../infrastructure/auth/RedisTotpStepUpStore.js';
import { DrizzleTotpSecretRepository } from '../../../infrastructure/auth/DrizzleTotpSecretRepository.js';

/**
 * Enforces @RequireRecentTotp: the caller must have verified a TOTP code
 * recently (POST /auth/totp/verify or a login with a code). A caller without
 * enabled TOTP gets `requires_totp_enrollment` so the client can send them
 * to enrolment instead of asking for a code they cannot have.
 */
@Injectable()
export class TotpStepUpGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(RedisTotpStepUpStore) private readonly stepUpStore: TotpStepUpStore,
    @Inject(DrizzleTotpSecretRepository) private readonly totpSecretRepo: TotpSecretRepository,
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
      throw requiresTotp();
    }

    if (await this.stepUpStore.isRecent(user.userId)) {
      return true;
    }

    const secret = await this.totpSecretRepo.findByUser(user.userId);
    if (secret === null || secret.verifiedAt === null) {
      throw new ForbiddenException({
        code: 'requires_totp_enrollment',
        message: 'TOTP enrollment required',
      });
    }

    throw requiresTotp();
  }
}

function requiresTotp(): ForbiddenException {
  return new ForbiddenException({
    code: 'requires_totp',
    message: 'TOTP re-verification required',
  });
}
