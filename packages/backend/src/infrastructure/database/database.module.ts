import { Module } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../config/AppConfig.js';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../../../drizzle/schema.js';
import type { DbScope } from './DbScope.js';
import { ScopedPool } from './ScopedPool.js';

export const DRIZZLE_DB = 'DRIZZLE_DB';

/**
 * Optional DbScope used when no request scope is active. Only the worker provides it
 * (WorkerDbScopeModule: system scope). The API has none, so a statement outside a request
 * scope sees no RLS-protected rows.
 */
export const DB_FALLBACK_SCOPE = 'DB_FALLBACK_SCOPE';

@Module({
  providers: [
    {
      provide: DRIZZLE_DB,
      inject: [APP_CONFIG, { token: DB_FALLBACK_SCOPE, optional: true }],
      useFactory: (config: AppConfig, fallbackScope: DbScope | undefined) => {
        const pool = ScopedPool.create(
          {
            connectionString: config.databaseUrl,
          },
          fallbackScope ?? null,
        );

        return drizzle(pool, { schema });
      },
    },
  ],
  exports: [DRIZZLE_DB],
})
export class DatabaseModule {}
