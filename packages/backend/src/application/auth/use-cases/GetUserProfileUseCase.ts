import type { UserId } from '@power-budget/core';
import type { UserProfile, UserProfileRepository } from '../../../domain/auth/profile.js';
import { UserNotFoundError } from '../../../domain/auth/errors.js';

export interface GetUserProfileInput {
  readonly userId: UserId;
}

export class GetUserProfileUseCase {
  constructor(private readonly profileRepo: UserProfileRepository) {}

  async execute(input: GetUserProfileInput): Promise<UserProfile> {
    const profile = await this.profileRepo.findById(input.userId);
    if (profile === null) {
      throw new UserNotFoundError();
    }

    return profile;
  }
}
