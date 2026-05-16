import type { UserId } from '@power-budget/core';
import type { UserRepository } from '../../domain/ports.js';
import { UserNotFoundError } from '../../domain/errors.js';
import type { User } from '../../domain/entities.js';
import type { GetCurrentUserInput } from '../models/index.js';
export type { GetCurrentUserInput };

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
