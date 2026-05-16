import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../../../../drizzle/schema.js';

export const DRIZZLE_DB = 'DRIZZLE_DB';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: DRIZZLE_DB,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const pool = new Pool({
          connectionString:
            config.get<string>('DATABASE_URL') ??
            'postgresql://power_budget:power_budget@localhost:5432/power_budget',
        });
        return drizzle(pool, { schema });
      },
    },
  ],
  exports: [DRIZZLE_DB],
})
export class DatabaseModule {}
