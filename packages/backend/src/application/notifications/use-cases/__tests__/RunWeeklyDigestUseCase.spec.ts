import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { HouseholdId, UserId } from '@power-budget/core';
import type { HouseholdMemberRow } from '../../../../domain/notifications/entities.js';
import type { NotificationRepository } from '../../../../domain/notifications/ports.js';
import type { EnqueueNotificationInput } from '../EnqueueNotificationUseCase.js';
import { EnqueueNotificationUseCase } from '../EnqueueNotificationUseCase.js';
import { DEFAULT_DIGEST_TIME_ZONE, RunWeeklyDigestUseCase } from '../RunWeeklyDigestUseCase.js';

const HH_ID = 'hh-1' as HouseholdId;
const USER_ID = 'u-1' as UserId;

const MEMBER: HouseholdMemberRow = {
  householdId: HH_ID,
  userId: USER_ID,
  email: 'ann@example.com',
  displayName: 'Ann',
  locale: 'en',
  emailBouncing: false,
};

describe('RunWeeklyDigestUseCase', () => {
  let enqueued: EnqueueNotificationInput[];
  let useCase: RunWeeklyDigestUseCase;

  beforeEach(() => {
    enqueued = [];
    const repo = {
      listAllHouseholdMembers: vi.fn().mockResolvedValue([MEMBER]),
    } as unknown as NotificationRepository;
    const enqueue = {
      execute: vi.fn(async (input: EnqueueNotificationInput) => {
        enqueued.push(input);
      }),
    } as unknown as EnqueueNotificationUseCase;
    useCase = new RunWeeklyDigestUseCase(repo, enqueue);
  });

  it('defaults to Europe/Warsaw', () => {
    expect(DEFAULT_DIGEST_TIME_ZONE).toBe('Europe/Warsaw');
  });

  it.each([
    // Friday 1 Jan 2027 is in ISO week 53 of 2026 (the old code said 2027-W53).
    ['2027-01-01T10:00:00Z', '2026-W53'],
    // Monday 30 Dec 2024 is in ISO week 1 of 2025 (the old code said 2024-W01).
    ['2024-12-30T10:00:00Z', '2025-W01'],
    ['2026-10-19T07:00:00Z', '2026-W43'],
    ['2026-01-01T10:00:00Z', '2026-W01'],
  ])('labels %s with the ISO week-numbering year: %s', async (instant, label) => {
    await useCase.execute(new Date(instant));

    expect(enqueued).toEqual([
      {
        recipientUserId: USER_ID,
        householdId: HH_ID,
        kind: 'weekly_digest',
        dedupeKey: `${HH_ID}:${USER_ID}:${label}`,
        payload: {
          name: 'Ann',
          planName: '',
          totalSpent: '',
          totalPlanned: '',
          currency: '',
          periodStart: label,
          periodEnd: label,
        },
      },
    ]);
  });

  it('computes the week from the Warsaw calendar date, not the server (UTC) date', async () => {
    // Sunday 23:30 UTC is already Monday 00:30 in Warsaw (CET, UTC+1).
    const instant = new Date('2026-10-25T23:30:00Z');

    await useCase.execute(instant);
    await useCase.execute(instant, 'UTC');

    expect(enqueued.map((n) => n.dedupeKey)).toEqual([
      `${HH_ID}:${USER_ID}:2026-W44`,
      `${HH_ID}:${USER_ID}:2026-W43`,
    ]);
  });

  it('crosses the ISO year in the target zone', async () => {
    // Sunday 29 Dec 2024 23:30 UTC is Monday 30 Dec in Warsaw (2025-W01) but still 2024-W52 in UTC.
    const instant = new Date('2024-12-29T23:30:00Z');

    await useCase.execute(instant);
    await useCase.execute(instant, 'UTC');

    expect(enqueued.map((n) => n.dedupeKey)).toEqual([
      `${HH_ID}:${USER_ID}:2025-W01`,
      `${HH_ID}:${USER_ID}:2024-W52`,
    ]);
  });
});
