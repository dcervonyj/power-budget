import { describe, it, expect } from 'vitest';
import { HouseholdId, UserId } from '@power-budget/core';
import { EnqueueNotificationUseCase } from '../EnqueueNotificationUseCase.js';
import { InMemoryNotificationRepository } from '../../../../test/doubles/InMemoryNotificationRepository.js';
import { SequentialIdGenerator } from '../../../../test/doubles/SequentialIdGenerator.js';

const USER = UserId.of('01900000-9dff-7fe4-8508-52c20c8876f6');
const HOUSEHOLD = HouseholdId.of('01900000-b56d-7643-8d0f-31b1680a84b6');

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
