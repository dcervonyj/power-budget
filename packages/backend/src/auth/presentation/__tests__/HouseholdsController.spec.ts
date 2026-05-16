import { describe, it, expect, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { ForbiddenException } from '@nestjs/common';
import type { HouseholdId, UserId } from '@power-budget/core';
import { HouseholdsController } from '../HouseholdsController.js';
import { CreateHouseholdUseCase } from '../../application/use-cases/CreateHouseholdUseCase.js';
import { InviteToHouseholdUseCase } from '../../application/use-cases/InviteToHouseholdUseCase.js';
import { AcceptInviteUseCase } from '../../application/use-cases/AcceptInviteUseCase.js';
import { ExportHouseholdDataUseCase } from '../../application/use-cases/ExportHouseholdDataUseCase.js';
import { DeleteHouseholdUseCase } from '../../application/use-cases/DeleteHouseholdUseCase.js';
import type { AuthenticatedUser } from '../decorators/CurrentUser.js';

const TEST_HOUSEHOLD_ID = '01900000-0000-7000-8000-000000000001' as HouseholdId;
const TEST_USER_ID = '01900000-0000-7000-8000-000000000002' as UserId;

function makeUser(householdId: HouseholdId | null = TEST_HOUSEHOLD_ID): AuthenticatedUser {
  return { userId: TEST_USER_ID, householdId };
}

describe('HouseholdsController (auth)', () => {
  let controller: HouseholdsController;
  let createHousehold: ReturnType<typeof mock<CreateHouseholdUseCase>>;
  let inviteToHousehold: ReturnType<typeof mock<InviteToHouseholdUseCase>>;
  let acceptInvite: ReturnType<typeof mock<AcceptInviteUseCase>>;
  let exportData: ReturnType<typeof mock<ExportHouseholdDataUseCase>>;
  let scheduleDelete: ReturnType<typeof mock<DeleteHouseholdUseCase>>;

  beforeEach(() => {
    createHousehold = mock<CreateHouseholdUseCase>();
    inviteToHousehold = mock<InviteToHouseholdUseCase>();
    acceptInvite = mock<AcceptInviteUseCase>();
    exportData = mock<ExportHouseholdDataUseCase>();
    scheduleDelete = mock<DeleteHouseholdUseCase>();
    controller = new HouseholdsController(
      createHousehold,
      inviteToHousehold,
      acceptInvite,
      exportData,
      scheduleDelete,
    );
  });

  describe('POST /households (create)', () => {
    it('calls CreateHouseholdUseCase and returns householdId', async () => {
      createHousehold.execute.mockResolvedValue({ id: TEST_HOUSEHOLD_ID } as never);

      const result = await controller.create(
        { name: 'My House', baseCurrency: 'PLN' } as never,
        makeUser(),
      );

      expect(createHousehold.execute).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'My House', baseCurrency: 'PLN', userId: TEST_USER_ID }),
      );
      expect(result).toEqual({ householdId: TEST_HOUSEHOLD_ID });
    });
  });

  describe('POST /households/invite', () => {
    it('calls InviteToHouseholdUseCase with householdId and invitee email', async () => {
      inviteToHousehold.execute.mockResolvedValue(undefined);

      await controller.invite({ email: 'bob@example.com' } as never, makeUser());

      expect(inviteToHousehold.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          inviterUserId: TEST_USER_ID,
          inviteeEmail: 'bob@example.com',
          householdId: TEST_HOUSEHOLD_ID,
        }),
      );
    });

    it('returns without calling use case when user has no household', async () => {
      await controller.invite({ email: 'bob@example.com' } as never, makeUser(null));
      expect(inviteToHousehold.execute).not.toHaveBeenCalled();
    });
  });

  describe('POST /households/invite/:token/accept', () => {
    it('calls AcceptInviteUseCase with token and userId', async () => {
      acceptInvite.execute.mockResolvedValue(undefined);

      await controller.acceptInviteEndpoint('tok-abc', makeUser());

      expect(acceptInvite.execute).toHaveBeenCalledWith(
        expect.objectContaining({ token: 'tok-abc', acceptingUserId: TEST_USER_ID }),
      );
    });
  });

  describe('POST /households/export', () => {
    it('calls ExportHouseholdDataUseCase and returns result', async () => {
      exportData.execute.mockResolvedValue({ exportId: 'exp-1' } as never);

      const result = await controller.requestExport(makeUser());

      expect(exportData.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          householdId: TEST_HOUSEHOLD_ID,
          requestedByUserId: TEST_USER_ID,
        }),
      );
      expect(result).toEqual({ exportId: 'exp-1' });
    });

    it('throws ForbiddenException when user has no household', async () => {
      await expect(controller.requestExport(makeUser(null))).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('DELETE /households/:id', () => {
    it('calls DeleteHouseholdUseCase with id and userId', async () => {
      scheduleDelete.execute.mockResolvedValue(undefined);

      await controller.deleteHousehold(TEST_HOUSEHOLD_ID, makeUser());

      expect(scheduleDelete.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          householdId: TEST_HOUSEHOLD_ID,
          requestedByUserId: TEST_USER_ID,
        }),
      );
    });

    it('throws ForbiddenException when user has no household', async () => {
      await expect(
        controller.deleteHousehold(TEST_HOUSEHOLD_ID, makeUser(null)),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
