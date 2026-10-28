import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { APP_CONFIG } from '../../config/AppConfig.js';
import { ALL_QUEUES } from './queue.constants';
import { buildQueueConnectionOptions } from './redis-connection.js';

@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: buildQueueConnectionOptions,
      inject: [APP_CONFIG],
    }),
    ...ALL_QUEUES.map((name) => BullModule.registerQueue({ name })),
  ],
  exports: [BullModule],
})
export class QueueModule {}
