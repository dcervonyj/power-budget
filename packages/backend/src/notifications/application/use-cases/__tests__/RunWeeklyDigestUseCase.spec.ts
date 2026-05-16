import { describe, it, expect, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { UserId, HouseholdId } from '@power-budget/core';
import type { NotificationRepository } from '../../../domain/ports.js';
import type { HouseholdMemberRow } from '../../../domain/entities.js';
import { EnqueueNotificationUseCase } from '../EnqueueNotificationUseCase.js';
import { RunWeeklyDigestUseCase } from '../RunWeeklyDigestUseCase.js';

const USER_A = '01900000-0000-7000-8000-000000000001' as UserId;
const USER_B = '01900000-0000-7000-8000-000000000002' as UserId;
const HOUSEHOLD_ID = '01900000-0000-7000-8000-000000000010' as HouseholdId;

function makeMember(userId: UserId, overrides?: Partial<HouseholdMemberRow>): HouseholdMemberRow {
  return {
    householdId: HOUSEHOLD_ID,
    userId,
    email: `user-${userId}@example.com`,
    displayName: `User ${userId}`,
    locale: 'en',
    emailBouncing: false,
    ...overrides,
  };
}

describe('RunWeeklyDigestUseCase', () => {
  let notificationRepo: ReturnType<typeof mock<NotificationRepository>>;
  let enqueueNotification: EnqueueNotificationUseCase;
  let useCase: RunWeeklyDigestUseCase;

  beforeEach(() => {
    notificationRepo = mock<NotificationRepository>();
    notificationRepo.enqueue.mockResolvedValue(undefined);
    enqueueNotification = new EnqueueNotificationUseCase(notificationRepo);
    useCase = new RunWeeklyDigestUseCase(notificationRepo, enqueueNotification);
  });

  it('enqueues weekly_digest for all non-bouncing members', async () => {
    notificationRepo.listAllHouseholdMembers.mockResolvedValue([
      makeMember(USER_A),
      makeMember(USER_B),
    ]);

    await useCase.execute(new Date('2025-01-06'));

    expect(notificationRepo.enqueue).toHaveBeenCalledTimes(2);
    const kinds = notificationRepo.enqueue.mock.calls.map(([arg]) => arg.kind);
    expect(kinds).toEqual(['weekly_digest', 'weekly_digest']);
  });

  it('skips members with bouncing email', async () => {
    notificationRepo.listAllHouseholdMembers.mockResolvedValue([
      makeMember(USER_A, { emailBouncing: true }),
      makeMember(USER_B),
    ]);

    await useCase.execute(new Date('2025-01-06'));

    expect(notificationRepo.enqueue).toHaveBeenCalledTimes(1);
    const [arg] = notificationRepo.enqueue.mock.calls[0]!;
    expect(arg.recipientUserId).toBe(USER_B);
  });

  it('does not enqueue when there are no members', async () => {
    notificationRepo.listAllHouseholdMembers.mockResolvedValue([]);

    await useCase.execute(new Date('2025-01-06'));

    expect(notificationRepo.enqueue).not.toHaveBeenCalled();
  });

  it('uses a consistent dedupeKey per household/user/week', async () => {
    notificationRepo.listAllHouseholdMembers.mockResolvedValue([makeMember(USER_A)]);

    await useCase.execute(new Date('2025-01-06'));

    const [arg] = notificationRepo.enqueue.mock.calls[0]!;
    // ISO week 2025-W02 for 2025-01-06 (a Monday)
    expect(arg.dedupeKey).toMatch(/^.+:.+:2025-W\d{2}$/);
  });
});
