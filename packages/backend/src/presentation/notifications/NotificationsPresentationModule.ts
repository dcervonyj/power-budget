import { Module } from '@nestjs/common';
import { NotificationsModule } from '../../infrastructure/notifications/NotificationsModule.js';
import { NotificationsController } from './NotificationsController.js';

@Module({
  imports: [NotificationsModule],
  controllers: [NotificationsController],
})
export class NotificationsPresentationModule {}
