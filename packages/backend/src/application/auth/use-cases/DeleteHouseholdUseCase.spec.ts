import { describe, it, expect, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { HouseholdId, UserId } from '@power-budget/core';
import type { HouseholdRepository } from '../../../domain/auth/ports.js';
import type { Household } from '../../../domain/auth/entities.js';
import { DeleteHouseholdUseCase } from './DeleteHouseholdUseCase.js';
import { HouseholdNotFoundError } from '../../../domain/auth/errors.js';

const HOUSEHOLD_ID = '01900000-0000-7000-8000-000000000001' as HouseholdId;
const USER_ID = '01900000-0000-7000-8000-000000000002' as UserId;

const MOCK_HOUSEHOLD: Household = {
  id: HOUSEHOLD_ID,
  name: 'Test Household',
  baseCurrency: 'PLN',
  createdAt: new Date(),
};

describe('DeleteHouseholdUseCase', () => {
  let householdRepo: ReturnType<typeof mock<HouseholdRepository>>;
  let useCase: DeleteHouseholdUseCase;

  beforeEach(() => {
    householdRepo = mock<HouseholdRepository>();
    useCase = new DeleteHouseholdUseCase(householdRepo);
  });

  it('schedules deletion 30 days from now', async () => {
    householdRepo.findById.mockResolvedValue(MOCK_HOUSEHOLD);
    householdRepo.scheduleDelete.mockResolvedValue(undefined);

    const before = Date.now();
    const result = await useCase.execute({
      householdId: HOUSEHOLD_ID,
      requestedByUserId: USER_ID,
    });
    const after = Date.now();

    expect(householdRepo.scheduleDelete).toHaveBeenCalledOnce();
    const scheduledFor = result.scheduledFor;
    const expectedMin = new Date(before + 29 * 24 * 3600 * 1000);
    const expectedMax = new Date(after + 31 * 24 * 3600 * 1000);
    expect(scheduledFor >= expectedMin).toBe(true);
    expect(scheduledFor <= expectedMax).toBe(true);
  });

  it('throws HouseholdNotFoundError when household does not exist', async () => {
    householdRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ householdId: HOUSEHOLD_ID, requestedByUserId: USER_ID }),
    ).rejects.toThrow(HouseholdNotFoundError);
  });
});
