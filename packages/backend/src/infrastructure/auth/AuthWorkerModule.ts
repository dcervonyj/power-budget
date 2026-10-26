import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { DrizzleHouseholdPurgeRepository } from './DrizzleHouseholdPurgeRepository.js';
import { HouseholdPurgeCronService } from './crons/HouseholdPurgeCronService.js';
import { PurgeDeletedHouseholdsUseCase } from '../../application/auth/use-cases/PurgeDeletedHouseholdsUseCase.js';

/**
 * Worker-only: the daily GDPR household purge cron (CLN-022). Imported by WorkerModule only,
 * so the purge runs under the worker's system DB scope and never in the API.
 */
@Module({
  imports: [DatabaseModule],
  providers: [
    DrizzleHouseholdPurgeRepository,
    {
      provide: PurgeDeletedHouseholdsUseCase,
      inject: [DrizzleHouseholdPurgeRepository],
      useFactory: (repo: DrizzleHouseholdPurgeRepository) =>
        new PurgeDeletedHouseholdsUseCase(repo),
    },
    HouseholdPurgeCronService,
  ],
})
export class AuthWorkerModule {}
