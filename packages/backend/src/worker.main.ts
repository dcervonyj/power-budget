import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker/worker.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    logger: ['log', 'warn', 'error'],
  });
  app.enableShutdownHooks();
  console.log(
    'Worker started — consuming queues: bank-sync, notification-dispatch, outbox-relay, period-close, ecb-fx, refresh-plan-actuals',
  );
}

bootstrap().catch((err) => {
  console.error('Worker bootstrap failed', err);
  process.exit(1);
});
