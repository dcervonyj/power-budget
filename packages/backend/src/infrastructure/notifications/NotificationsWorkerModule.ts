import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { QueueModule } from '../queue/queue.module.js';
import { PlansModule } from '../plans/PlansModule.js';
import { DrizzlePlanRepository } from '../plans/DrizzlePlanRepository.js';
import { PlanActualsService } from '../../application/plans/PlanActualsService.js';
import { NotificationsModule } from './NotificationsModule.js';
import { DrizzleNotificationRepository } from './DrizzleNotificationRepository.js';
import { ResendEmailChannel } from './ResendEmailChannel.js';
import { MjmlTemplateRenderer } from './MjmlTemplateRenderer.js';
import { PlanActualsWeeklyDigestSummaryReader } from './PlanActualsWeeklyDigestSummaryReader.js';
import { resolveEmailConfig } from './email-config.js';
import { DispatchNotificationProcessor } from './workers/DispatchNotificationProcessor.js';
import { NotificationCronService } from './crons/NotificationCronService.js';
import { EnqueueNotificationUseCase } from '../../application/notifications/use-cases/EnqueueNotificationUseCase.js';
import { RunWeeklyDigestUseCase } from '../../application/notifications/use-cases/RunWeeklyDigestUseCase.js';
import { RunReconnectRemindersUseCase } from '../../application/notifications/use-cases/RunReconnectRemindersUseCase.js';

/**
 * Worker-only: the notification dispatch processor and the weekly-digest,
 * reconnect-reminder and outbox-relay crons. Imported by WorkerModule only.
 */
@Module({
  imports: [ConfigModule, QueueModule, NotificationsModule, PlansModule],
  providers: [
    {
      provide: ResendEmailChannel,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        // Boot check: a deployed worker without RESEND_API_KEY refuses to start.
        const email = resolveEmailConfig({
          RESEND_API_KEY: config.get<string>('RESEND_API_KEY'),
          EMAIL_FROM: config.get<string>('EMAIL_FROM'),
          NODE_ENV: config.get<string>('NODE_ENV'),
        });

        return new ResendEmailChannel(email.resendApiKey, email.from);
      },
    },
    {
      provide: MjmlTemplateRenderer,
      useFactory: () => new MjmlTemplateRenderer(),
    },
    {
      provide: PlanActualsWeeklyDigestSummaryReader,
      inject: [DrizzlePlanRepository, PlanActualsService],
      useFactory: (plans: DrizzlePlanRepository, actuals: PlanActualsService) =>
        new PlanActualsWeeklyDigestSummaryReader(plans, actuals),
    },
    {
      provide: RunWeeklyDigestUseCase,
      inject: [
        DrizzleNotificationRepository,
        EnqueueNotificationUseCase,
        PlanActualsWeeklyDigestSummaryReader,
      ],
      useFactory: (
        repo: DrizzleNotificationRepository,
        enqueue: EnqueueNotificationUseCase,
        summaries: PlanActualsWeeklyDigestSummaryReader,
      ) => new RunWeeklyDigestUseCase(repo, enqueue, summaries),
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
    NotificationCronService,
  ],
})
export class NotificationsWorkerModule {}
