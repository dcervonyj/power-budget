import { describe, it, expect, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { UserId, HouseholdId } from '@power-budget/core';
import type { HouseholdRepository, UserRepository } from '../../domain/ports.js';
import { CreateHouseholdUseCase } from './CreateHouseholdUseCase.js';
import { AlreadyInHouseholdError } from '../../domain/errors.js';
import type { Household } from '../../domain/entities.js';

const USER_ID = 'u1' as UserId;
const HH_ID = 'hh1' as HouseholdId;

function makeHousehold(): Household {
  return { id: HH_ID, name: 'Test HH', baseCurrency: 'PLN', createdAt: new Date() };
}

describe('CreateHouseholdUseCase', () => {
  let householdRepo: ReturnType<typeof mock<HouseholdRepository>>;
  let userRepo: ReturnType<typeof mock<UserRepository>>;
  let useCase: CreateHouseholdUseCase;

  beforeEach(() => {
    householdRepo = mock<HouseholdRepository>();
    userRepo = mock<UserRepository>();
    useCase = new CreateHouseholdUseCase(householdRepo, userRepo);
  });

  it('creates household and adds owner', async () => {
    householdRepo.findByUserId.mockResolvedValue(null);
    householdRepo.create.mockResolvedValue(makeHousehold());
    householdRepo.addMember.mockResolvedValue({
      householdId: HH_ID,
      userId: USER_ID,
      role: 'owner',
      joinedAt: new Date(),
    });

    const result = await useCase.execute({ userId: USER_ID, name: 'Test HH' });

    expect(result.name).toBe('Test HH');
    expect(householdRepo.create).toHaveBeenCalledOnce();
    expect(householdRepo.addMember).toHaveBeenCalledWith(expect.any(String), USER_ID, 'owner');
  });

  it('throws AlreadyInHouseholdError if user already has a household', async () => {
    householdRepo.findByUserId.mockResolvedValue(makeHousehold());

    await expect(useCase.execute({ userId: USER_ID, name: 'Another HH' })).rejects.toThrow(
      AlreadyInHouseholdError,
    );
  });
});
