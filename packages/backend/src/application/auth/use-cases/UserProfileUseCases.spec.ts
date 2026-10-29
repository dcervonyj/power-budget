import { describe, it, expect, beforeEach } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import { HouseholdId, UserId } from '@power-budget/core';
import type { UserProfile, UserProfileRepository } from '../../../domain/auth/profile.js';
import { UserPreferences } from '../../../domain/auth/profile.js';
import { GetUserProfileUseCase } from './GetUserProfileUseCase.js';
import { UpdateUserProfileUseCase } from './UpdateUserProfileUseCase.js';

const USER = UserId.of('01900000-0000-7000-8000-0000000000b1');
const PROFILE: UserProfile = {
  id: USER,
  email: 'anna@example.com',
  displayName: 'Anna',
  localePreference: null,
  defaultLocale: 'en',
  baseCurrency: null,
  timezone: 'UTC',
  onboardingCompleted: false,
  householdId: HouseholdId.of('01900000-0000-7000-8000-0000000000a1'),
  householdBaseCurrency: 'PLN',
};

let repo: MockProxy<UserProfileRepository>;

beforeEach(() => {
  repo = mock<UserProfileRepository>();
});

describe('GetUserProfileUseCase', () => {
  it('returns the profile', async () => {
    repo.findById.mockResolvedValue(PROFILE);

    await expect(new GetUserProfileUseCase(repo).execute({ userId: USER })).resolves.toBe(PROFILE);
  });

  it('throws USER_NOT_FOUND for an unknown user', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(new GetUserProfileUseCase(repo).execute({ userId: USER })).rejects.toThrow(
      'USER_NOT_FOUND',
    );
  });
});

describe('UpdateUserProfileUseCase', () => {
  it('stores the trimmed name and preferences and returns the fresh profile', async () => {
    const updated = { ...PROFILE, displayName: 'Ania', timezone: 'Europe/Warsaw' };
    repo.findById.mockResolvedValue(updated);

    const result = await new UpdateUserProfileUseCase(repo).execute({
      userId: USER,
      patch: {
        displayName: ' Ania ',
        locale: 'pl',
        baseCurrency: 'EUR',
        timezone: 'Europe/Warsaw',
      },
    });

    expect(result).toBe(updated);
    expect(repo.update).toHaveBeenCalledWith(USER, {
      displayName: 'Ania',
      locale: 'pl',
      baseCurrency: 'EUR',
      timezone: 'Europe/Warsaw',
    });
  });

  it('stores onboarding completion', async () => {
    const updated = { ...PROFILE, onboardingCompleted: true };
    repo.findById.mockResolvedValue(updated);

    const result = await new UpdateUserProfileUseCase(repo).execute({
      userId: USER,
      patch: { onboardingCompleted: true },
    });

    expect(result).toBe(updated);
    expect(repo.update).toHaveBeenCalledWith(USER, { onboardingCompleted: true });
  });

  it('rejects an unknown time zone', async () => {
    await expect(
      new UpdateUserProfileUseCase(repo).execute({
        userId: USER,
        patch: { timezone: 'Mars/Base' },
      }),
    ).rejects.toThrow('USER_PREFERENCE_INVALID');
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('skips the write for an empty patch', async () => {
    repo.findById.mockResolvedValue(PROFILE);

    await new UpdateUserProfileUseCase(repo).execute({ userId: USER, patch: {} });

    expect(repo.update).not.toHaveBeenCalled();
  });

  it('throws USER_NOT_FOUND when the user is gone', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(
      new UpdateUserProfileUseCase(repo).execute({ userId: USER, patch: { locale: 'uk' } }),
    ).rejects.toThrow('USER_NOT_FOUND');
  });
});

describe('UserPreferences', () => {
  it('resolves the effective locale and base currency', () => {
    expect(UserPreferences.effectiveLocale(PROFILE)).toBe('en');
    expect(UserPreferences.effectiveLocale({ ...PROFILE, localePreference: 'uk' })).toBe('uk');
    expect(UserPreferences.effectiveBaseCurrency(PROFILE)).toBe('PLN');
    expect(UserPreferences.effectiveBaseCurrency({ ...PROFILE, baseCurrency: 'USD' })).toBe('USD');
  });

  it('accepts IANA zones only', () => {
    expect(() => UserPreferences.assertTimeZone('Europe/Kyiv')).not.toThrow();
    expect(() => UserPreferences.assertTimeZone('')).toThrow('USER_PREFERENCE_INVALID');
  });
});
