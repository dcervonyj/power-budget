import type { UserId } from '@power-budget/core';
import type { UserRepository } from '../../domain/ports.js';
import type { LocaleCode } from '../../domain/entities.js';
import type { UpdateLocalePreferenceInput } from '../models/index.js';
export type { UpdateLocalePreferenceInput };

export class UpdateLocalePreferenceUseCase {
  constructor(private readonly userRepo: UserRepository) {}

  async execute(input: UpdateLocalePreferenceInput): Promise<void> {
    await this.userRepo.updateLocalePreference(input.userId, input.locale);
  }
}
