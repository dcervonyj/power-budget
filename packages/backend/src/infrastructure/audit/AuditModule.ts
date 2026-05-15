import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module.js';
import { DrizzleAuditEventRepository } from './DrizzleAuditEventRepository.js';
import { RedactingAuditLogger } from './RedactingAuditLogger.js';

export const REDACTING_AUDIT_LOGGER = 'REDACTING_AUDIT_LOGGER';

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
  ],
  exports: [DrizzleAuditEventRepository, REDACTING_AUDIT_LOGGER],
})
export class AuditModule {}
