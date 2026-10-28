import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { AppConfig } from '../config/AppConfig.js';

export interface EmbeddedWorkerDeps {
  /** Loads and boots the worker context; only called when START_WORKER=true. */
  readonly boot: () => Promise<INestApplicationContext>;
  readonly log: (message: string) => void;
}

async function bootWorkerContext(): Promise<INestApplicationContext> {
  // Lazy import: with START_WORKER=false the worker module graph (processors, crons,
  // mjml, a second Redis/Postgres connection set) is never loaded (CLN-056 / PERF-05).
  const { WorkerModule } = await import('../worker/worker.module.js');

  return NestFactory.createApplicationContext(WorkerModule, {
    logger: ['log', 'warn', 'error'],
  });
}

/**
 * Free-tier topology (ADR-002): a single container runs API + worker. Standalone worker
 * deployments use dist/src/worker.main.js instead. Returns whether a worker was started.
 */
export async function startEmbeddedWorker(
  config: Pick<AppConfig, 'startWorker'>,
  deps: EmbeddedWorkerDeps = { boot: bootWorkerContext, log: console.log },
): Promise<boolean> {
  if (!config.startWorker) {
    return false;
  }
  const worker = await deps.boot();
  worker.enableShutdownHooks();
  deps.log('Embedded worker started (single-process free-tier topology)');

  return true;
}
