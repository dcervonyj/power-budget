import { Module } from '@nestjs/common';
import { AuditModule } from '../infrastructure/AuditModule.js';
import { AuditController } from './AuditController.js';

@Module({
  imports: [AuditModule],
  controllers: [AuditController],
})
export class AuditPresentationModule {}
