import { Module } from '@nestjs/common';
import type { MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './shared/health/health.module';
import { AuthPresentationModule } from './auth/presentation/AuthPresentationModule.js';
import { TransactionsPresentationModule } from './transactions/presentation/TransactionsPresentationModule.js';
import { AuditPresentationModule } from './audit/presentation/AuditPresentationModule.js';
import { BankPresentationModule } from './bank/presentation/BankPresentationModule.js';
import { PlansPresentationModule } from './plans/presentation/PlansPresentationModule.js';
import { NotificationsPresentationModule } from './notifications/presentation/NotificationsPresentationModule.js';
import { HouseholdsPresentationModule } from './households/presentation/HouseholdsPresentationModule.js';
import { RlsMiddleware } from './shared/infrastructure/database/RlsMiddleware.js';

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
    HouseholdsPresentationModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RlsMiddleware).forRoutes('*');
  }
}
