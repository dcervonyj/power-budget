import { describe, it, expect } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { HouseholdId, IsoDate, UserId } from '@power-budget/core';
import { DrizzleUnplannedTransactionReader } from './DrizzleUnplannedTransactionReader.js';
import { InvalidCursorError } from '../../domain/transactions/errors.js';
import type * as schema from '../../../drizzle/schema.js';

describe('DrizzleUnplannedTransactionReader', () => {
  it.each([
    'not a cursor!',
    Buffer.from('2026-10-01|nope').toString('base64url'),
    '@@',
    '',
    Buffer.from(`2026-02-30|0197c0de-0000-7000-8000-000000000001`).toString('base64url'),
  ])('rejects the forged cursor %s with InvalidCursorError before querying', async (cursor) => {
    const db = mock<NodePgDatabase<typeof schema>>();
    const reader = new DrizzleUnplannedTransactionReader(db);

    await expect(
      reader.list({
        householdId: 'hh-1' as HouseholdId,
        ownerUserId: 'user-1' as UserId,
        periodStart: '2026-10-01' as IsoDate,
        periodEnd: '2026-10-31' as IsoDate,
        direction: 'expense',
        cursor,
        limit: 10,
      }),
    ).rejects.toThrow(InvalidCursorError);
    expect(db.select).not.toHaveBeenCalled();
  });
});
