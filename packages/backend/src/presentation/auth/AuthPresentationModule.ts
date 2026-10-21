import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import type { Redis } from 'ioredis';
import { AuthModule } from '../../infrastructure/auth/AuthModule.js';
import { AuthController } from './AuthController.js';
import { UsersController } from './UsersController.js';
import { HouseholdsController } from './HouseholdsController.js';
import { JwtAuthGuard } from './guards/JwtAuthGuard.js';
import { TotpStepUpGuard } from './guards/TotpStepUpGuard.js';
import { AppConfigAdapter } from './AppConfigAdapter.js';
import { DrizzleUserRepository } from '../../infrastructure/auth/DrizzleUserRepository.js';
import { DrizzleHouseholdRepository } from '../../infrastructure/auth/DrizzleHouseholdRepository.js';
import { DrizzleHouseholdExportRepository } from '../../infrastructure/auth/DrizzleHouseholdExportRepository.js';
import { BullMQHouseholdExportQueue } from '../../infrastructure/auth/BullMQHouseholdExportQueue.js';
import { DrizzleMagicLinkTokenRepository } from '../../infrastructure/auth/DrizzleMagicLinkTokenRepository.js';
import { DrizzleTotpSecretRepository } from '../../infrastructure/auth/DrizzleTotpSecretRepository.js';
import { DrizzleHouseholdInviteRepository } from '../../infrastructure/auth/DrizzleHouseholdInviteRepository.js';
import { DrizzleNotificationOutboxPort } from '../../infrastructure/auth/DrizzleNotificationOutboxPort.js';
import { Argon2PasswordHashing } from '../../infrastructure/auth/Argon2PasswordHashing.js';
import { OtplibTotpVerifier } from '../../infrastructure/auth/OtplibTotpVerifier.js';
import { JwtAccessTokenIssuerAdapter } from '../../infrastructure/auth/JwtAccessTokenIssuer.js';
import {
  RedisRefreshTokenStore,
  REDIS_CLIENT,
} from '../../infrastructure/auth/RedisRefreshTokenStore.js';
import { EnvKekEncryption } from '../../infrastructure/auth/EnvKekEncryption.js';
import { TotpAuthenticator } from '../../application/auth/services/TotpAuthenticator.js';
import { LoginPolicy } from '../../application/auth/services/LoginPolicy.js';
import { buildThrottlerOptions } from './throttling.js';
import { RedisTotpStepUpStore } from '../../infrastructure/auth/RedisTotpStepUpStore.js';
import { RegisterUserUseCase } from '../../application/auth/use-cases/RegisterUserUseCase.js';
import { LoginWithPasswordUseCase } from '../../application/auth/use-cases/LoginWithPasswordUseCase.js';
import { RequestMagicLinkUseCase } from '../../application/auth/use-cases/RequestMagicLinkUseCase.js';
import { ConsumeMagicLinkUseCase } from '../../application/auth/use-cases/ConsumeMagicLinkUseCase.js';
import { EnableTotpUseCase } from '../../application/auth/use-cases/EnableTotpUseCase.js';
import { VerifyTotpUseCase } from '../../application/auth/use-cases/VerifyTotpUseCase.js';
import { RefreshTokenUseCase } from '../../application/auth/use-cases/RefreshTokenUseCase.js';
import { LogoutUseCase } from '../../application/auth/use-cases/LogoutUseCase.js';
import { GetCurrentUserUseCase } from '../../application/auth/use-cases/GetCurrentUserUseCase.js';
import { UpdateLocalePreferenceUseCase } from '../../application/auth/use-cases/UpdateLocalePreferenceUseCase.js';
import { CreateHouseholdUseCase } from '../../application/auth/use-cases/CreateHouseholdUseCase.js';
import { InviteToHouseholdUseCase } from '../../application/auth/use-cases/InviteToHouseholdUseCase.js';
import { AcceptInviteUseCase } from '../../application/auth/use-cases/AcceptInviteUseCase.js';
import { ResendHouseholdInviteUseCase } from '../../application/auth/use-cases/ResendHouseholdInviteUseCase.js';
import { RevokeHouseholdInviteUseCase } from '../../application/auth/use-cases/RevokeHouseholdInviteUseCase.js';
import { ListHouseholdInvitesUseCase } from '../../application/auth/use-cases/ListHouseholdInvitesUseCase.js';
import { HouseholdAccess } from '../../application/auth/services/HouseholdAccess.js';
import { HouseholdInviteMailer } from '../../application/auth/services/HouseholdInviteMailer.js';
import { ExportHouseholdDataUseCase } from '../../application/auth/use-cases/ExportHouseholdDataUseCase.js';
import { DeleteHouseholdUseCase } from '../../application/auth/use-cases/DeleteHouseholdUseCase.js';
import { GetUserProfileUseCase } from '../../application/auth/use-cases/GetUserProfileUseCase.js';
import { UpdateUserProfileUseCase } from '../../application/auth/use-cases/UpdateUserProfileUseCase.js';
import { DrizzleUserProfileRepository } from '../../infrastructure/auth/DrizzleUserProfileRepository.js';

