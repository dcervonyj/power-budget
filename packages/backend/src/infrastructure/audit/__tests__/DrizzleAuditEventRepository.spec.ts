import { describe, it, expect, vi } from 'vitest';
import { DrizzleAuditEventRepository } from '../DrizzleAuditEventRepository.js';
import type { HouseholdId, UserId } from '@power-budget/core';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from '../../../../drizzle/schema.js';

describe('DrizzleAuditEventRepository', () => {
  it('insertAuditEvent calls db.insert with correct shape', async () => {
    const insertValues = vi.fn().mockResolvedValue([]);
    const db = {
      insert: vi.fn().mockReturnValue({ values: insertValues }),
    } as unknown as NodePgDatabase<typeof schema>;

    const repo = new DrizzleAuditEventRepository(db);
    await repo.insertAuditEvent({
      householdId: 'h-1' as HouseholdId,
      actorId: 'u-1' as UserId,
      subjectType: 'plan',
      subjectId: 'p-1',
      action: 'create',
      meta: { extra: 'info' },
    });

    expect(db.insert).toHaveBeenCalledTimes(1);
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        householdId: 'h-1',
        actorUserId: 'u-1',
        action: 'create',
        subjectType: 'plan',
        subjectId: 'p-1',
        context: { extra: 'info' },
      }),
    );
  });

  it('listByHousehold returns empty page when no rows', async () => {
    const db = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    } as unknown as NodePgDatabase<typeof schema>;

    const repo = new DrizzleAuditEventRepository(db);
    const result = await repo.listByHousehold({}, { householdId: 'h-1' as HouseholdId });

    expect(result).toEqual({ items: [], nextCursor: null, hasMore: false });
  });

  it('record() (AuditLogPort compat) delegates to insertAuditEvent', async () => {
    const insertValues = vi.fn().mockResolvedValue([]);
    const db = {
      insert: vi.fn().mockReturnValue({ values: insertValues }),
    } as unknown as NodePgDatabase<typeof schema>;

    const repo = new DrizzleAuditEventRepository(db);
    await repo.record({
      householdId: 'h-1' as HouseholdId,
      actorUserId: 'u-2' as UserId,
      action: 'update',
      subjectType: 'plan',
      subjectId: 'p-2',
    });

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'u-2',
        action: 'update',
      }),
    );
  });
});
