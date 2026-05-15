import { describe, it, expect, vi } from 'vitest';
import { UpdateCurrencyPreferencesUseCase } from './UpdateCurrencyPreferencesUseCase.js';
import { GetCurrencyPreferencesUseCase } from './GetCurrencyPreferencesUseCase.js';
import type { CurrencyPreferencesRepository, UserCurrencyPreferences } from '../../../domain/fx/index.js';
import { UserId } from '@power-budget/core';

const USER_ID = UserId.of('01936d3e-8000-7000-a000-000000000001');

const PREFS: UserCurrencyPreferences = {
  userId: USER_ID,
  baseCurrency: 'PLN',
  interestingCurrencies: ['EUR', 'USD'],
};

function makeRepo(): CurrencyPreferencesRepository {
  return {
    get: vi.fn().mockResolvedValue(PREFS),
    set: vi.fn().mockResolvedValue(undefined),
  };
}

describe('UpdateCurrencyPreferencesUseCase', () => {
  it('calls repo.set with the provided preferences', async () => {
    const repo = makeRepo();
    const useCase = new UpdateCurrencyPreferencesUseCase(repo);

    await useCase.execute({
      userId: USER_ID,
      baseCurrency: 'PLN',
      interestingCurrencies: ['EUR', 'USD'],
    });

    expect(repo.set).toHaveBeenCalledWith(USER_ID, PREFS);
  });
});

describe('GetCurrencyPreferencesUseCase', () => {
  it('calls repo.get and returns preferences', async () => {
    const repo = makeRepo();
    const useCase = new GetCurrencyPreferencesUseCase(repo);

    const result = await useCase.execute({ userId: USER_ID });

    expect(repo.get).toHaveBeenCalledWith(USER_ID);
    expect(result).toEqual(PREFS);
  });
});
