import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { DatabaseModule } from '../database/database.module.js';
import { DrizzleUserRepository } from './DrizzleUserRepository.js';
import { DrizzleHouseholdRepository } from './DrizzleHouseholdRepository.js';
import { Argon2PasswordHashing } from './Argon2PasswordHashing.js';
import { OtplibTotpVerifier } from './OtplibTotpVerifier.js';
import { JwtAccessTokenIssuerAdapter } from './JwtAccessTokenIssuer.js';
import { RedisRefreshTokenStore, REDIS_CLIENT } from './RedisRefreshTokenStore.js';
import { DrizzleMagicLinkTokenRepository } from './DrizzleMagicLinkTokenRepository.js';
import { DrizzleTotpSecretRepository } from './DrizzleTotpSecretRepository.js';
import { DrizzleHouseholdInviteRepository } from './DrizzleHouseholdInviteRepository.js';
import { DrizzleNotificationOutboxPort } from './DrizzleNotificationOutboxPort.js';
import { DrizzleBankConnectionChecker } from './DrizzleBankConnectionChecker.js';
import { EnvKekEncryption } from './EnvKekEncryption.js';

@Module({
  imports: [DatabaseModule, ConfigModule],
  providers: [
    DrizzleUserRepository,
    DrizzleHouseholdRepository,
    DrizzleTotpSecretRepository,
    DrizzleMagicLinkTokenRepository,
    DrizzleHouseholdInviteRepository,
    DrizzleNotificationOutboxPort,
    DrizzleBankConnectionChecker,
    Argon2PasswordHashing,
    OtplibTotpVerifier,
    JwtAccessTokenIssuerAdapter,
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
        return new Redis(url);
      },
    },
    RedisRefreshTokenStore,
    {
      provide: EnvKekEncryption,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new EnvKekEncryption(config.get<string>('KEK_BASE64') ?? ''),
    },
  ],
  exports: [
    DrizzleUserRepository,
    DrizzleHouseholdRepository,
    DrizzleTotpSecretRepository,
    DrizzleMagicLinkTokenRepository,
    DrizzleHouseholdInviteRepository,
    DrizzleNotificationOutboxPort,
    DrizzleBankConnectionChecker,
    Argon2PasswordHashing,
    OtplibTotpVerifier,
    JwtAccessTokenIssuerAdapter,
    RedisRefreshTokenStore,
    EnvKekEncryption,
  ],
})
export class AuthModule {}
