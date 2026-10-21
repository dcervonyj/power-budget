import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { HouseholdId, UserId } from '@power-budget/core';
import type { HouseholdRepository } from '../../../domain/auth/ports.js';
import type { Household, HouseholdMembership } from '../../../domain/auth/entities.js';
import { HouseholdsController } from '../HouseholdsController.js';
import { CreateHouseholdUseCase } from '../../../application/auth/use-cases/CreateHouseholdUseCase.js';
import { InviteToHouseholdUseCase } from '../../../application/auth/use-cases/InviteToHouseholdUseCase.js';
import { AcceptInviteUseCase } from '../../../application/auth/use-cases/AcceptInviteUseCase.js';
import { ExportHouseholdDataUseCase } from '../../../application/auth/use-cases/ExportHouseholdDataUseCase.js';
import { DeleteHouseholdUseCase } from '../../../application/auth/use-cases/DeleteHouseholdUseCase.js';
import {
  bearerFor,
  createHttpTestApp,
  type HttpTestApp,
} from '../../../test/http/createHttpTestApp.js';

const ALICE = '01900000-0000-7000-8000-00000000000a' as UserId;
const ALICE_HOUSEHOLD = '01900000-0000-7000-8000-0000000000a1' as HouseholdId;
const BOB_HOUSEHOLD = '01900000-0000-7000-8000-0000000000b1' as HouseholdId;

function makeHousehold(id: HouseholdId): Household {
  return { id, name: 'household', baseCurrency: 'PLN', createdAt: new Date() };
}

function makeMembership(role: 'owner' | 'member'): HouseholdMembership {
  return { householdId: ALICE_HOUSEHOLD, userId: ALICE, role, joinedAt: new Date() };
}

describe('DELETE /households/:id (HTTP)', () => {
  let app: HttpTestApp;
  let householdRepo: ReturnType<typeof mock<HouseholdRepository>>;

  beforeEach(async () => {
    householdRepo = mock<HouseholdRepository>();
    householdRepo.findById.mockImplementation(async (id: HouseholdId) => makeHousehold(id));
    householdRepo.scheduleDelete.mockResolvedValue(undefined);
    app = await createHttpTestApp({
      controllers: [HouseholdsController],
      providers: [
        { provide: CreateHouseholdUseCase, useValue: mock<CreateHouseholdUseCase>() },
        { provide: InviteToHouseholdUseCase, useValue: mock<InviteToHouseholdUseCase>() },
        { provide: AcceptInviteUseCase, useValue: mock<AcceptInviteUseCase>() },
        { provide: ExportHouseholdDataUseCase, useValue: mock<ExportHouseholdDataUseCase>() },
        { provide: DeleteHouseholdUseCase, useValue: new DeleteHouseholdUseCase(householdRepo) },
      ],
    });
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns 404 and schedules nothing for a household the caller does not belong to', async () => {
    householdRepo.findMembership.mockResolvedValue(null);

    const res = await app.inject({
      method: 'DELETE',
      url: `/households/${BOB_HOUSEHOLD}`,
      headers: { authorization: bearerFor(ALICE, ALICE_HOUSEHOLD) },
    });

    expect(res.statusCode).toBe(404);
    expect(householdRepo.scheduleDelete).not.toHaveBeenCalled();
  });

  it('returns 403 when a non-owner member deletes their own household', async () => {
    householdRepo.findMembership.mockResolvedValue(makeMembership('member'));

    const res = await app.inject({
      method: 'DELETE',
      url: `/households/${ALICE_HOUSEHOLD}`,
      headers: { authorization: bearerFor(ALICE, ALICE_HOUSEHOLD) },
    });

    expect(res.statusCode).toBe(403);
    expect(householdRepo.scheduleDelete).not.toHaveBeenCalled();
  });

  it('returns 202 and schedules deletion when the owner deletes their own household', async () => {
    householdRepo.findMembership.mockResolvedValue(makeMembership('owner'));

    const res = await app.inject({
      method: 'DELETE',
      url: `/households/${ALICE_HOUSEHOLD}`,
      headers: { authorization: bearerFor(ALICE, ALICE_HOUSEHOLD) },
    });

    expect(res.statusCode).toBe(202);
    expect(householdRepo.findMembership).toHaveBeenCalledWith(ALICE_HOUSEHOLD, ALICE);
    expect(householdRepo.scheduleDelete).toHaveBeenCalledOnce();
    expect(householdRepo.scheduleDelete.mock.calls[0]?.[0]).toBe(ALICE_HOUSEHOLD);
  });
});
