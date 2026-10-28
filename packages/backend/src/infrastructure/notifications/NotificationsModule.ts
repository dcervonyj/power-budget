import { Module } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { DatabaseModule } from '../database/database.module.js';
import { QueueModule } from '../queue/queue.module.js';
import { QUEUE_NOTIFICATION_DISPATCH } from '../queue/queue.constants.js';
import { DrizzleNotificationRepository } from './DrizzleNotificationRepository.js';
import {
  BullMQNotificationDispatchQueue,
  type DispatchNotificationJobPayload,
} from './BullMQNotificationDispatchQueue.js';
import { EnqueueNotificationUseCase } from '../../application/notifications/use-cases/EnqueueNotificationUseCase.js';

/**
 * Notification adapters shared by the API and the worker (outbox repository,
 * dispatch-queue producer and enqueue use case). Dispatch processor, the email
 * channel and the digest / reminder / relay crons live in NotificationsWorkerModule,
 * which only the worker loads.
 */
@Module({
  imports: [DatabaseModule, QueueModule],
  providers: [
    DrizzleNotificationRepository,
    {
      provide: BullMQNotificationDispatchQueue,
      inject: [getQueueToken(QUEUE_NOTIFICATION_DISPATCH)],
      useFactory: (queue: Queue<DispatchNotificationJobPayload>) =>
        new BullMQNotificationDispatchQueue(queue),
    },
    {
      provide: EnqueueNotificationUseCase,
      inject: [DrizzleNotificationRepository],
      useFactory: (repo: DrizzleNotificationRepository) => new EnqueueNotificationUseCase(repo),
    },
  ],
  exports: [
    DrizzleNotificationRepository,
    BullMQNotificationDispatchQueue,
    EnqueueNotificationUseCase,
  ],
})
export class NotificationsModule {}
