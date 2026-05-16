import type { UserId } from '@power-budget/core';

export interface RotateUserDekInput {
  readonly userId: UserId;
}

export interface RotateUserDekOutput {
  readonly fieldsRotated: number;
  readonly skipped: boolean;
}
