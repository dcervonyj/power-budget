import { AsyncLocalStorage } from 'node:async_hooks';
import type { HouseholdId, UserId } from '@power-budget/core';

/**
 * The tenancy context a database statement runs under. The ScopedPool turns it into the
 * transaction-local Postgres settings the RLS policies read (migration 0008_rls_tenancy):
 *
 * - `household`: an authenticated request of a household member. RLS shows that household only.
 * - `user`: an authenticated request of a user without a household. Household rows are hidden.
 * - `system`: cross-tenant code (worker jobs, pre-auth lookups). Sets `app.rls_bypass`.
 *   Use it only where the code itself filters by an id it already trusts.
 */
export type DbScope =
  | { readonly kind: 'household'; readonly householdId: HouseholdId; readonly userId: UserId }
  | { readonly kind: 'user'; readonly userId: UserId }
  | { readonly kind: 'system'; readonly reason: string };

/** The values written with `set_config(name, value, true)` at the start of every transaction. */
export interface DbScopeSettings {
  readonly householdId: string;
  readonly userId: string;
  readonly rlsBypass: 'on' | 'off';
}

const storage = new AsyncLocalStorage<DbScope>();

export function runInDbScope<T>(scope: DbScope, fn: () => T): T {
  return storage.run(scope, fn);
}

export function currentDbScope(): DbScope | undefined {
  return storage.getStore();
}

export function toDbScopeSettings(scope: DbScope): DbScopeSettings {
  switch (scope.kind) {
    case 'household':
      return { householdId: scope.householdId, userId: scope.userId, rlsBypass: 'off' };
    case 'user':
      return { householdId: '', userId: scope.userId, rlsBypass: 'off' };
    case 'system':
      return { householdId: '', userId: '', rlsBypass: 'on' };
    default: {
      const unreachable: never = scope;

      return unreachable;
    }
  }
}
