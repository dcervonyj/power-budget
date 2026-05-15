import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module';
import { AuthPresentationModule } from './presentation/auth/AuthPresentationModule.js';
import { TransactionsPresentationModule } from './presentation/transactions/TransactionsPresentationModule.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    HealthModule,
    AuthPresentationModule,
    TransactionsPresentationModule,
  ],
})
export class AppModule {}
