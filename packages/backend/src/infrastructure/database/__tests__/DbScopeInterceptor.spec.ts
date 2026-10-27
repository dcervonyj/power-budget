import { describe, expect, it } from 'vitest';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import type { HouseholdId, UserId } from '@power-budget/core';
import { DbScopeInterceptor } from '../DbScopeInterceptor.js';
import { currentDbScope, toDbScopeSettings, type DbScope } from '../DbScope.js';
import { ScopedPool } from '../ScopedPool.js';

const USER = '01900000-0000-7000-8000-000000000001' as UserId;
const HOUSEHOLD = '01900000-0000-7000-8000-0000000000a1' as HouseholdId;

function httpContext(user: unknown): ExecutionContext {
  const context: Partial<ExecutionContext> = {
    getType: <T extends string>() => 'http' as T,
    switchToHttp: () => ({
      getRequest: <T>() => ({ user }) as T,
      getResponse: <T>() => ({}) as T,
      getNext: <T>() => ({}) as T,
    }),
  };

  return context as ExecutionContext;
}

/** A handler that reports the DbScope it runs in. */
function scopeProbe(): { handler: CallHandler; seen: () => DbScope | undefined } {
  let seen: DbScope | undefined;
  const handler: CallHandler = {
    handle: () => {
      seen = currentDbScope();

      return { subscribe: () => undefined } as never;
    },
  };

  return { handler, seen: () => seen };
}

describe('DbScopeInterceptor', () => {
  const interceptor = new DbScopeInterceptor();

  it('runs a household member in the household scope', () => {
    const probe = scopeProbe();
    interceptor.intercept(httpContext({ userId: USER, householdId: HOUSEHOLD }), probe.handler);

    expect(probe.seen()).toEqual({ kind: 'household', householdId: HOUSEHOLD, userId: USER });
  });

  it('runs a user without a household in the user scope', () => {
    const probe = scopeProbe();
    interceptor.intercept(httpContext({ userId: USER, householdId: null }), probe.handler);

    expect(probe.seen()).toEqual({ kind: 'user', userId: USER });
  });

  it('gives an unauthenticated request no scope', () => {
    const probe = scopeProbe();
    interceptor.intercept(httpContext(undefined), probe.handler);

    expect(probe.seen()).toBeUndefined();
  });
});

describe('DbScope settings', () => {
  it('maps each scope to the RLS settings', () => {
    expect(toDbScopeSettings({ kind: 'household', householdId: HOUSEHOLD, userId: USER })).toEqual({
      householdId: HOUSEHOLD,
      userId: USER,
      rlsBypass: 'off',
    });
    expect(toDbScopeSettings({ kind: 'user', userId: USER })).toEqual({
      householdId: '',
      userId: USER,
      rlsBypass: 'off',
    });
    expect(toDbScopeSettings({ kind: 'system', reason: 'test' })).toEqual({
      householdId: '',
      userId: '',
      rlsBypass: 'on',
    });
  });

  it('writes session-level, escaped set_config calls', () => {
    const sql = ScopedPool.settingsSql({
      kind: 'household',
      householdId: "x'; DROP TABLE users; --" as HouseholdId,
      userId: USER,
    });

    expect(sql).toBe(
      "SELECT set_config('app.household_id', 'x''; DROP TABLE users; --', false), " +
        `set_config('app.user_id', '${USER}', false), ` +
        "set_config('app.rls_bypass', 'off', false)",
    );
  });

  it('resets every setting for a statement without a scope', () => {
    expect(ScopedPool.settingsSql(null)).toBe(
      "SELECT set_config('app.household_id', '', false), " +
        "set_config('app.user_id', '', false), " +
        "set_config('app.rls_bypass', 'off', false)",
    );
  });
});
