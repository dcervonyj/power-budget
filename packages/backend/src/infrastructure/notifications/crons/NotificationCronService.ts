import { Injectable, Inject, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  DEFAULT_DIGEST_TIME_ZONE,
  RunWeeklyDigestUseCase,
} from '../../../application/notifications/use-cases/RunWeeklyDigestUseCase.js';
import { RunReconnectRemindersUseCase } from '../../../application/notifications/use-cases/RunReconnectRemindersUseCase.js';
import type {
  NotificationDispatchQueue,
  NotificationRepository,
} from '../../../domain/notifications/ports.js';
import { DrizzleNotificationRepository } from '../DrizzleNotificationRepository.js';
import { BullMQNotificationDispatchQueue } from '../BullMQNotificationDispatchQueue.js';

@Injectable()
export class NotificationCronService {
  private readonly logger = new Logger(NotificationCronService.name);

  constructor(
    @Inject(RunWeeklyDigestUseCase)
    private readonly weeklyDigestUseCase: RunWeeklyDigestUseCase,
    @Inject(RunReconnectRemindersUseCase)
    private readonly reconnectRemindersUseCase: RunReconnectRemindersUseCase,
    @Inject(DrizzleNotificationRepository)
    private readonly notificationRepo: NotificationRepository,
    @Inject(BullMQNotificationDispatchQueue)
    private readonly dispatchQueue: NotificationDispatchQueue,
  ) {}

  /** Monday 08:00 Europe/Warsaw (not server time) — enqueue weekly digest for all household members */
  @Cron('0 8 * * 1', { name: 'weekly-digest', timeZone: DEFAULT_DIGEST_TIME_ZONE })
  async runWeeklyDigest(): Promise<void> {
    const { skipped } = await this.weeklyDigestUseCase.execute(
      new Date(),
      DEFAULT_DIGEST_TIME_ZONE,
    );
    if (skipped.length > 0) {
      this.logger.warn(
        `weekly-digest skipped ${skipped.length} member(s): ` +
          skipped.map((member) => `${member.userId} (${member.reason})`).join('; '),
      );
    }
    await this.relayPendingToQueue();
  }

  /** Daily 09:00 Europe/Warsaw — check for expiring bank connections and enqueue reminders */
  @Cron('0 9 * * *', { name: 'reconnect-reminders', timeZone: DEFAULT_DIGEST_TIME_ZONE })
  async runReconnectReminders(): Promise<void> {
    await this.reconnectRemindersUseCase.execute();
    await this.relayPendingToQueue();
  }

  /**
   * Every 5 minutes — schedule every pending outbox row (rows written without an
   * immediate schedule, or whose jobs ran out of BullMQ attempts).
   */
  @Cron('*/5 * * * *', { name: 'outbox-relay' })
  async relayOutbox(): Promise<void> {
    await this.relayPendingToQueue();
  }

  private async relayPendingToQueue(): Promise<void> {
    const pending = await this.notificationRepo.findPendingBatch(100);
    for (const notification of pending) {
      await this.dispatchQueue.schedule(notification.id);
    }
  }
}