@Module({
  imports: [
    AuthModule,
    ConfigModule,
    // Per-IP and per-account limits on the credential endpoints, counted in Redis (audit H4).
    ThrottlerModule.forRootAsync({
      imports: [AuthModule],
      inject: [REDIS_CLIENT],
      useFactory: (redis: Redis) => buildThrottlerOptions(redis),
    }),
  ],
  controllers: [AuthController, UsersController, HouseholdsController],
  providers: [
    JwtAuthGuard,
    TotpStepUpGuard,
    {
      provide: TotpAuthenticator,
      inject: [
        DrizzleTotpSecretRepository,
        OtplibTotpVerifier,
        EnvKekEncryption,
        RedisTotpStepUpStore,
      ],
      useFactory: (
        totpSecretRepo: DrizzleTotpSecretRepository,
        totpVerifier: OtplibTotpVerifier,
        encryption: EnvKekEncryption,
        stepUpStore: RedisTotpStepUpStore,
      ) => new TotpAuthenticator(totpSecretRepo, totpVerifier, encryption, stepUpStore),
    },
    {
      provide: LoginPolicy,
      inject: [
        TotpAuthenticator,
        DrizzleHouseholdRepository,
        JwtAccessTokenIssuerAdapter,
        RedisRefreshTokenStore,
      ],
      useFactory: (
        totp: TotpAuthenticator,
        householdRepo: DrizzleHouseholdRepository,
        jwtIssuer: JwtAccessTokenIssuerAdapter,
        refreshTokenStore: RedisRefreshTokenStore,
      ) => new LoginPolicy(totp, householdRepo, jwtIssuer, refreshTokenStore),
    },
    AppConfigAdapter,
    {
      provide: RegisterUserUseCase,
      inject: [
        DrizzleUserRepository,
        DrizzleHouseholdRepository,
        Argon2PasswordHashing,
        JwtAccessTokenIssuerAdapter,
        RedisRefreshTokenStore,
      ],
      useFactory: (
        userRepo: DrizzleUserRepository,
        householdRepo: DrizzleHouseholdRepository,
        passwordHashing: Argon2PasswordHashing,
        jwtIssuer: JwtAccessTokenIssuerAdapter,
        refreshTokenStore: RedisRefreshTokenStore,
      ) =>
        new RegisterUserUseCase(
          userRepo,
          householdRepo,
          passwordHashing,
          jwtIssuer,
          refreshTokenStore,
        ),
    },
    {
      provide: LoginWithPasswordUseCase,
      inject: [DrizzleUserRepository, Argon2PasswordHashing, LoginPolicy],
      useFactory: (
        userRepo: DrizzleUserRepository,
        passwordHashing: Argon2PasswordHashing,
        loginPolicy: LoginPolicy,
      ) => new LoginWithPasswordUseCase(userRepo, passwordHashing, loginPolicy),
    },
    {
      provide: RequestMagicLinkUseCase,
      inject: [
        DrizzleUserRepository,
        DrizzleMagicLinkTokenRepository,
        DrizzleNotificationOutboxPort,
        AppConfigAdapter,
      ],
      useFactory: (
        userRepo: DrizzleUserRepository,
        magicLinkTokenRepo: DrizzleMagicLinkTokenRepository,
        notificationOutbox: DrizzleNotificationOutboxPort,
        config: AppConfigAdapter,
      ) => new RequestMagicLinkUseCase(userRepo, magicLinkTokenRepo, notificationOutbox, config),
    },
    {
      provide: ConsumeMagicLinkUseCase,
      inject: [DrizzleMagicLinkTokenRepository, LoginPolicy],
      useFactory: (magicLinkTokenRepo: DrizzleMagicLinkTokenRepository, loginPolicy: LoginPolicy) =>
        new ConsumeMagicLinkUseCase(magicLinkTokenRepo, loginPolicy),
    },
    {
      provide: EnableTotpUseCase,
      inject: [DrizzleUserRepository, TotpAuthenticator],
      useFactory: (userRepo: DrizzleUserRepository, totp: TotpAuthenticator) =>
        new EnableTotpUseCase(userRepo, totp),
    },
    {
      provide: VerifyTotpUseCase,
      inject: [TotpAuthenticator],
      useFactory: (totp: TotpAuthenticator) => new VerifyTotpUseCase(totp),
    },
    {
      provide: RefreshTokenUseCase,
      inject: [DrizzleHouseholdRepository, JwtAccessTokenIssuerAdapter, RedisRefreshTokenStore],
      useFactory: (
        householdRepo: DrizzleHouseholdRepository,
        jwtIssuer: JwtAccessTokenIssuerAdapter,
        refreshTokenStore: RedisRefreshTokenStore,
      ) => new RefreshTokenUseCase(householdRepo, jwtIssuer, refreshTokenStore),
    },
    {
      provide: LogoutUseCase,
      inject: [RedisRefreshTokenStore],
      useFactory: (refreshTokenStore: RedisRefreshTokenStore) =>
        new LogoutUseCase(refreshTokenStore),
    },
    {
      provide: GetCurrentUserUseCase,
      inject: [DrizzleUserRepository],
      useFactory: (userRepo: DrizzleUserRepository) => new GetCurrentUserUseCase(userRepo),
    },
    {
      provide: UpdateLocalePreferenceUseCase,
      inject: [DrizzleUserRepository],
      useFactory: (userRepo: DrizzleUserRepository) => new UpdateLocalePreferenceUseCase(userRepo),
    },
    {
      provide: GetUserProfileUseCase,
      inject: [DrizzleUserProfileRepository],
      useFactory: (profileRepo: DrizzleUserProfileRepository) =>
        new GetUserProfileUseCase(profileRepo),
    },
    {
      provide: UpdateUserProfileUseCase,
      inject: [DrizzleUserProfileRepository],
      useFactory: (profileRepo: DrizzleUserProfileRepository) =>
        new UpdateUserProfileUseCase(profileRepo),
    },
    {
      provide: CreateHouseholdUseCase,
      inject: [DrizzleHouseholdRepository, DrizzleUserRepository],
      useFactory: (householdRepo: DrizzleHouseholdRepository, userRepo: DrizzleUserRepository) =>
        new CreateHouseholdUseCase(householdRepo, userRepo),
    },
    {
      provide: HouseholdAccess,
      inject: [DrizzleHouseholdRepository],
      useFactory: (householdRepo: DrizzleHouseholdRepository) => new HouseholdAccess(householdRepo),
    },
    {
      provide: HouseholdInviteMailer,
      inject: [
        DrizzleUserRepository,
        DrizzleHouseholdRepository,
        DrizzleNotificationOutboxPort,
        AppConfigAdapter,
      ],
      useFactory: (
        userRepo: DrizzleUserRepository,
        householdRepo: DrizzleHouseholdRepository,
        outbox: DrizzleNotificationOutboxPort,
        config: AppConfigAdapter,
      ) => new HouseholdInviteMailer(userRepo, householdRepo, outbox, config),
    },
    {
      provide: InviteToHouseholdUseCase,
      inject: [
        DrizzleHouseholdRepository,
        DrizzleUserRepository,
        DrizzleHouseholdInviteRepository,
        HouseholdAccess,
        HouseholdInviteMailer,
      ],
      useFactory: (
        householdRepo: DrizzleHouseholdRepository,
        userRepo: DrizzleUserRepository,
        inviteRepo: DrizzleHouseholdInviteRepository,
        access: HouseholdAccess,
        mailer: HouseholdInviteMailer,
      ) => new InviteToHouseholdUseCase(householdRepo, userRepo, inviteRepo, access, mailer),
    },
    {
      provide: ResendHouseholdInviteUseCase,
      inject: [
        DrizzleUserRepository,
        DrizzleHouseholdInviteRepository,
        HouseholdAccess,
        HouseholdInviteMailer,
      ],
      useFactory: (
        userRepo: DrizzleUserRepository,
        inviteRepo: DrizzleHouseholdInviteRepository,
        access: HouseholdAccess,
        mailer: HouseholdInviteMailer,
      ) => new ResendHouseholdInviteUseCase(userRepo, inviteRepo, access, mailer),
    },
    {
      provide: RevokeHouseholdInviteUseCase,
      inject: [DrizzleHouseholdInviteRepository, HouseholdAccess],
      useFactory: (inviteRepo: DrizzleHouseholdInviteRepository, access: HouseholdAccess) =>
        new RevokeHouseholdInviteUseCase(inviteRepo, access),
    },
    {
      provide: ListHouseholdInvitesUseCase,
      inject: [DrizzleHouseholdInviteRepository, HouseholdAccess],
      useFactory: (inviteRepo: DrizzleHouseholdInviteRepository, access: HouseholdAccess) =>
        new ListHouseholdInvitesUseCase(inviteRepo, access),
    },
    {
      provide: AcceptInviteUseCase,
      inject: [
        DrizzleHouseholdRepository,
        DrizzleUserRepository,
        DrizzleHouseholdInviteRepository,
        JwtAccessTokenIssuerAdapter,
      ],
      useFactory: (
        householdRepo: DrizzleHouseholdRepository,
        userRepo: DrizzleUserRepository,
        inviteRepo: DrizzleHouseholdInviteRepository,
        jwtIssuer: JwtAccessTokenIssuerAdapter,
      ) => new AcceptInviteUseCase(householdRepo, userRepo, inviteRepo, jwtIssuer),
    },
    {
      provide: ExportHouseholdDataUseCase,
      inject: [DrizzleHouseholdExportRepository, BullMQHouseholdExportQueue],
      useFactory: (
        exportRepo: DrizzleHouseholdExportRepository,
        exportQueue: BullMQHouseholdExportQueue,
      ) => new ExportHouseholdDataUseCase(exportRepo, exportQueue),
    },
    {
      provide: DeleteHouseholdUseCase,
      inject: [DrizzleHouseholdRepository],
      useFactory: (householdRepo: DrizzleHouseholdRepository) =>
        new DeleteHouseholdUseCase(householdRepo),
    },
  ],
})
export class AuthPresentationModule {}
