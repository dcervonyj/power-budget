import { describe, it, expect } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type {
  HouseholdRepository,
  UserRepository,
  HouseholdInviteRepository,
  AppConfigPort,
} from '../../src/auth/domain/ports.js';
import { AlreadyInHouseholdError, UserNotFoundError } from '../../src/auth/domain/errors.js';
import { CreateHouseholdUseCase } from '../../src/auth/application/use-cases/CreateHouseholdUseCase.js';
import { InviteToHouseholdUseCase } from '../../src/auth/application/use-cases/InviteToHouseholdUseCase.js';
import {
  HOUSEHOLD_A,
  HOUSEHOLD_B,
  USER_A,
  makeHousehold,
} from './helpers.js';

describe('Tenancy isolation — application layer', () => {
  describe('auth / household', () => {
    describe('CreateHouseholdUseCase', () => {
      it('creates a household for the requesting user only', async () => {
        const householdRepo = mock<HouseholdRepository>();
        const userRepo = mock<UserRepository>();
        const hhA = makeHousehold(HOUSEHOLD_A);

        householdRepo.findByUserId.mockResolvedValue(null);
        householdRepo.create.mockResolvedValue(hhA);
        householdRepo.addMember.mockResolvedValue({
          householdId: HOUSEHOLD_A,
          userId: USER_A,
          role: 'owner',
          joinedAt: new Date(),
        });

        const useCase = new CreateHouseholdUseCase(householdRepo, userRepo);
        const result = await useCase.execute({ userId: USER_A, name: 'Household A' });

        expect(result.id).toBe(HOUSEHOLD_A);
        expect(householdRepo.create).toHaveBeenCalledOnce();
        expect(householdRepo.addMember).toHaveBeenCalledWith(expect.any(String), USER_A, 'owner');
      });

      it('throws AlreadyInHouseholdError when user already has a household', async () => {
        const householdRepo = mock<HouseholdRepository>();
        const userRepo = mock<UserRepository>();

        // User A already belongs to household A
        householdRepo.findByUserId.mockResolvedValue(makeHousehold(HOUSEHOLD_A));

        const useCase = new CreateHouseholdUseCase(householdRepo, userRepo);

        await expect(
          useCase.execute({ userId: USER_A, name: 'Another Household' }),
        ).rejects.toThrow(AlreadyInHouseholdError);
      });
    });

    describe('InviteToHouseholdUseCase', () => {
      it('allows owner of household A to invite to household A', async () => {
        const householdRepo = mock<HouseholdRepository>();
        const userRepo = mock<UserRepository>();
        const inviteRepo = mock<HouseholdInviteRepository>();
        const config = mock<AppConfigPort>();

        householdRepo.findMembership.mockResolvedValue({
          householdId: HOUSEHOLD_A,
          userId: USER_A,
          role: 'owner',
          joinedAt: new Date(),
        });
        inviteRepo.create.mockResolvedValue({
          id: 'invite-1',
          householdId: HOUSEHOLD_A,
          email: 'invitee@example.com',
          tokenHash: 'hash',
          expiresAt: new Date(Date.now() + 86400000),
          acceptedAt: null,
          createdAt: new Date(),
        });
        config.get.mockReturnValue('https://app.example.com');

        const useCase = new InviteToHouseholdUseCase(householdRepo, userRepo, inviteRepo, config);
        const result = await useCase.execute({
          inviterUserId: USER_A,
          inviteeEmail: 'invitee@example.com',
          householdId: HOUSEHOLD_A,
        });

        expect(result.inviteUrl).toContain('https://app.example.com');
        expect(householdRepo.findMembership).toHaveBeenCalledWith(HOUSEHOLD_A, USER_A);
      });

      it('throws when user tries to invite to another household they are not owner of', async () => {
        const householdRepo = mock<HouseholdRepository>();
        const userRepo = mock<UserRepository>();
        const inviteRepo = mock<HouseholdInviteRepository>();
        const config = mock<AppConfigPort>();

        // USER_A has no membership in HOUSEHOLD_B
        householdRepo.findMembership.mockResolvedValue(null);

        const useCase = new InviteToHouseholdUseCase(householdRepo, userRepo, inviteRepo, config);

        await expect(
          useCase.execute({
            inviterUserId: USER_A,
            inviteeEmail: 'victim@example.com',
            householdId: HOUSEHOLD_B,
          }),
        ).rejects.toThrow(UserNotFoundError);
      });

      it('throws when user is only a member (not owner) of household', async () => {
        const householdRepo = mock<HouseholdRepository>();
        const userRepo = mock<UserRepository>();
        const inviteRepo = mock<HouseholdInviteRepository>();
        const config = mock<AppConfigPort>();

        householdRepo.findMembership.mockResolvedValue({
          householdId: HOUSEHOLD_A,
          userId: USER_A,
          role: 'member',
          joinedAt: new Date(),
        });

        const useCase = new InviteToHouseholdUseCase(householdRepo, userRepo, inviteRepo, config);

        await expect(
          useCase.execute({
            inviterUserId: USER_A,
            inviteeEmail: 'invitee@example.com',
            householdId: HOUSEHOLD_A,
          }),
        ).rejects.toThrow(UserNotFoundError);
      });
    });
  });
});
