import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import type { RunWeeklyDigestUseCase } from '../../../application/notifications/use-cases/RunWeeklyDigestUseCase.js';
import type { RunReconnectRemindersUseCase } from '../../../application/notifications/use-cases/RunReconnectRemindersUseCase.js';
import type { NotificationRepository } from '../../../domain/notifications/ports.js';
import { QUEUE_NOTIFICATION_DISPATCH } from '../../queue/queue.constants.js';
import type { DispatchNotificationJobPayload } from '../workers/DispatchNotificationProcessor.js';

@Injectable()
export class NotificationCronService {
  constructor(
    private readonly weeklyDigestUseCase: RunWeeklyDigestUseCase,
    private readonly reconnectRemindersUseCase: RunReconnectRemindersUseCase,
    private readonly notificationRepo: NotificationRepository,
    @InjectQueue(QUEUE_NOTIFICATION_DISPATCH)
    private readonly dispatchQueue: Queue<DispatchNotificationJobPayload>,
  ) {}

  /** Monday 08:00 — enqueue weekly digest for all household members */
  @Cron('0 8 * * 1')
  async runWeeklyDigest(): Promise<void> {
    await this.weeklyDigestUseCase.execute();
    await this.relayPendingToQueue();
  }

  /** Daily 09:00 — check for expiring bank connections and enqueue reminders */
  @Cron('0 9 * * *')
  async runReconnectReminders(): Promise<void> {
    await this.reconnectRemindersUseCase.execute();
    await this.relayPendingToQueue();
  }

  /** Every 5 minutes — relay pending outbox entries to the dispatch queue */
  @Cron('*/5 * * * *')
  async relayOutbox(): Promise<void> {
    await this.relayPendingToQueue();
  }

  private async relayPendingToQueue(): Promise<void> {
    const pending = await this.notificationRepo.findPendingBatch(100);
    for (const notification of pending) {
      await this.dispatchQueue.add(
        'dispatch',
        { outboxId: notification.id },
        {
          jobId: `dispatch:${notification.id}`,
          removeOnComplete: true,
          removeOnFail: false,
        },
      );
    }
  }
}
