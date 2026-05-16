import { Injectable } from '@nestjs/common';
import type { NestMiddleware } from '@nestjs/common';
import type { HouseholdId, UserId } from '@power-budget/core';

export interface RlsContext {
  readonly userId: UserId | null;
  readonly householdId: HouseholdId | null;
}

/**
 * Extracts the authenticated user's ids from `req.user` (populated by
 * JwtAuthGuard) and attaches an `rlsContext` object to the request.
 *
 * Downstream infrastructure code (e.g. a transaction wrapper) can read
 * `req.rlsContext` and issue `SET LOCAL app.household_id = '...'` inside
 * each DB transaction to activate the production RLS policies defined in
 * `drizzle/migrations/0003_rls_policies.sql`.
 *
 * Note: `SET LOCAL` is session-scoped to the current transaction, so the
 * actual SQL must be executed inside a transaction block — this middleware
 * only provides the values; it does not touch the DB connection.
 */
@Injectable()
export class RlsMiddleware implements NestMiddleware {
  use(
    req: { user?: { userId?: UserId; householdId?: HouseholdId | null }; rlsContext?: RlsContext },
    _res: unknown,
    next: () => void,
  ): void {
    const user = req.user;
    req.rlsContext = {
      userId: user?.userId ?? null,
      householdId: user?.householdId ?? null,
    };
    next();
  }
}
