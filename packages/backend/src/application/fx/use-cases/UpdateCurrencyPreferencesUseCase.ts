import type { UserId } from '@power-budget/core';
import type { CurrencyCode } from '@power-budget/core';
import type {
  CurrencyPreferencesRepository,
  UserCurrencyPreferences,
} from '../../../domain/fx/index.js';

export class UpdateCurrencyPreferencesUseCase {
  constructor(private readonly currencyPreferencesRepo: CurrencyPreferencesRepository) {}

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

    await this.currencyPreferencesRepo.set(input.userId, prefs);
  }
}
