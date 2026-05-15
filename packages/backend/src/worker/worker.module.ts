import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { QueueModule } from '../infrastructure/queue/queue.module';

/**
 * Worker-only module — no HTTP server, no presentation layer.
 * Loads queue consumers for all background queues.
 * Per ARCHITECTURE.md §9: dedicated NestJS bootstrap process.
 */
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), QueueModule],
})
export class WorkerModule {}
