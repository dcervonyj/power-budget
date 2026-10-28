import { Module } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { SystemModule } from '../system/SystemModule.js';
import type { NotificationOutbox } from '../../domain/notifications/ports.js';
import { DatabaseModule } from '../database/database.module.js';
import { QueueModule } from '../queue/queue.module.js';
import { QUEUE_NOTIFICATION_DISPATCH } from '../queue/queue.constants.js';
import { DrizzleNotificationRepository } from './DrizzleNotificationRepository.js';
import { DrizzleNotificationOutbox } from './DrizzleNotificationOutbox.js';
import { NOTIFICATION_OUTBOX } from './notification-tokens.js';
import {
  BullMQNotificationDispatchQueue,
  type DispatchNotificationJobPayload,
} from './BullMQNotificationDispatchQueue.js';
import { EnqueueNotificationUseCase } from '../../application/notifications/use-cases/EnqueueNotificationUseCase.js';

/**
 * Notification adapters shared by the API and the worker (outbox repository and writer,
 * dispatch-queue producer and enqueue use case). Dispatch processor, the email
 * channel and the digest / reminder / relay crons live in NotificationsWorkerModule,
 * which only the worker loads.
 */
@Module({
  imports: [DatabaseModule, QueueModule, SystemModule],
  providers: [
    DrizzleNotificationRepository,
    {
      provide: BullMQNotificationDispatchQueue,
      inject: [getQueueToken(QUEUE_NOTIFICATION_DISPATCH)],
      useFactory: (queue: Queue<DispatchNotificationJobPayload>) =>
        new BullMQNotificationDispatchQueue(queue),
    },
    { provide: NOTIFICATION_OUTBOX, useClass: DrizzleNotificationOutbox },
    {
      provide: EnqueueNotificationUseCase,
      inject: [NOTIFICATION_OUTBOX],
      useFactory: (outbox: NotificationOutbox) => new EnqueueNotificationUseCase(outbox),
    },
  ],
  exports: [
    DrizzleNotificationRepository,
    BullMQNotificationDispatchQueue,
    NOTIFICATION_OUTBOX,
    EnqueueNotificationUseCase,
  ],
})
export class NotificationsModule {}
