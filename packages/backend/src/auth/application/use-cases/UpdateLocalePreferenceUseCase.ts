import type { UserId } from '@power-budget/core';
import type { UserRepository } from '../../domain/ports.js';
import type { LocaleCode } from '../../domain/entities.js';

export interface UpdateLocalePreferenceInput {
  readonly userId: UserId;
  readonly locale: LocaleCode;
}

export class UpdateLocalePreferenceUseCase {
  constructor(private readonly userRepo: UserRepository) {}

  async execute(input: UpdateLocalePreferenceInput): Promise<void> {
    await this.userRepo.updateLocalePreference(input.userId, input.locale);
  }
}
