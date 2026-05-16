import { Module } from '@nestjs/common';
import type { MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module';
import { AuthPresentationModule } from './presentation/auth/AuthPresentationModule.js';
import { TransactionsPresentationModule } from './presentation/transactions/TransactionsPresentationModule.js';
import { AuditPresentationModule } from './presentation/audit/AuditPresentationModule.js';
import { BankPresentationModule } from './presentation/bank/BankPresentationModule.js';
import { PlansPresentationModule } from './presentation/plans/PlansPresentationModule.js';
import { NotificationsPresentationModule } from './presentation/notifications/NotificationsPresentationModule.js';
import { RlsMiddleware } from './infrastructure/database/RlsMiddleware.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    HealthModule,
    AuthPresentationModule,
    TransactionsPresentationModule,
    AuditPresentationModule,
    BankPresentationModule,
    PlansPresentationModule,
    NotificationsPresentationModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RlsMiddleware).forRoutes('*');
  }
}
