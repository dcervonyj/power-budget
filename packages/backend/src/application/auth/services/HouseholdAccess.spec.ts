import { describe, it, expect } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { HouseholdRepository } from '../../../domain/auth/ports.js';
import { HouseholdOwnerRequiredError } from '../../../domain/auth/errors.js';
import { HouseholdAccess } from './HouseholdAccess.js';
import {
  HOUSEHOLD_ID,
  OWNER_ID,
  makeMembership,
} from '../../../test/doubles/householdInviteFixtures.js';

describe('HouseholdAccess.assertOwner', () => {
  it('passes for the owner', async () => {
    const repo = mock<HouseholdRepository>();
    repo.findMembership.mockResolvedValue(makeMembership('owner'));

    await expect(
      new HouseholdAccess(repo).assertOwner(HOUSEHOLD_ID, OWNER_ID),
    ).resolves.toBeUndefined();
    expect(repo.findMembership).toHaveBeenCalledWith(HOUSEHOLD_ID, OWNER_ID);
  });

  it.each([
    ['a member', makeMembership('member')],
    ['a non-member', null],
  ])('refuses %s', async (_label, membership) => {
    const repo = mock<HouseholdRepository>();
    repo.findMembership.mockResolvedValue(membership);

    await expect(new HouseholdAccess(repo).assertOwner(HOUSEHOLD_ID, OWNER_ID)).rejects.toThrow(
      HouseholdOwnerRequiredError,
    );
  });
});
