import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { UserId, HouseholdId } from '@power-budget/core';

export interface AuthenticatedUser {
  userId: UserId;
  householdId: HouseholdId | null;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<FastifyRequest & { user: AuthenticatedUser }>();

    return request.user;
  },
);
