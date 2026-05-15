import type { UserId } from '@power-budget/core';
import type {
  CurrencyPreferencesRepository,
  UserCurrencyPreferences,
} from '../../../domain/fx/index.js';

export class GetCurrencyPreferencesUseCase {
  constructor(private readonly repo: CurrencyPreferencesRepository) {}

  async execute(input: { userId: UserId }): Promise<UserCurrencyPreferences> {
    return this.repo.get(input.userId);
  }
}
