import { describe, it, expect } from 'vitest';
import { createMock } from '@golevelup/ts-vitest';
import { AuditEventId, HouseholdId, IsoDateTime, UserId } from '@power-budget/core';
import type { AuditEventRepository, AuditPage } from '../../../../domain/audit/ports.js';
import { ListAuditLogUseCase } from '../ListAuditLogUseCase.js';

const HOUSEHOLD = HouseholdId.of('01900000-0000-7000-8000-0000000000a1');
const ACTOR = UserId.of('01900000-0000-7000-8000-00000000000a');
const CURSOR = AuditEventId.of('01900000-0000-7000-8000-0000000000c1');
const EVENT = AuditEventId.of('01900000-0000-7000-8000-0000000000c2');

describe('ListAuditLogUseCase', () => {
  it("lists the caller's household page with the given filter", async () => {
    const page: AuditPage = {
      items: [
        {
          id: EVENT,
          householdId: HOUSEHOLD,
          actorId: ACTOR,
          subjectType: 'Plan',
          subjectId: 'plan-1',
          action: 'PLAN_CREATED',
          meta: {},
          occurredAt: IsoDateTime.of('2026-10-21T10:00:00.000Z'),
        },
      ],
      nextCursor: null,
      hasMore: false,
    };
    const repo = createMock<AuditEventRepository>();
    repo.listByHousehold.mockResolvedValue(page);
    const filter = { subjectType: 'Plan', cursor: CURSOR, limit: 20 };

    const result = await new ListAuditLogUseCase(repo).execute({ householdId: HOUSEHOLD, filter });

    expect(result).toEqual(page);
    expect(repo.listByHousehold).toHaveBeenCalledWith(
      { subjectType: 'Plan', cursor: CURSOR, limit: 20 },
      { householdId: HOUSEHOLD },
    );
  });
});
