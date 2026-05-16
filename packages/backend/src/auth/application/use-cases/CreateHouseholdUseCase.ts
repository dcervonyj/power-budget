import { uuidv7 } from 'uuidv7';
import type { UserId, HouseholdId } from '@power-budget/core';
import type { Household, NewHousehold } from '../../domain/entities.js';
import type { HouseholdRepository, UserRepository } from '../../domain/ports.js';
import { AlreadyInHouseholdError } from '../../domain/errors.js';
import type { CreateHouseholdInput } from '../models/index.js';
export type { CreateHouseholdInput };

export class CreateHouseholdUseCase {
  constructor(
    private readonly householdRepo: HouseholdRepository,
    private readonly userRepo: UserRepository,
  ) {}

  async execute(input: CreateHouseholdInput): Promise<Household> {
    const existingHousehold = await this.householdRepo.findByUserId(input.userId);
    if (existingHousehold !== null) {
      throw new AlreadyInHouseholdError();
    }

    const householdId = uuidv7() as HouseholdId;
    const newHousehold: NewHousehold = {
      id: householdId,
      name: input.name,
      baseCurrency: input.baseCurrency ?? 'PLN',
    };

    const household = await this.householdRepo.create(newHousehold);
    await this.householdRepo.addMember(householdId, input.userId, 'owner');

    return household;
  }
}
