import { describe, it, expect, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { UserId, HouseholdId } from '@power-budget/core';
import type { NotificationRepository } from '../../../domain/ports.js';
import type { ExpiringConnectionRow } from '../../../domain/entities.js';
import { EnqueueNotificationUseCase } from '../EnqueueNotificationUseCase.js';
import { RunReconnectRemindersUseCase } from '../RunReconnectRemindersUseCase.js';

const USER_ID = '01900000-0000-7000-8000-000000000001' as UserId;
const HOUSEHOLD_ID = '01900000-0000-7000-8000-000000000002' as HouseholdId;

const NOW = new Date('2025-01-10T00:00:00.000Z');

function makeExpiringConnection(overrides?: Partial<ExpiringConnectionRow>): ExpiringConnectionRow {
  return {
    connectionId: 'conn-1',
    householdId: HOUSEHOLD_ID,
    userId: USER_ID,
    email: 'alice@example.com',
    displayName: 'Alice',
    locale: 'en',
    bankId: 'PKO_PL',
    expiresAt: new Date('2025-01-11T00:00:00.000Z'),
    emailBouncing: false,
    ...overrides,
  };
}

describe('RunReconnectRemindersUseCase', () => {
  let notificationRepo: ReturnType<typeof mock<NotificationRepository>>;
  let enqueueNotification: EnqueueNotificationUseCase;
  let useCase: RunReconnectRemindersUseCase;

  beforeEach(() => {
    notificationRepo = mock<NotificationRepository>();
    notificationRepo.enqueue.mockResolvedValue(undefined);
    enqueueNotification = new EnqueueNotificationUseCase(notificationRepo);
    useCase = new RunReconnectRemindersUseCase(notificationRepo, enqueueNotification);
  });

  it('enqueues a reconnect_reminder for a connection expiring tomorrow', async () => {
    notificationRepo.findExpiringConnections.mockResolvedValue([makeExpiringConnection()]);

    await useCase.execute(NOW);

    expect(notificationRepo.enqueue).toHaveBeenCalled();
    const calls = notificationRepo.enqueue.mock.calls;
    const kinds = calls.map(([arg]) => arg.kind);
    expect(kinds.some((k) => k === 'reconnect_reminder')).toBe(true);
  });

  it('skips users with bouncing email', async () => {
    notificationRepo.findExpiringConnections.mockResolvedValue([
      makeExpiringConnection({ emailBouncing: true }),
    ]);

    await useCase.execute(NOW);

    expect(notificationRepo.enqueue).not.toHaveBeenCalled();
  });

  it('does not enqueue when no expiring connections are found', async () => {
    notificationRepo.findExpiringConnections.mockResolvedValue([]);

    await useCase.execute(NOW);

    expect(notificationRepo.enqueue).not.toHaveBeenCalled();
  });

  it('includes daysUntilExpiry in the payload', async () => {
    const expiresAt = new Date('2025-01-11T00:00:00.000Z');
    notificationRepo.findExpiringConnections.mockResolvedValue([makeExpiringConnection({ expiresAt })]);

    await useCase.execute(NOW);

    const enqueuedCalls = notificationRepo.enqueue.mock.calls.filter(
      ([arg]) => arg.kind === 'reconnect_reminder',
    );
    expect(enqueuedCalls.length).toBeGreaterThan(0);
    const [arg] = enqueuedCalls[0]!;
    expect((arg.payload as Record<string, unknown>)['daysUntilExpiry']).toBe(1);
  });
});
