import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NotificationsModule } from '../../infrastructure/notifications/NotificationsModule.js';
import { DrizzleNotificationRepository } from '../../infrastructure/notifications/DrizzleNotificationRepository.js';
import { RecordEmailBounceUseCase } from '../../application/notifications/use-cases/RecordEmailBounceUseCase.js';
import { SvixWebhookVerifier } from '../../infrastructure/notifications/SvixWebhookVerifier.js';
import { NotificationsController } from './NotificationsController.js';

@Module({
  imports: [NotificationsModule, ConfigModule],
  controllers: [NotificationsController],
  providers: [
    {
      provide: RecordEmailBounceUseCase,
      inject: [DrizzleNotificationRepository],
      useFactory: (repo: DrizzleNotificationRepository) => new RecordEmailBounceUseCase(repo),
    },
    {
      provide: SvixWebhookVerifier,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new SvixWebhookVerifier(config.get<string>('RESEND_WEBHOOK_SECRET')),
    },
  ],
})
export class NotificationsPresentationModule {}
