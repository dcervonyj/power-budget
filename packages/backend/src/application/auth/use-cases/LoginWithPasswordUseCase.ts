import type { UserId } from '@power-budget/core';
import type { UserRepository, PasswordHashing } from '../../../domain/auth/ports.js';
import { InvalidCredentialsError } from '../../../domain/auth/errors.js';
import type { LoginPolicy } from '../services/LoginPolicy.js';

export interface LoginWithPasswordInput {
  readonly email: string;
  readonly password: string;
  readonly totp?: string;
}

export interface LoginWithPasswordOutput {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly userId: UserId;
}

export class LoginWithPasswordUseCase {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly passwordHashing: PasswordHashing,
    private readonly loginPolicy: LoginPolicy,
  ) {}

  async execute(input: LoginWithPasswordInput): Promise<LoginWithPasswordOutput> {
    const user = await this.userRepo.findByEmail(input.email);
    if (user === null || user.passwordHash === null) {
      throw new InvalidCredentialsError();
    }

    const passwordValid = await this.passwordHashing.verify(input.password, user.passwordHash);
    if (!passwordValid) {
      throw new InvalidCredentialsError();
    }

    await this.loginPolicy.assertSecondFactor(user.id, input.totp);

    return this.loginPolicy.issueSession(user.id);
  }
}
