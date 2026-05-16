import { describe, it, expect, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { UserId, HouseholdId } from '@power-budget/core';
import type { NotificationRepository } from '../../../domain/ports.js';
import { EnqueueNotificationUseCase } from '../EnqueueNotificationUseCase.js';

const USER_ID = '01900000-0000-7000-8000-000000000001' as UserId;
const HOUSEHOLD_ID = '01900000-0000-7000-8000-000000000002' as HouseholdId;

describe('EnqueueNotificationUseCase', () => {
  let notificationRepo: ReturnType<typeof mock<NotificationRepository>>;
  let useCase: EnqueueNotificationUseCase;

  beforeEach(() => {
    notificationRepo = mock<NotificationRepository>();
    useCase = new EnqueueNotificationUseCase(notificationRepo);
    notificationRepo.enqueue.mockResolvedValue(undefined);
  });

  it('calls notificationRepo.enqueue with a new UUID id', async () => {
    await useCase.execute({
      recipientUserId: USER_ID,
      householdId: HOUSEHOLD_ID,
      kind: 'over_budget',
      dedupeKey: 'test-key',
      payload: { name: 'Alice' },
    });

    expect(notificationRepo.enqueue).toHaveBeenCalledOnce();
    const [arg] = notificationRepo.enqueue.mock.calls[0]!;
    expect(arg.id).toBeTruthy();
    expect(typeof arg.id).toBe('string');
    expect(arg.recipientUserId).toBe(USER_ID);
    expect(arg.householdId).toBe(HOUSEHOLD_ID);
    expect(arg.kind).toBe('over_budget');
    expect(arg.dedupeKey).toBe('test-key');
    expect(arg.payload).toEqual({ name: 'Alice' });
  });

  it('sets householdId to null when not provided', async () => {
    await useCase.execute({
      recipientUserId: USER_ID,
      kind: 'weekly_digest',
      dedupeKey: 'key-2',
      payload: {},
    });

    const [arg] = notificationRepo.enqueue.mock.calls[0]!;
    expect(arg.householdId).toBeNull();
  });

  it('generates unique IDs on each call', async () => {
    await useCase.execute({ recipientUserId: USER_ID, kind: 'over_budget', dedupeKey: 'k1', payload: {} });
    await useCase.execute({ recipientUserId: USER_ID, kind: 'over_budget', dedupeKey: 'k2', payload: {} });

    const [first] = notificationRepo.enqueue.mock.calls[0]!;
    const [second] = notificationRepo.enqueue.mock.calls[1]!;
    expect(first.id).not.toBe(second.id);
  });
});
