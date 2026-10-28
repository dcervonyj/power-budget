import { describe, it, expect, beforeEach } from 'vitest';
import type { HouseholdId, UserId } from '@power-budget/core';
import { EnqueueNotificationUseCase } from '../application/notifications/use-cases/EnqueueNotificationUseCase.js';
import { OverBudgetDetectorUseCase } from '../application/notifications/use-cases/OverBudgetDetectorUseCase.js';
import { InMemoryNotificationRepository } from '../test/doubles/InMemoryNotificationRepository.js';

const TEST_HOUSEHOLD_ID = 'test-household-001' as HouseholdId;
const TEST_USER_ID = 'test-user-001' as UserId;

describe('Notification E2E flow', () => {
  let repo: InMemoryNotificationRepository;
  let enqueueNotification: EnqueueNotificationUseCase;

  beforeEach(() => {
    repo = new InMemoryNotificationRepository();
    enqueueNotification = new EnqueueNotificationUseCase(repo);

    repo.addUser(TEST_USER_ID, {
      email: 'test@example.com',
      displayName: 'Test User',
      locale: 'en',
    });
  });

  describe('EnqueueNotificationUseCase', () => {
    it('enqueues an over_budget notification', async () => {
      await enqueueNotification.execute({
        recipientUserId: TEST_USER_ID,
        householdId: TEST_HOUSEHOLD_ID,
        kind: 'over_budget',
        dedupeKey: `${TEST_HOUSEHOLD_ID}:groceries:2024-01`,
        payload: {
          name: 'Test User',
          category: 'Groceries',
          amount: '950',
          planName: 'Monthly Budget',
          currency: 'PLN',
        },
      });

      expect(repo.outbox).toHaveLength(1);
      expect(repo.outbox[0]?.kind).toBe('over_budget');
      expect(repo.outbox[0]?.recipientUserId).toBe(TEST_USER_ID);
      expect(repo.outbox[0]?.householdId).toBe(TEST_HOUSEHOLD_ID);
    });

    it('enqueues a weekly_digest notification', async () => {
      await enqueueNotification.execute({
        recipientUserId: TEST_USER_ID,
        householdId: TEST_HOUSEHOLD_ID,
        kind: 'weekly_digest',
        dedupeKey: `${TEST_HOUSEHOLD_ID}:weekly:2024-W01`,
        payload: {
          name: 'Test User',
          planName: 'Monthly Budget',
          totalSpent: '4500',
          totalPlanned: '5000',
          currency: 'PLN',
          periodStart: '2024-01-01',
          periodEnd: '2024-01-07',
        },
      });

      expect(repo.outbox).toHaveLength(1);
      expect(repo.outbox[0]?.kind).toBe('weekly_digest');
    });

    it('deduplication: first enqueue stores the dedupeKey correctly', async () => {
      const input = {
        recipientUserId: TEST_USER_ID,
        householdId: TEST_HOUSEHOLD_ID,
        kind: 'over_budget' as const,
        dedupeKey: 'same-key',
        payload: {},
      };

      await enqueueNotification.execute(input);

      expect(repo.outbox).toHaveLength(1);
      expect(repo.outbox[0]?.dedupeKey).toBe('same-key');
    });

    it('notification starts with sentAt and failedAt as null', async () => {
      await enqueueNotification.execute({
        recipientUserId: TEST_USER_ID,
        householdId: TEST_HOUSEHOLD_ID,
        kind: 'over_budget',
        dedupeKey: 'initial-state-test',
        payload: {},
      });

      const notification = repo.outbox[0];
      expect(notification?.sentAt).toBeNull();
      expect(notification?.failedAt).toBeNull();
      expect(notification?.attempts).toBe(0);
    });
  });

  describe('OverBudgetDetectorUseCase', () => {
    it('enqueues an over_budget notification when spending crosses threshold', async () => {
      const detector = new OverBudgetDetectorUseCase(enqueueNotification);

      await detector.execute({
        recipientUserId: TEST_USER_ID,
        householdId: TEST_HOUSEHOLD_ID,
        categoryName: 'Food',
        planName: 'January Budget',
        actualAmountFormatted: '105.00',
        plannedAmountFormatted: '100.00',
        currency: 'PLN',
        recipientName: 'Test User',
        period: '2024-01',
      });

      expect(repo.outbox).toHaveLength(1);
      const notification = repo.outbox[0];
      expect(notification?.kind).toBe('over_budget');
      expect(notification?.householdId).toBe(TEST_HOUSEHOLD_ID);
      expect(notification?.recipientUserId).toBe(TEST_USER_ID);
      expect(notification?.dedupeKey).toBe(`${TEST_HOUSEHOLD_ID}:Food:2024-01`);
      expect(notification?.payload).toMatchObject({
        category: 'Food',
        currency: 'PLN',
        name: 'Test User',
        planName: 'January Budget',
        amount: '105.00',
      });
    });

    it('uses category+period as dedupeKey to avoid duplicate notifications', async () => {
      const detector = new OverBudgetDetectorUseCase(enqueueNotification);

      const input = {
        recipientUserId: TEST_USER_ID,
        householdId: TEST_HOUSEHOLD_ID,
        categoryName: 'Groceries',
        planName: 'Budget',
        actualAmountFormatted: '110.00',
        plannedAmountFormatted: '100.00',
        currency: 'EUR',
        recipientName: 'Test User',
        period: '2024-02',
      };

      await detector.execute(input);

      expect(repo.outbox[0]?.dedupeKey).toBe(`${TEST_HOUSEHOLD_ID}:Groceries:2024-02`);
    });
  });
});
