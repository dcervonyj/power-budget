import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { DrizzleAuditEventRepository } from './DrizzleAuditEventRepository.js';

@Module({
  imports: [DatabaseModule],
  providers: [DrizzleAuditEventRepository],
  exports: [DrizzleAuditEventRepository],
})
export class AuditModule {}
