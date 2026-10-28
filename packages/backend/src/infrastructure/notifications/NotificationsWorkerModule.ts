import { Module } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../config/AppConfig.js';
import { SystemModule, CLOCK } from '../system/SystemModule.js';
import type { Clock } from '../../domain/shared/ports.js';
import { QueueModule } from '../queue/queue.module.js';
import { PlansModule } from '../plans/PlansModule.js';
import { DrizzlePlanRepository } from '../plans/DrizzlePlanRepository.js';
import { PlanActualsService } from '../../application/plans/PlanActualsService.js';
import { NotificationsModule } from './NotificationsModule.js';
import { DrizzleNotificationRepository } from './DrizzleNotificationRepository.js';
import { ResendEmailChannel } from './ResendEmailChannel.js';
import { MjmlTemplateRenderer } from './MjmlTemplateRenderer.js';
import { PlanActualsWeeklyDigestSummaryReader } from './PlanActualsWeeklyDigestSummaryReader.js';
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
  imports: [QueueModule, NotificationsModule, PlansModule, SystemModule],
  providers: [
    {
      provide: ResendEmailChannel,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => {
        // A deployed worker without RESEND_API_KEY already failed AppConfig validation.
        return new ResendEmailChannel(config.resendApiKey, config.emailFrom);
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
        CLOCK,
      ],
      useFactory: (
        repo: DrizzleNotificationRepository,
        enqueue: EnqueueNotificationUseCase,
        summaries: PlanActualsWeeklyDigestSummaryReader,
        clock: Clock,
      ) => new RunWeeklyDigestUseCase(repo, enqueue, summaries, clock),
    },
    {
      provide: RunReconnectRemindersUseCase,
      inject: [DrizzleNotificationRepository, EnqueueNotificationUseCase, CLOCK],
      useFactory: (
        repo: DrizzleNotificationRepository,
        enqueue: EnqueueNotificationUseCase,
        clock: Clock,
      ) => new RunReconnectRemindersUseCase(repo, enqueue, clock),
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
