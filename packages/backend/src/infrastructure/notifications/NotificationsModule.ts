import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module.js';
import { QueueModule } from '../queue/queue.module.js';
import { DrizzleNotificationRepository } from './DrizzleNotificationRepository.js';
import { EnqueueNotificationUseCase } from '../../application/notifications/use-cases/EnqueueNotificationUseCase.js';

/**
 * Notification adapters shared by the API and the worker (outbox repository and
 * enqueue use case). Dispatch processors, the email channel and the digest /
 * reminder / relay crons live in NotificationsWorkerModule, which only the worker loads.
 */
@Module({
  imports: [DatabaseModule, ConfigModule, QueueModule],
  providers: [
    DrizzleNotificationRepository,
    {
      provide: EnqueueNotificationUseCase,
      inject: [DrizzleNotificationRepository],
      useFactory: (repo: DrizzleNotificationRepository) => new EnqueueNotificationUseCase(repo),
    },
  ],
  exports: [DrizzleNotificationRepository, EnqueueNotificationUseCase],
})
export class NotificationsModule {}
