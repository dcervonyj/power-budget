import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module';
import { AuthPresentationModule } from './presentation/auth/AuthPresentationModule.js';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), HealthModule, AuthPresentationModule],
})
export class AppModule {}
