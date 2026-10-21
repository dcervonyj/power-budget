import type { UserId } from '@power-budget/core';
import type {
  UserProfile,
  UserProfilePatch,
  UserProfileRepository,
} from '../../../domain/auth/profile.js';
import { UserPreferences } from '../../../domain/auth/profile.js';
import { UserNotFoundError } from '../../../domain/auth/errors.js';

export interface UpdateUserProfileInput {
  readonly userId: UserId;
  readonly patch: UserProfilePatch;
}

/** PATCH /users/me: display name and preferences (locale, base currency, time zone). */
export class UpdateUserProfileUseCase {
  constructor(private readonly profileRepo: UserProfileRepository) {}

  async execute(input: UpdateUserProfileInput): Promise<UserProfile> {
    if (input.patch.timezone !== undefined) {
      UserPreferences.assertTimeZone(input.patch.timezone);
    }
    const patch: UserProfilePatch =
      input.patch.displayName !== undefined
        ? { ...input.patch, displayName: input.patch.displayName.trim() }
        : input.patch;

    if (Object.keys(patch).length > 0) {
      await this.profileRepo.update(input.userId, patch);
    }
    const profile = await this.profileRepo.findById(input.userId);
    if (profile === null) {
      throw new UserNotFoundError();
    }

    return profile;
  }
}
