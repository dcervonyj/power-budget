import { describe, it, expect } from 'vitest';
import { createMock } from '@golevelup/ts-vitest';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { HouseholdId, IsoDate, UserId } from '@power-budget/core';
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
    const db = createMock<NodePgDatabase<typeof schema>>();
    const reader = new DrizzleUnplannedTransactionReader(db);

    await expect(
      reader.list({
        householdId: HouseholdId.of('01900000-b56d-7643-8d0f-31b1680a84b6'),
        ownerUserId: UserId.of('01900000-9dff-7fe4-8508-52c20c8876f6'),
        periodStart: IsoDate.of('2026-10-01'),
        periodEnd: IsoDate.of('2026-10-31'),
        direction: 'expense',
        cursor,
        limit: 10,
      }),
    ).rejects.toThrow(InvalidCursorError);
    expect(db.select).not.toHaveBeenCalled();
  });
});
