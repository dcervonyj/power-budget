import { Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { DiscoveryModule, DiscoveryService, ModuleRef } from '@nestjs/core';
import { BullModule, WorkerHost, getQueueToken } from '@nestjs/bullmq';
import type { Queue, Worker } from 'bullmq';
import { APP_CONFIG, type AppConfig } from '../../config/AppConfig.js';
import { ALL_QUEUES } from './queue.constants';
import { buildQueueConnectionOptions, releaseSharedQueueConnection } from './redis-connection.js';

@Module({
  imports: [
    DiscoveryModule,
    DiscoveryModule,
    BullModule.forRootAsync({
      useFactory: buildQueueConnectionOptions,
      inject: [APP_CONFIG],
    }),
    ...ALL_QUEUES.map((name) => BullModule.registerQueue({ name })),
  ],
  exports: [BullModule],
})
export class QueueModule implements OnApplicationShutdown {
  constructor(
    @Inject(APP_CONFIG) private readonly config: Pick<AppConfig, 'redisUrl'>,
    private readonly moduleRef: ModuleRef,
    private readonly discovery: DiscoveryService,
  ) {}

  /**
   * Runs once per context (API and embedded worker). @nestjs/bullmq closes its queues and
   * workers in their own onApplicationShutdown hooks, and Nest does not order those against
   * this one (measured: the connection was quit while they were still closing). So close
   * workers, then queues, here first (close() is idempotent), and only then release this
   * context's hold on the shared connection; the last holder quits it.
   */
  async onApplicationShutdown(): Promise<void> {
    await this.closeAll(this.workers());
    await this.closeAll(this.queues());
    await releaseSharedQueueConnection(this.config.redisUrl);
  }

  private workers(): Worker[] {
    const workers: Worker[] = [];
    for (const wrapper of this.discovery.getProviders()) {
      if (wrapper.instance instanceof WorkerHost) {
        const worker = this.workerOf(wrapper.instance);
        if (worker !== undefined) {
          workers.push(worker);
        }
      }
    }

    return workers;
  }

  /** `worker` throws until the processor is registered (never when the context booted). */
  private workerOf(host: WorkerHost): Worker | undefined {
    try {
      return host.worker;
    } catch {
      return undefined;
    }
  }

  private queues(): Queue[] {
    const queues: Queue[] = [];
    for (const name of ALL_QUEUES) {
      queues.push(this.moduleRef.get<Queue>(getQueueToken(name), { strict: false }));
    }

    return queues;
  }

  private async closeAll(targets: Array<{ close(): Promise<void> }>): Promise<void> {
    const closing: Array<Promise<void>> = [];
    for (const target of targets) {
      closing.push(target.close().catch(this.ignore));
    }
    await Promise.all(closing);
  }

  private ignore(): void {
    // Already closing or closed: nothing left to do.
  }
}
