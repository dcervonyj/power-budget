import { describe, it, expect } from 'vitest';
import type { HouseholdId, UserId } from '@power-budget/core';
import { EnqueueNotificationUseCase } from '../EnqueueNotificationUseCase.js';
import { InMemoryNotificationRepository } from '../../../../test/doubles/InMemoryNotificationRepository.js';
import { SequentialIdGenerator } from '../../../../test/doubles/SequentialIdGenerator.js';

const USER = 'user-1' as UserId;
const HOUSEHOLD = 'hh-1' as HouseholdId;

describe('EnqueueNotificationUseCase', () => {
  it('stamps each outbox row with the next id from the IdGenerator', async () => {
    const repo = new InMemoryNotificationRepository();
    const useCase = new EnqueueNotificationUseCase(repo);

    await useCase.execute({
      recipientUserId: USER,
      householdId: HOUSEHOLD,
      kind: 'over_budget',
      dedupeKey: 'a',
      payload: {},
    });
    await useCase.execute({
      recipientUserId: USER,
      kind: 'over_budget',
      dedupeKey: 'b',
      payload: {},
    });

    expect(repo.outbox.map((row) => row.id)).toEqual([
      SequentialIdGenerator.idAt(1),
      SequentialIdGenerator.idAt(2),
    ]);
  });
});
