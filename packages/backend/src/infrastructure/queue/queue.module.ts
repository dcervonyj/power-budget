import { Inject, Logger, Module, type OnApplicationShutdown } from '@nestjs/common';
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
  private readonly logger = new Logger(QueueModule.name);

  constructor(
    @Inject(APP_CONFIG) private readonly config: Pick<AppConfig, 'redisUrl' | 'role'>,
    @Inject(ModuleRef) private readonly moduleRef: ModuleRef,
    @Inject(DiscoveryService) private readonly discovery: DiscoveryService,
  ) {}

  /**
   * Runs once per context (API and embedded worker). @nestjs/bullmq closes its queues and
   * workers in their own onApplicationShutdown hooks, and Nest does not order those against
   * this one (measured: the connection was quit while they were still closing). So close
   * workers, then queues, here first (close() is idempotent), and only then release this
   * context's hold on the shared connection; the last holder quits it (the only place the
   * connection is closed in production). If any close failed, every failure is logged with
   * the resource name, the connection is NOT released (a resource may still be using it),
   * and the hook rejects with an AggregateError.
   */
  async onApplicationShutdown(): Promise<void> {
    const failures = [
      ...(await this.closeAll(this.workers())),
      ...(await this.closeAll(this.queues())),
    ];
    if (failures.length > 0) {
      throw new AggregateError(failures, `${failures.length} queue/worker close(s) failed`);
    }
    await releaseSharedQueueConnection(this.config.redisUrl, this.config.role);
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

  private async closeAll(
    targets: Array<{ name: string; close(): Promise<void> }>,
  ): Promise<unknown[]> {
    const results = await Promise.allSettled(this.closeEach(targets));
    const failures: unknown[] = [];
    for (const [index, result] of results.entries()) {
      if (result.status === 'rejected') {
        this.logger.error(`Closing "${targets[index]?.name}" failed: ${String(result.reason)}`);
        failures.push(result.reason);
      }
    }

    return failures;
  }

  private closeEach(targets: Array<{ close(): Promise<void> }>): Array<Promise<void>> {
    const closing: Array<Promise<void>> = [];
    for (const target of targets) {
      closing.push(target.close());
    }

    return closing;
  }
}
