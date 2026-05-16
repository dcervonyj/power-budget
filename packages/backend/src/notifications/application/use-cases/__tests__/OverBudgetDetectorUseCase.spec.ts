import { describe, it, expect, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { UserId, HouseholdId } from '@power-budget/core';
import type { NotificationRepository } from '../../../domain/ports.js';
import { EnqueueNotificationUseCase } from '../EnqueueNotificationUseCase.js';
import { OverBudgetDetectorUseCase } from '../OverBudgetDetectorUseCase.js';

const USER_ID = '01900000-0000-7000-8000-000000000001' as UserId;
const HOUSEHOLD_ID = '01900000-0000-7000-8000-000000000002' as HouseholdId;

describe('OverBudgetDetectorUseCase', () => {
  let notificationRepo: ReturnType<typeof mock<NotificationRepository>>;
  let enqueueNotification: EnqueueNotificationUseCase;
  let useCase: OverBudgetDetectorUseCase;

  beforeEach(() => {
    notificationRepo = mock<NotificationRepository>();
    notificationRepo.enqueue.mockResolvedValue(undefined);
    enqueueNotification = new EnqueueNotificationUseCase(notificationRepo);
    useCase = new OverBudgetDetectorUseCase(enqueueNotification);
  });

  it('enqueues an over_budget notification with the correct payload', async () => {
    await useCase.execute({
      recipientUserId: USER_ID,
      recipientName: 'Alice',
      householdId: HOUSEHOLD_ID,
      categoryName: 'Groceries',
      actualAmountFormatted: '150 PLN',
      plannedAmountFormatted: '100 PLN',
      planName: 'Monthly Budget',
      currency: 'PLN',
      period: '2024-01',
    });

    expect(notificationRepo.enqueue).toHaveBeenCalledOnce();
    const [arg] = notificationRepo.enqueue.mock.calls[0]!;
    expect(arg.kind).toBe('over_budget');
    expect(arg.recipientUserId).toBe(USER_ID);
    expect(arg.householdId).toBe(HOUSEHOLD_ID);
    expect(arg.payload).toMatchObject({
      name: 'Alice',
      category: 'Groceries',
      amount: '150 PLN',
      planName: 'Monthly Budget',
      currency: 'PLN',
    });
  });

  it('generates a dedupeKey combining householdId, categoryName, and period', async () => {
    await useCase.execute({
      recipientUserId: USER_ID,
      recipientName: 'Alice',
      householdId: HOUSEHOLD_ID,
      categoryName: 'Groceries',
      actualAmountFormatted: '100 PLN',
      plannedAmountFormatted: '80 PLN',
      planName: 'Budget',
      currency: 'PLN',
      period: '2024-W01',
    });

    const [arg] = notificationRepo.enqueue.mock.calls[0]!;
    expect(arg.dedupeKey).toBe(`${HOUSEHOLD_ID}:Groceries:2024-W01`);
  });
});
