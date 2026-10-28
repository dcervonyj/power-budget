import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { DrizzleAuditEventRepository } from '../DrizzleAuditEventRepository.js';
import { HouseholdId, UserId } from '@power-budget/core';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from '../../../../drizzle/schema.js';

/** Drizzle's query builder has no public constructor, so the spec fakes only the chain the repository calls. */
function fakeDb(chain: object): NodePgDatabase<typeof schema> {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return chain as NodePgDatabase<typeof schema>;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const NOW = new Date('2026-10-28T10:00:00.000Z');

describe('DrizzleAuditEventRepository', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: NOW });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('insertAuditEvent calls db.insert with correct shape', async () => {
    const insertValues = vi.fn().mockResolvedValue([]);
    const db = fakeDb({
      insert: vi.fn().mockReturnValue({ values: insertValues }),
    });

    const repo = new DrizzleAuditEventRepository(db);
    await repo.insertAuditEvent({
      householdId: HouseholdId.of('01900000-3a12-768a-84e1-7ff1aae8835b'),
      actorId: UserId.of('01900000-8ccf-7eb7-88be-5e5b937e1768'),
      subjectType: 'plan',
      subjectId: 'p-1',
      action: 'create',
      meta: { extra: 'info' },
    });

    expect(db.insert).toHaveBeenCalledTimes(1);
    expect(insertValues).toHaveBeenCalledTimes(1);
    expect(insertValues.mock.calls[0]?.[0]).toEqual({
      id: expect.stringMatching(UUID_PATTERN),
      householdId: '01900000-3a12-768a-84e1-7ff1aae8835b',
      actorUserId: '01900000-8ccf-7eb7-88be-5e5b937e1768',
      action: 'create',
      subjectType: 'plan',
      subjectId: 'p-1',
      context: { extra: 'info' },
      at: NOW,
    });
  });

  it('listByHousehold returns empty page when no rows', async () => {
    const db = fakeDb({
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    });

    const repo = new DrizzleAuditEventRepository(db);
    const result = await repo.listByHousehold(
      {},
      { householdId: HouseholdId.of('01900000-3a12-768a-84e1-7ff1aae8835b') },
    );

    expect(result).toEqual({ items: [], nextCursor: null, hasMore: false });
  });

  it('record() (AuditLogPort compat) delegates to insertAuditEvent', async () => {
    const insertValues = vi.fn().mockResolvedValue([]);
    const db = fakeDb({
      insert: vi.fn().mockReturnValue({ values: insertValues }),
    });

    const repo = new DrizzleAuditEventRepository(db);
    await repo.record({
      householdId: HouseholdId.of('01900000-3a12-768a-84e1-7ff1aae8835b'),
      actorUserId: UserId.of('01900000-0be0-7d09-88f5-537d3c8c6168'),
      action: 'update',
      subjectType: 'plan',
      subjectId: 'p-2',
    });

    expect(insertValues).toHaveBeenCalledTimes(1);
    expect(insertValues.mock.calls[0]?.[0]).toEqual({
      id: expect.stringMatching(UUID_PATTERN),
      householdId: '01900000-3a12-768a-84e1-7ff1aae8835b',
      actorUserId: '01900000-0be0-7d09-88f5-537d3c8c6168',
      action: 'update',
      subjectType: 'plan',
      subjectId: 'p-2',
      context: {},
      at: NOW,
    });
  });
});
