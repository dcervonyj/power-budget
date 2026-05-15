import type { UserId } from '@power-budget/core';
import type { UserRepository } from '../../../domain/auth/ports.js';
import { UserNotFoundError } from '../../../domain/auth/errors.js';
import type { User } from '../../../domain/auth/entities.js';

export interface GetCurrentUserInput {
  readonly userId: UserId;
}

export class GetCurrentUserUseCase {
  constructor(private readonly userRepo: UserRepository) {}

  async execute(input: GetCurrentUserInput): Promise<User> {
    const user = await this.userRepo.findById(input.userId);
    if (user === null) {
      throw new UserNotFoundError();
    }

    return user;
  }
}
