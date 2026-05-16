import { describe, it, expect, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { UserId, HouseholdId } from '@power-budget/core';
import { UsersController } from '../UsersController.js';
import { GetCurrentUserUseCase } from '../../application/use-cases/GetCurrentUserUseCase.js';
import { UpdateLocalePreferenceUseCase } from '../../application/use-cases/UpdateLocalePreferenceUseCase.js';
import type { AuthenticatedUser } from '../decorators/CurrentUser.js';

const TEST_USER_ID = '01900000-0000-7000-8000-000000000001' as UserId;
const TEST_HOUSEHOLD_ID = '01900000-0000-7000-8000-000000000002' as HouseholdId;

function makeUser(): AuthenticatedUser {
  return { userId: TEST_USER_ID, householdId: TEST_HOUSEHOLD_ID };
}

describe('UsersController', () => {
  let controller: UsersController;
  let getCurrentUser: ReturnType<typeof mock<GetCurrentUserUseCase>>;
  let updateLocale: ReturnType<typeof mock<UpdateLocalePreferenceUseCase>>;

  beforeEach(() => {
    getCurrentUser = mock<GetCurrentUserUseCase>();
    updateLocale = mock<UpdateLocalePreferenceUseCase>();
    controller = new UsersController(getCurrentUser, updateLocale);
  });

  describe('GET /users/me', () => {
    it('returns mapped user profile from GetCurrentUserUseCase', async () => {
      getCurrentUser.execute.mockResolvedValue({
        id: TEST_USER_ID,
        email: 'alice@example.com',
        displayName: 'Alice',
        localePreference: 'pl',
        defaultLocale: 'en',
      } as never);

      const result = await controller.getMe(makeUser());

      expect(getCurrentUser.execute).toHaveBeenCalledWith({ userId: TEST_USER_ID });
      expect(result).toEqual({
        id: TEST_USER_ID,
        email: 'alice@example.com',
        displayName: 'Alice',
        localePreference: 'pl',
        defaultLocale: 'en',
      });
    });
  });

  describe('PATCH /users/me/locale', () => {
    it('calls UpdateLocalePreferenceUseCase with userId and locale', async () => {
      updateLocale.execute.mockResolvedValue(undefined);

      await controller.updateLocalePreference({ locale: 'uk' } as never, makeUser());

      expect(updateLocale.execute).toHaveBeenCalledWith({
        userId: TEST_USER_ID,
        locale: 'uk',
      });
    });
  });
});
