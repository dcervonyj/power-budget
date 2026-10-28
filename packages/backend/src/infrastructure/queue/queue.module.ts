import { Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { APP_CONFIG, type AppConfig } from '../../config/AppConfig.js';
import { ALL_QUEUES } from './queue.constants';
import { buildQueueConnectionOptions, releaseSharedQueueConnection } from './redis-connection.js';

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
export class QueueModule implements OnApplicationShutdown {
  constructor(@Inject(APP_CONFIG) private readonly config: Pick<AppConfig, 'redisUrl'>) {}

  /** Runs once per context (API and embedded worker) and releases that context's hold. */
  async onApplicationShutdown(): Promise<void> {
    await releaseSharedQueueConnection(this.config.redisUrl);
  }
}
