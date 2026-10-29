import { describe, it, expect, beforeEach } from 'vitest';
import { createMock } from '@golevelup/ts-vitest';
import { HouseholdId, UserId } from '@power-budget/core';
import type { HouseholdRepository } from '../../../domain/auth/ports.js';
import type { Household, HouseholdMembership } from '../../../domain/auth/entities.js';
import { DeleteHouseholdUseCase } from './DeleteHouseholdUseCase.js';
import {
  HouseholdNotFoundError,
  HouseholdOwnerRequiredError,
} from '../../../domain/auth/errors.js';

const HOUSEHOLD_ID = HouseholdId.of('01900000-0000-7000-8000-000000000001');
const USER_ID = UserId.of('01900000-0000-7000-8000-000000000002');

const MOCK_HOUSEHOLD: Household = {
  id: HOUSEHOLD_ID,
  name: 'Test Household',
  baseCurrency: 'PLN',
  createdAt: new Date(),
};

function makeMembership(role: 'owner' | 'member'): HouseholdMembership {
  return { householdId: HOUSEHOLD_ID, userId: USER_ID, role, joinedAt: new Date() };
}

describe('DeleteHouseholdUseCase', () => {
  let householdRepo: ReturnType<typeof createMock<HouseholdRepository>>;
  let useCase: DeleteHouseholdUseCase;

  beforeEach(() => {
    householdRepo = createMock<HouseholdRepository>();
    useCase = new DeleteHouseholdUseCase(householdRepo);
  });

  it('schedules deletion 30 days from now', async () => {
    householdRepo.findMembership.mockResolvedValue(makeMembership('owner'));
    householdRepo.findById.mockResolvedValue(MOCK_HOUSEHOLD);
    householdRepo.scheduleDelete.mockResolvedValue(undefined);

    const before = Date.now();
    const result = await useCase.execute({
      householdId: HOUSEHOLD_ID,
      requestedByUserId: USER_ID,
    });
    const after = Date.now();

    expect(householdRepo.findMembership).toHaveBeenCalledWith(HOUSEHOLD_ID, USER_ID);
    expect(householdRepo.scheduleDelete).toHaveBeenCalledWith(HOUSEHOLD_ID, result.scheduledFor);
    const scheduledFor = result.scheduledFor;
    const expectedMin = new Date(before + 29 * 24 * 3600 * 1000);
    const expectedMax = new Date(after + 31 * 24 * 3600 * 1000);
    expect(scheduledFor >= expectedMin).toBe(true);
    expect(scheduledFor <= expectedMax).toBe(true);
  });

  it('throws HouseholdNotFoundError when household does not exist', async () => {
    householdRepo.findMembership.mockResolvedValue(makeMembership('owner'));
    householdRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ householdId: HOUSEHOLD_ID, requestedByUserId: USER_ID }),
    ).rejects.toThrow(HouseholdNotFoundError);
  });

  it('does not schedule deletion of a household the caller is not a member of', async () => {
    householdRepo.findMembership.mockResolvedValue(null);
    householdRepo.findById.mockResolvedValue(MOCK_HOUSEHOLD);

    await expect(
      useCase.execute({ householdId: HOUSEHOLD_ID, requestedByUserId: USER_ID }),
    ).rejects.toThrow(HouseholdNotFoundError);
    expect(householdRepo.scheduleDelete).not.toHaveBeenCalled();
  });

  it('does not let a non-owner member schedule deletion', async () => {
    householdRepo.findMembership.mockResolvedValue(makeMembership('member'));
    householdRepo.findById.mockResolvedValue(MOCK_HOUSEHOLD);

    await expect(
      useCase.execute({ householdId: HOUSEHOLD_ID, requestedByUserId: USER_ID }),
    ).rejects.toThrow(HouseholdOwnerRequiredError);
    expect(householdRepo.scheduleDelete).not.toHaveBeenCalled();
  });
});
