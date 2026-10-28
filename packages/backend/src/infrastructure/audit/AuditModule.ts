import { Module } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../config/AppConfig.js';
import { DatabaseModule } from '../database/database.module.js';
import { DrizzleAuditEventRepository } from './DrizzleAuditEventRepository.js';
import { RedactingAuditLogger } from './RedactingAuditLogger.js';

/** AuditLogger (domain/audit) that redacts before writing. Inject this, never the repository. */
export const REDACTING_AUDIT_LOGGER = 'REDACTING_AUDIT_LOGGER';
/** AuditLogPort (domain/plans): the same redacting instance. */
export const AUDIT_LOG_PORT = 'AUDIT_LOG_PORT';

@Module({
  imports: [DatabaseModule],
  providers: [
    DrizzleAuditEventRepository,
    {
      provide: REDACTING_AUDIT_LOGGER,
      inject: [DrizzleAuditEventRepository, APP_CONFIG],
      useFactory: (repo: DrizzleAuditEventRepository, config: AppConfig) => {
        return new RedactingAuditLogger(repo, {
          thresholdMinor: config.auditRedactionThresholdMinor,
        });
      },
    },
    { provide: AUDIT_LOG_PORT, useExisting: REDACTING_AUDIT_LOGGER },
  ],
  // DrizzleAuditEventRepository stays exported for the audit read endpoint only
  // (AuditController.listByHousehold); writers use the tokens above.
  exports: [DrizzleAuditEventRepository, REDACTING_AUDIT_LOGGER, AUDIT_LOG_PORT],
})
export class AuditModule {}
