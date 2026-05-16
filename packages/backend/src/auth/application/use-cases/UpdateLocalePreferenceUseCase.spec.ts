import { describe, it, expect, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { UserId } from '@power-budget/core';
import type { UserRepository } from '../../domain/ports.js';
import { UpdateLocalePreferenceUseCase } from './UpdateLocalePreferenceUseCase.js';

const TEST_USER_ID = '01900000-0000-7000-8000-000000000001' as UserId;

describe('UpdateLocalePreferenceUseCase', () => {
  let userRepo: ReturnType<typeof mock<UserRepository>>;
  let useCase: UpdateLocalePreferenceUseCase;

  beforeEach(() => {
    userRepo = mock<UserRepository>();
    useCase = new UpdateLocalePreferenceUseCase(userRepo);
  });

  it('updates the locale preference for the user', async () => {
    userRepo.updateLocalePreference.mockResolvedValue(undefined);

    await useCase.execute({ userId: TEST_USER_ID, locale: 'pl' });

    expect(userRepo.updateLocalePreference).toHaveBeenCalledWith(TEST_USER_ID, 'pl');
  });
});
