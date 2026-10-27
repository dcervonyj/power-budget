import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { formatMoney } from '@power-budget/core';
import type { CurrencyCode, HouseholdId, IsoDate, UserId } from '@power-budget/core';
import type {
  HouseholdMemberRow,
  WeeklyDigestSummary,
} from '../../../../domain/notifications/entities.js';
import type {
  NotificationRepository,
  WeeklyDigestRun,
  WeeklyDigestSummaryReader,
} from '../../../../domain/notifications/ports.js';
import type { EnqueueNotificationInput } from '../EnqueueNotificationUseCase.js';
import { EnqueueNotificationUseCase } from '../EnqueueNotificationUseCase.js';
import { DEFAULT_DIGEST_TIME_ZONE, RunWeeklyDigestUseCase } from '../RunWeeklyDigestUseCase.js';

const HH_ID = 'hh-1' as HouseholdId;
const USER_ID = 'u-1' as UserId;

const PLN = 'PLN' as CurrencyCode;

const SUMMARY: WeeklyDigestSummary = {
  planName: 'October',
  totalSpent: { amountMinor: 123456n, currency: PLN },
  totalPlanned: { amountMinor: 500000n, currency: PLN },
  periodStart: '2026-10-01' as IsoDate,
  periodEnd: '2026-10-31' as IsoDate,
};

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
  let members: HouseholdMemberRow[];
  let summaries: Map<UserId, WeeklyDigestSummary>;
  let failures: Map<UserId, Error>;
  let reads: Mock<WeeklyDigestRun['read']>;
  let startRun: Mock<WeeklyDigestSummaryReader['startRun']>;

  beforeEach(() => {
    members = [MEMBER];
    summaries = new Map([[USER_ID, SUMMARY]]);
    failures = new Map();
    enqueued = [];
    const repo = {
      listAllHouseholdMembers: vi.fn(async () => members),
    } as unknown as NotificationRepository;
    const enqueue = {
      execute: vi.fn(async (input: EnqueueNotificationInput) => {
        enqueued.push(input);
      }),
    } as unknown as EnqueueNotificationUseCase;
    reads = vi.fn(async (member: { readonly userId: UserId }) => {
      const failure = failures.get(member.userId);
      if (failure !== undefined) {
        throw failure;
      }

      return summaries.get(member.userId) ?? null;
    });
    const run: WeeklyDigestRun = { read: reads };
    startRun = vi.fn(() => run);
    const summaryReader: WeeklyDigestSummaryReader = { startRun };
    useCase = new RunWeeklyDigestUseCase(repo, enqueue, summaryReader);
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
          planName: 'October',
          totalSpent: formatMoney(SUMMARY.totalSpent, 'en'),
          totalPlanned: formatMoney(SUMMARY.totalPlanned, 'en'),
          currency: 'PLN',
          periodStart: '2026-10-01',
          periodEnd: '2026-10-31',
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

  it('formats the totals in the recipient locale', async () => {
    members = [{ ...MEMBER, locale: 'pl' }];

    await useCase.execute(new Date('2026-10-19T07:00:00Z'));

    expect(enqueued[0]?.payload['totalSpent']).toBe(formatMoney(SUMMARY.totalSpent, 'pl'));
    expect(enqueued[0]?.payload['totalSpent']).toMatch(/1\s?234,56\s?zł/);
  });

  it('falls back to English formatting for an unknown locale', async () => {
    members = [{ ...MEMBER, locale: 'de' }];

    await useCase.execute(new Date('2026-10-19T07:00:00Z'));

    expect(enqueued[0]?.payload['totalPlanned']).toBe(formatMoney(SUMMARY.totalPlanned, 'en'));
  });

  it('skips members without an active plan and bouncing members', async () => {
    const noPlan = { ...MEMBER, userId: 'u-2' as UserId };
    const bouncing = { ...MEMBER, userId: 'u-3' as UserId, emailBouncing: true };
    summaries.set(bouncing.userId, SUMMARY);
    members = [MEMBER, noPlan, bouncing];

    await useCase.execute(new Date('2026-10-19T07:00:00Z'));

    expect(enqueued.map((n) => n.recipientUserId)).toEqual([USER_ID]);
  });

  it('skips a failing member, counts it and still digests the other members', async () => {
    const failing = { ...MEMBER, userId: 'u-2' as UserId };
    const later = { ...MEMBER, userId: 'u-3' as UserId, householdId: 'hh-2' as HouseholdId };
    summaries.set(later.userId, SUMMARY);
    failures.set(failing.userId, new Error('FX_RATE_UNAVAILABLE: no EUR/PLN'));
    members = [failing, MEMBER, later];

    const result = await useCase.execute(new Date('2026-10-19T07:00:00Z'));

    expect(result).toEqual({
      skipped: [{ userId: 'u-2', reason: 'FX_RATE_UNAVAILABLE: no EUR/PLN' }],
    });
    expect(enqueued.map((n) => n.recipientUserId)).toEqual([USER_ID, 'u-3']);
  });

  it('counts a failing enqueue as a skipped member too', async () => {
    members = [MEMBER];
    const repo = {
      listAllHouseholdMembers: vi.fn(async () => members),
    } as unknown as NotificationRepository;
    const enqueue = {
      execute: vi.fn(async () => {
        throw new Error('outbox down');
      }),
    } as unknown as EnqueueNotificationUseCase;
    const run: WeeklyDigestRun = { read: async () => SUMMARY };

    const result = await new RunWeeklyDigestUseCase(repo, enqueue, {
      startRun: () => run,
    }).execute(new Date('2026-10-19T07:00:00Z'));

    expect(result).toEqual({ skipped: [{ userId: USER_ID, reason: 'outbox down' }] });
  });

  it('starts one run at the cron time and reads every member through it', async () => {
    const now = new Date('2026-10-19T07:00:00Z');
    const second = { ...MEMBER, userId: 'u-2' as UserId };
    members = [MEMBER, second];

    await useCase.execute(now);

    expect(startRun).toHaveBeenCalledTimes(1);
    expect(startRun).toHaveBeenCalledWith(now);
    expect(reads.mock.calls).toEqual([[MEMBER], [second]]);
  });
});
