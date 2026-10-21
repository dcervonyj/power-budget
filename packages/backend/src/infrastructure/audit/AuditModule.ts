import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module.js';
import { DrizzleAuditEventRepository } from './DrizzleAuditEventRepository.js';
import { RedactingAuditLogger } from './RedactingAuditLogger.js';

/** AuditLogger (domain/audit) that redacts before writing. Inject this, never the repository. */
export const REDACTING_AUDIT_LOGGER = 'REDACTING_AUDIT_LOGGER';
/** AuditLogPort (domain/plans): the same redacting instance. */
export const AUDIT_LOG_PORT = 'AUDIT_LOG_PORT';

@Module({
  imports: [DatabaseModule, ConfigModule],
  providers: [
    DrizzleAuditEventRepository,
    {
      provide: REDACTING_AUDIT_LOGGER,
      inject: [DrizzleAuditEventRepository, ConfigService],
      useFactory: (repo: DrizzleAuditEventRepository, config: ConfigService) => {
        const thresholdStr = config.get<string>('AUDIT_REDACTION_THRESHOLD_MINOR') ?? '1000000';
        const thresholdMinor = BigInt(thresholdStr);

        return new RedactingAuditLogger(repo, { thresholdMinor });
      },
    },
    { provide: AUDIT_LOG_PORT, useExisting: REDACTING_AUDIT_LOGGER },
  ],
  // DrizzleAuditEventRepository stays exported for the audit read endpoint only
  // (AuditController.listByHousehold); writers use the tokens above.
  exports: [DrizzleAuditEventRepository, REDACTING_AUDIT_LOGGER, AUDIT_LOG_PORT],
})
export class AuditModule {}
