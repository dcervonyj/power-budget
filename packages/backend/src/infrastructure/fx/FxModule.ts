import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { DrizzleFxRateRepository } from './DrizzleFxRateRepository.js';

/** FX adapters shared by the API and the worker. The ingest cron lives in FxWorkerModule. */
@Module({
  imports: [DatabaseModule],
  providers: [DrizzleFxRateRepository],
  exports: [DrizzleFxRateRepository],
})
export class FxModule {}
