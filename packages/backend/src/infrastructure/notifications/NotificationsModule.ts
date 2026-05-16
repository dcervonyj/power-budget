import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from '../database/database.module.js';
import { QueueModule } from '../queue/queue.module.js';
import { DrizzleNotificationRepository } from './DrizzleNotificationRepository.js';
import { ResendEmailChannel } from './ResendEmailChannel.js';
import { MjmlTemplateRenderer } from './MjmlTemplateRenderer.js';
import { DispatchNotificationProcessor } from './workers/DispatchNotificationProcessor.js';
import { OutboxRelayProcessor } from './workers/OutboxRelayProcessor.js';
import { NotificationCronService } from './crons/NotificationCronService.js';
import { EnqueueNotificationUseCase } from '../../application/notifications/use-cases/EnqueueNotificationUseCase.js';
import { RunWeeklyDigestUseCase } from '../../application/notifications/use-cases/RunWeeklyDigestUseCase.js';
import { RunReconnectRemindersUseCase } from '../../application/notifications/use-cases/RunReconnectRemindersUseCase.js';

@Module({
  imports: [DatabaseModule, ConfigModule, QueueModule, ScheduleModule.forRoot()],
  providers: [
    DrizzleNotificationRepository,
    {
      provide: ResendEmailChannel,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const apiKey = config.get<string>('RESEND_API_KEY') ?? '';
        return new ResendEmailChannel(apiKey);
      },
    },
    {
      provide: MjmlTemplateRenderer,
      useFactory: () => new MjmlTemplateRenderer(),
    },
    {
      provide: EnqueueNotificationUseCase,
      inject: [DrizzleNotificationRepository],
      useFactory: (repo: DrizzleNotificationRepository) => new EnqueueNotificationUseCase(repo),
    },
    {
      provide: RunWeeklyDigestUseCase,
      inject: [DrizzleNotificationRepository, EnqueueNotificationUseCase],
      useFactory: (repo: DrizzleNotificationRepository, enqueue: EnqueueNotificationUseCase) =>
        new RunWeeklyDigestUseCase(repo, enqueue),
    },
    {
      provide: RunReconnectRemindersUseCase,
      inject: [DrizzleNotificationRepository, EnqueueNotificationUseCase],
      useFactory: (repo: DrizzleNotificationRepository, enqueue: EnqueueNotificationUseCase) =>
        new RunReconnectRemindersUseCase(repo, enqueue),
    },
    {
      provide: DispatchNotificationProcessor,
      inject: [DrizzleNotificationRepository, ResendEmailChannel, MjmlTemplateRenderer],
      useFactory: (
        repo: DrizzleNotificationRepository,
        email: ResendEmailChannel,
        renderer: MjmlTemplateRenderer,
      ) => new DispatchNotificationProcessor(repo, email, renderer),
    },
    {
      provide: OutboxRelayProcessor,
      inject: [DrizzleNotificationRepository, ResendEmailChannel, MjmlTemplateRenderer],
      useFactory: (
        repo: DrizzleNotificationRepository,
        email: ResendEmailChannel,
        renderer: MjmlTemplateRenderer,
      ) => new OutboxRelayProcessor(repo, email, renderer),
    },
    NotificationCronService,
  ],
  exports: [
    DrizzleNotificationRepository,
    EnqueueNotificationUseCase,
    RunWeeklyDigestUseCase,
    RunReconnectRemindersUseCase,
  ],
})
export class NotificationsModule {}
