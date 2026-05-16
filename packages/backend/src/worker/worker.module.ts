import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BankModule } from '../infrastructure/bank/BankModule.js';
import { QueueModule } from '../infrastructure/queue/queue.module.js';
import { PlansModule } from '../infrastructure/plans/PlansModule.js';

/**
 * Worker-only module — no HTTP server, no presentation layer.
 * Loads queue consumers for all background queues.
 * Per ARCHITECTURE.md §9: dedicated NestJS bootstrap process.
 */
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), QueueModule, BankModule, PlansModule],
})
export class WorkerModule {}
