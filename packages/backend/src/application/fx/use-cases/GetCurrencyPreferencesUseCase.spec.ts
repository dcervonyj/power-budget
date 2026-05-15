import { describe, it, expect, vi } from 'vitest';
import { GetCurrencyPreferencesUseCase } from './GetCurrencyPreferencesUseCase.js';
import type { CurrencyPreferencesRepository, UserCurrencyPreferences } from '../../../domain/fx/index.js';
import { UserId } from '@power-budget/core';

const USER_ID = UserId.of('01936d3e-8000-7000-a000-000000000002');

const PREFS: UserCurrencyPreferences = {
  userId: USER_ID,
  baseCurrency: 'EUR',
  interestingCurrencies: ['PLN', 'USD', 'GBP'],
};

function makeRepo(): CurrencyPreferencesRepository {
  return {
    get: vi.fn().mockResolvedValue(PREFS),
    set: vi.fn().mockResolvedValue(undefined),
  };
}

describe('GetCurrencyPreferencesUseCase', () => {
  it('returns preferences from repo', async () => {
    const repo = makeRepo();
    const useCase = new GetCurrencyPreferencesUseCase(repo);

    const result = await useCase.execute({ userId: USER_ID });

    expect(repo.get).toHaveBeenCalledWith(USER_ID);
    expect(result).toEqual(PREFS);
  });
});
