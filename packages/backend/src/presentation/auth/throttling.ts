import type { ExecutionContext } from '@nestjs/common';
import type { ThrottlerModuleOptions, ThrottlerOptions } from '@nestjs/throttler';
import type { Redis } from 'ioredis';
import { RedisThrottlerStorage } from '../../infrastructure/auth/RedisThrottlerStorage.js';

/**
 * Rate limits for the credential endpoints (CLN-004 / audit H4) and registration
 * (CLN-033). Two named throttlers apply to every route that uses ThrottlerGuard:
 * - `ip`: per client IP (Fastify `request.ip`, which honours TRUST_PROXY);
 * - `account`: per target account, i.e. the body `email` (login, magic-link
 *   request, register) or the authenticated user (TOTP verify). Skipped when neither
 *   exists (magic-link consume: `ip` here, plus the per-user TOTP attempt
 *   limit in LoginPolicy and the link burn in ConsumeMagicLinkUseCase, CLN-031).
 * Counters live in Redis, so they hold across restarts and API instances.
 */
export const IP_THROTTLER = 'ip';
export const ACCOUNT_THROTTLER = 'account';

const MINUTE_MS = 60_000;

export const AUTH_THROTTLERS: readonly ThrottlerOptions[] = [
  { name: IP_THROTTLER, limit: 20, ttl: MINUTE_MS },
  {
    name: ACCOUNT_THROTTLER,
    limit: 10,
    ttl: 15 * MINUTE_MS,
    getTracker: accountTracker,
    skipIf: hasNoAccountKey,
  },
];

export function buildThrottlerOptions(redis: Redis): ThrottlerModuleOptions {
  return {
    throttlers: [...AUTH_THROTTLERS],
    storage: new RedisThrottlerStorage(redis),
  };
}

interface ThrottledRequest {
  readonly body?: unknown;
  readonly user?: { readonly userId?: string };
}

/** The account a request targets: normalised body email, else the JWT user. Null if none. */
export function accountKey(request: ThrottledRequest): string | null {
  const body = request.body;
  if (typeof body === 'object' && body !== null && 'email' in body) {
    const email = body.email;
    if (typeof email === 'string' && email.trim().length > 0) {
      return `email:${email.trim().toLowerCase()}`;
    }
  }
  const userId = request.user?.userId;
  if (typeof userId === 'string' && userId.length > 0) {
    return `user:${userId}`;
  }

  return null;
}

function accountTracker(request: Record<string, unknown>): string {
  return accountKey(request) ?? '';
}

function hasNoAccountKey(context: ExecutionContext): boolean {
  return accountKey(context.switchToHttp().getRequest<ThrottledRequest>()) === null;
}
