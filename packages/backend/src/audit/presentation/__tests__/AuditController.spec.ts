import { describe, it, expect, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { HouseholdId, UserId } from '@power-budget/core';
import { AuditController } from '../AuditController.js';
import { DrizzleAuditEventRepository } from '../../infrastructure/DrizzleAuditEventRepository.js';
import type { AuthenticatedUser } from '../../../auth/presentation/decorators/CurrentUser.js';

const TEST_HOUSEHOLD_ID = '01900000-0000-7000-8000-000000000001' as HouseholdId;
const TEST_USER_ID = '01900000-0000-7000-8000-000000000002' as UserId;

function makeUser(householdId: HouseholdId | null = TEST_HOUSEHOLD_ID): AuthenticatedUser {
  return { userId: TEST_USER_ID, householdId };
}

describe('AuditController', () => {
  let controller: AuditController;
  let auditRepo: ReturnType<typeof mock<DrizzleAuditEventRepository>>;

  beforeEach(() => {
    auditRepo = mock<DrizzleAuditEventRepository>();
    controller = new AuditController(auditRepo);
  });

  it('returns empty result when user has no household', async () => {
    const result = await controller.list({} as never, makeUser(null));
    expect(result).toEqual({ items: [], nextCursor: null, hasMore: false });
    expect(auditRepo.listByHousehold).not.toHaveBeenCalled();
  });

  it('delegates to auditRepo.listByHousehold with filters and householdId', async () => {
    const expected = { items: [{ id: 'ev-1' }], nextCursor: null, hasMore: false };
    auditRepo.listByHousehold.mockResolvedValue(expected as never);

    const query = { subjectType: 'plan', subjectId: 'p-1', limit: 20 } as never;
    const result = await controller.list(query, makeUser());

    expect(auditRepo.listByHousehold).toHaveBeenCalledWith(
      expect.objectContaining({ subjectType: 'plan', subjectId: 'p-1', limit: 20 }),
      { householdId: TEST_HOUSEHOLD_ID },
    );
    expect(result).toEqual(expected);
  });

  it('forwards cursor and date range to repository', async () => {
    auditRepo.listByHousehold.mockResolvedValue({ items: [], nextCursor: null, hasMore: false });
    const query = { from: '2024-01-01', to: '2024-01-31', cursor: 'c-1' } as never;

    await controller.list(query, makeUser());

    expect(auditRepo.listByHousehold).toHaveBeenCalledWith(
      expect.objectContaining({ from: '2024-01-01', to: '2024-01-31', cursor: 'c-1' }),
      { householdId: TEST_HOUSEHOLD_ID },
    );
  });
});
