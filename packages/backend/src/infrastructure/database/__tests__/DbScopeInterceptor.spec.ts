import { describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import type { HttpArgumentsHost } from '@nestjs/common/interfaces';
import { HouseholdId, UserId } from '@power-budget/core';
import { DbScopeInterceptor } from '../DbScopeInterceptor.js';
import { currentDbScope, toDbScopeSettings, type DbScope } from '../DbScope.js';
import { ScopedPool } from '../ScopedPool.js';

const USER = UserId.of('01900000-0000-7000-8000-000000000001');
const HOUSEHOLD = HouseholdId.of('01900000-0000-7000-8000-0000000000a1');

function httpContext(user: unknown): ExecutionContext {
  return mock<ExecutionContext>({
    getType: vi.fn().mockReturnValue('http'),
    switchToHttp: vi.fn().mockReturnValue(
      mock<HttpArgumentsHost>({
        getRequest: vi.fn().mockReturnValue({ user }),
      }),
    ),
  });
}

/** A handler that reports the DbScope it runs in. */
function scopeProbe(): { handler: CallHandler; seen: () => DbScope | undefined } {
  let seen: DbScope | undefined;
  const handler: CallHandler = {
    handle: () => {
      seen = currentDbScope();

      return mock<ReturnType<CallHandler['handle']>>();
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
      // The point of this spec is that a hostile id is escaped; the brand constructor would refuse it.
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
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
