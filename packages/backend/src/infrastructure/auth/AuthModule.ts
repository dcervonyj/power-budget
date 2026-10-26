import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { DatabaseModule } from '../database/database.module.js';
import { QueueModule } from '../queue/queue.module.js';
import { NotificationsModule } from '../notifications/NotificationsModule.js';
import { DrizzleUserRepository } from './DrizzleUserRepository.js';
import { DrizzleUserProfileRepository } from './DrizzleUserProfileRepository.js';
import { DrizzleHouseholdRepository } from './DrizzleHouseholdRepository.js';
import { DrizzleHouseholdExportRepository } from './DrizzleHouseholdExportRepository.js';
import { BullMQHouseholdExportQueue } from './BullMQHouseholdExportQueue.js';
import { Argon2PasswordHashing } from './Argon2PasswordHashing.js';
import { OtplibTotpVerifier } from './OtplibTotpVerifier.js';
import { JwtAccessTokenIssuerAdapter } from './JwtAccessTokenIssuer.js';
import { RedisRefreshTokenStore, REDIS_CLIENT } from './RedisRefreshTokenStore.js';
import { RedisTotpStepUpStore } from './RedisTotpStepUpStore.js';
import { RedisFailedAttemptCounter } from './RedisFailedAttemptCounter.js';
import { DrizzleMagicLinkTokenRepository } from './DrizzleMagicLinkTokenRepository.js';
import { DrizzleTotpSecretRepository } from './DrizzleTotpSecretRepository.js';
import { DrizzleHouseholdInviteRepository } from './DrizzleHouseholdInviteRepository.js';
import { DrizzleNotificationOutboxPort } from './DrizzleNotificationOutboxPort.js';
import { EnvKekEncryption } from './EnvKekEncryption.js';

@Module({
  imports: [DatabaseModule, ConfigModule, QueueModule, NotificationsModule],
  providers: [
    DrizzleUserRepository,
    DrizzleUserProfileRepository,
    DrizzleHouseholdRepository,
    DrizzleHouseholdExportRepository,
    BullMQHouseholdExportQueue,
    DrizzleTotpSecretRepository,
    DrizzleMagicLinkTokenRepository,
    DrizzleHouseholdInviteRepository,
    DrizzleNotificationOutboxPort,
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
    RedisFailedAttemptCounter,
    {
      // The optional ttlSeconds ctor param breaks decorator-metadata wiring —
      // instantiate explicitly with the default TTL.
      provide: RedisTotpStepUpStore,
      inject: [REDIS_CLIENT],
      useFactory: (redis: Redis) => new RedisTotpStepUpStore(redis),
    },
    {
      provide: EnvKekEncryption,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new EnvKekEncryption(config.get<string>('KEK_BASE64') ?? ''),
    },
  ],
  exports: [
    DrizzleUserProfileRepository,
    REDIS_CLIENT,
    DrizzleUserRepository,
    DrizzleHouseholdRepository,
    DrizzleHouseholdExportRepository,
    BullMQHouseholdExportQueue,
    DrizzleTotpSecretRepository,
    DrizzleMagicLinkTokenRepository,
    DrizzleHouseholdInviteRepository,
    DrizzleNotificationOutboxPort,
    Argon2PasswordHashing,
    OtplibTotpVerifier,
    JwtAccessTokenIssuerAdapter,
    RedisRefreshTokenStore,
    RedisTotpStepUpStore,
    RedisFailedAttemptCounter,
    EnvKekEncryption,
  ],
})
export class AuthModule {}
