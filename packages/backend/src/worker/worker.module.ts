import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { QueueModule } from '../infrastructure/queue/queue.module.js';
import { WorkerDbScopeModule } from '../infrastructure/database/WorkerDbScopeModule.js';
import { BankWorkerModule } from '../infrastructure/bank/BankWorkerModule.js';
import { PlansWorkerModule } from '../infrastructure/plans/PlansWorkerModule.js';
import { NotificationsWorkerModule } from '../infrastructure/notifications/NotificationsWorkerModule.js';

/**
 * Worker-only module: no HTTP server, no presentation layer.
 * The ONLY place that registers BullMQ processors and @Cron jobs; the API
 * module graph (AppModule) imports producers/queues only. Booted by
 * worker.main.ts, or embedded next to the API when START_WORKER=true.
 * Crons need this process to be always on (a sleeping host skips them).
 * Per ARCHITECTURE.md §9: dedicated NestJS bootstrap process.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    // Cross-household jobs: statements run with the RLS bypass (CLN-005).
    WorkerDbScopeModule,
    QueueModule,
    BankWorkerModule,
    PlansWorkerModule,
    NotificationsWorkerModule,
  ],
})
export class WorkerModule {}
