import type { NotificationRepository } from '../../../domain/notifications/ports.js';
import type { EnqueueNotificationUseCase } from './EnqueueNotificationUseCase.js';

const REMINDER_WINDOWS_DAYS = [7, 1, 0] as const;

export class RunReconnectRemindersUseCase {
  constructor(
    private readonly notificationRepo: NotificationRepository,
    private readonly enqueueNotification: EnqueueNotificationUseCase,
  ) {}

  async execute(now: Date = new Date()): Promise<void> {
    for (const days of REMINDER_WINDOWS_DAYS) {
      const threshold = new Date(now);
      threshold.setDate(threshold.getDate() + days + 1);

      const expiring = await this.notificationRepo.findExpiringConnections(threshold);

      for (const conn of expiring) {
        if (conn.emailBouncing) continue;

        const daysUntilExpiry = Math.max(
          0,
          Math.floor((conn.expiresAt.getTime() - now.getTime()) / 86400000),
        );
        const periodLabel = conn.expiresAt.toISOString().slice(0, 10);

        await this.enqueueNotification.execute({
          recipientUserId: conn.userId,
          householdId: conn.householdId,
          kind: 'reconnect_reminder',
          dedupeKey: `${conn.connectionId}:expires:${periodLabel}:window${days}d`,
          payload: {
            name: conn.displayName,
            connectionName: conn.bankId,
            daysUntilExpiry,
          },
        });
      }
    }
  }
}
