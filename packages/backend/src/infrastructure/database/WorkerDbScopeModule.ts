import { Global, Module } from '@nestjs/common';
import { DB_FALLBACK_SCOPE } from './database.module.js';
import type { DbScope } from './DbScope.js';

const WORKER_SCOPE: DbScope = { kind: 'system', reason: 'worker' };

/**
 * Worker-only: BullMQ processors and crons work across households (sync every connection,
 * close every plan period), so their statements run with the RLS bypass. Imported by
 * WorkerModule only, never by AppModule.
 */
@Global()
@Module({
  providers: [{ provide: DB_FALLBACK_SCOPE, useValue: WORKER_SCOPE }],
  exports: [DB_FALLBACK_SCOPE],
})
export class WorkerDbScopeModule {}
