import { Injectable } from '@nestjs/common';
import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import type { HouseholdId, UserId } from '@power-budget/core';
import { runInDbScope } from './DbScope.js';
import type { DbScope } from './DbScope.js';

interface ScopedRequest {
  readonly user?: { readonly userId?: UserId; readonly householdId?: HouseholdId | null };
}

/**
 * Runs each HTTP handler inside the DbScope of the authenticated user (`req.user`, set by
 * JwtAuthGuard; guards run before interceptors). Unauthenticated requests get no scope, so
 * RLS hides every tenant row from them. Nest binds `next.handle()` to the async context it is
 * called in, so the scope reaches every await of the handler.
 */
@Injectable()
export class DbScopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): ReturnType<CallHandler['handle']> {
    const scope = this.scopeFor(context);
    if (scope === null) {
      return next.handle();
    }

    return runInDbScope(scope, next.handle.bind(next));
  }

  private scopeFor(context: ExecutionContext): DbScope | null {
    if (context.getType() !== 'http') {
      return null;
    }
    const user = context.switchToHttp().getRequest<ScopedRequest>().user;
    if (!user?.userId) {
      return null;
    }
    if (user.householdId) {
      return { kind: 'household', householdId: user.householdId, userId: user.userId };
    }

    return { kind: 'user', userId: user.userId };
  }
}
