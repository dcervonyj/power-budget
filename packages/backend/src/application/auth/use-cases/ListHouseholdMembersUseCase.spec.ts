import { describe, it, expect, beforeEach } from 'vitest';
import { createMock } from '@golevelup/ts-vitest';
import type { HouseholdMember } from '../../../domain/auth/entities.js';
import type { HouseholdRepository } from '../../../domain/auth/ports.js';
import type { HouseholdAccess } from '../services/HouseholdAccess.js';
import { HouseholdNotFoundError } from '../../../domain/auth/errors.js';
import { ListHouseholdMembersUseCase } from './ListHouseholdMembersUseCase.js';
import {
  HOUSEHOLD_ID,
  OWNER_EMAIL,
  OWNER_ID,
  PARTNER_EMAIL,
  PARTNER_ID,
} from '../../../test/doubles/householdInviteFixtures.js';

const MEMBERS: HouseholdMember[] = [
  {
    userId: OWNER_ID,
    email: OWNER_EMAIL,
    displayName: 'Ann',
    role: 'owner',
    joinedAt: new Date('2026-10-01T10:00:00Z'),
  },
  {
    userId: PARTNER_ID,
    email: PARTNER_EMAIL,
    displayName: 'Bob',
    role: 'member',
    joinedAt: new Date('2026-10-20T10:00:00Z'),
  },
];

describe('ListHouseholdMembersUseCase', () => {
  let householdRepo: ReturnType<typeof createMock<HouseholdRepository>>;
  let access: ReturnType<typeof createMock<HouseholdAccess>>;

  beforeEach(() => {
    householdRepo = createMock<HouseholdRepository>();
    access = createMock<HouseholdAccess>();
  });

  it('lists the members for a member of the household', async () => {
    access.assertMember.mockResolvedValue(undefined);
    householdRepo.listMembers.mockResolvedValue(MEMBERS);

    const members = await new ListHouseholdMembersUseCase(householdRepo, access).execute({
      userId: PARTNER_ID,
      householdId: HOUSEHOLD_ID,
    });

    expect(members).toEqual(MEMBERS);
    expect(access.assertMember).toHaveBeenCalledWith(HOUSEHOLD_ID, PARTNER_ID);
    expect(householdRepo.listMembers).toHaveBeenCalledWith(HOUSEHOLD_ID);
  });

  it('reads nothing for someone outside the household', async () => {
    access.assertMember.mockRejectedValue(new HouseholdNotFoundError());

    await expect(
      new ListHouseholdMembersUseCase(householdRepo, access).execute({
        userId: PARTNER_ID,
        householdId: HOUSEHOLD_ID,
      }),
    ).rejects.toThrow(HouseholdNotFoundError);
    expect(householdRepo.listMembers).not.toHaveBeenCalled();
  });
});
