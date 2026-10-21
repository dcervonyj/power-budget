import { Module } from '@nestjs/common';
import { AuditModule } from '../../infrastructure/audit/AuditModule.js';
import { DrizzleAuditEventRepository } from '../../infrastructure/audit/DrizzleAuditEventRepository.js';
import { ListAuditLogUseCase } from '../../application/audit/use-cases/ListAuditLogUseCase.js';
import { AuditController } from './AuditController.js';

@Module({
  imports: [AuditModule],
  controllers: [AuditController],
  providers: [
    {
      provide: ListAuditLogUseCase,
      inject: [DrizzleAuditEventRepository],
      useFactory: (repo: DrizzleAuditEventRepository) => new ListAuditLogUseCase(repo),
    },
  ],
})
export class AuditPresentationModule {}
