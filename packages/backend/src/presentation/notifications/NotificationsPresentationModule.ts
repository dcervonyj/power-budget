import { Module } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../config/AppConfig.js';
import { NotificationsModule } from '../../infrastructure/notifications/NotificationsModule.js';
import { DrizzleNotificationRepository } from '../../infrastructure/notifications/DrizzleNotificationRepository.js';
import { RecordEmailBounceUseCase } from '../../application/notifications/use-cases/RecordEmailBounceUseCase.js';
import { SvixWebhookVerifier } from '../../infrastructure/notifications/SvixWebhookVerifier.js';
import { RESEND_WEBHOOK_VERIFIER } from './webhook-tokens.js';
import { NotificationsController } from './NotificationsController.js';

@Module({
  imports: [NotificationsModule],
  controllers: [NotificationsController],
  providers: [
    {
      provide: RecordEmailBounceUseCase,
      inject: [DrizzleNotificationRepository],
      useFactory: (repo: DrizzleNotificationRepository) => new RecordEmailBounceUseCase(repo),
    },
    {
      provide: RESEND_WEBHOOK_VERIFIER,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) =>
        new SvixWebhookVerifier(config.resendWebhookSecret ?? undefined),
    },
  ],
})
export class NotificationsPresentationModule {}
