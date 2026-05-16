import { Module } from '@nestjs/common';
import { NotificationsModule } from '../infrastructure/NotificationsModule.js';
import { NotificationsController } from './NotificationsController.js';

@Module({
  imports: [NotificationsModule],
  controllers: [NotificationsController],
})
export class NotificationsPresentationModule {}
