import { describe, it, expect, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { HouseholdId, UserId, BankConnectionId } from '@power-budget/core';
import type { ExpiringConnectionRow } from '../../../../domain/notifications/entities.js';
import type { NotificationRepository } from '../../../../domain/notifications/ports.js';
import { EnqueueNotificationUseCase } from '../EnqueueNotificationUseCase.js';
import { RunReconnectRemindersUseCase } from '../RunReconnectRemindersUseCase.js';
import { FixedClock } from '../../../../test/doubles/FixedClock.js';
import { testUuid } from '../../../../test/doubles/testUuid.js';

const CONNECTION: ExpiringConnectionRow = {
  connectionId: BankConnectionId.of('01900000-78db-7ecf-8203-561e43789f28'),
  householdId: HouseholdId.of('01900000-b56d-7643-8d0f-31b1680a84b6'),
  userId: UserId.of('01900000-9dff-7fe4-8508-52c20c8876f6'),
  email: 'a@example.com',
  displayName: 'Ann',
  locale: 'en',
  bankId: 'PKO',
  expiresAt: new Date('2026-10-29T12:00:00Z'),
  emailBouncing: false,
};

describe('RunReconnectRemindersUseCase', () => {
  it('queries thresholds from the clock and counts days until expiry from it', async () => {
    const clock = new FixedClock('2026-10-26T09:00:00Z');
    const findExpiringConnections = vi.fn(async (threshold: Date) =>
      threshold.getTime() === new Date('2026-11-03T09:00:00Z').getTime() ? [CONNECTION] : [],
    );
    const repo = mock<NotificationRepository>({ findExpiringConnections });
    const execute = vi.fn(async () => undefined);
    const enqueue = mock<EnqueueNotificationUseCase>({ execute });

    await new RunReconnectRemindersUseCase(repo, enqueue, clock).execute();

    expect(findExpiringConnections.mock.calls.map(([date]) => date.toISOString())).toEqual([
      '2026-11-03T09:00:00.000Z',
      '2026-10-28T09:00:00.000Z',
      '2026-10-27T09:00:00.000Z',
    ]);
    expect(execute).toHaveBeenCalledExactlyOnceWith({
      recipientUserId: CONNECTION.userId,
      householdId: CONNECTION.householdId,
      kind: 'reconnect_reminder',
      dedupeKey: `${testUuid('conn-1')}:expires:2026-10-29:window7d`,
      payload: { name: 'Ann', connectionName: 'PKO', daysUntilExpiry: 3 },
    });
  });
});
