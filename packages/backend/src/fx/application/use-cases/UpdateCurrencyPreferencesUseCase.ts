import type { UserId } from '@power-budget/core';
import type { CurrencyCode } from '@power-budget/core';
import type { CurrencyPreferencesRepository, UserCurrencyPreferences } from '../../domain/index.js';

export class UpdateCurrencyPreferencesUseCase {
  constructor(private readonly repo: CurrencyPreferencesRepository) {}

  async execute(input: {
    userId: UserId;
    baseCurrency: CurrencyCode;
    interestingCurrencies: readonly CurrencyCode[];
  }): Promise<void> {
    const prefs: UserCurrencyPreferences = {
      userId: input.userId,
      baseCurrency: input.baseCurrency,
      interestingCurrencies: input.interestingCurrencies,
    };

    await this.repo.set(input.userId, prefs);
  }
}
