import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../infrastructure/AuthModule.js';
import { AuthController } from './AuthController.js';
import { UsersController } from './UsersController.js';
import { HouseholdsController } from './HouseholdsController.js';
import { JwtAuthGuard } from './guards/JwtAuthGuard.js';
import { TotpStepUpGuard } from './guards/TotpStepUpGuard.js';
import { AppConfigAdapter } from './AppConfigAdapter.js';
import { DrizzleUserRepository } from '../infrastructure/DrizzleUserRepository.js';
import { DrizzleHouseholdRepository } from '../infrastructure/DrizzleHouseholdRepository.js';
import { DrizzleHouseholdExportRepository } from '../infrastructure/DrizzleHouseholdExportRepository.js';
import { BullMQHouseholdExportQueue } from '../infrastructure/BullMQHouseholdExportQueue.js';
import { DrizzleMagicLinkTokenRepository } from '../infrastructure/DrizzleMagicLinkTokenRepository.js';
import { DrizzleTotpSecretRepository } from '../infrastructure/DrizzleTotpSecretRepository.js';
import { DrizzleHouseholdInviteRepository } from '../infrastructure/DrizzleHouseholdInviteRepository.js';
import { DrizzleNotificationOutboxPort } from '../infrastructure/DrizzleNotificationOutboxPort.js';
import { DrizzleBankConnectionChecker } from '../infrastructure/DrizzleBankConnectionChecker.js';
import { Argon2PasswordHashing } from '../infrastructure/Argon2PasswordHashing.js';
import { OtplibTotpVerifier } from '../infrastructure/OtplibTotpVerifier.js';
import { JwtAccessTokenIssuerAdapter } from '../infrastructure/JwtAccessTokenIssuer.js';
import { RedisRefreshTokenStore } from '../infrastructure/RedisRefreshTokenStore.js';
import { RedisTotpStepUpStore } from '../infrastructure/RedisTotpStepUpStore.js';
import { RegisterUserUseCase } from '../application/use-cases/RegisterUserUseCase.js';
import { LoginWithPasswordUseCase } from '../application/use-cases/LoginWithPasswordUseCase.js';
import { RequestMagicLinkUseCase } from '../application/use-cases/RequestMagicLinkUseCase.js';
import { ConsumeMagicLinkUseCase } from '../application/use-cases/ConsumeMagicLinkUseCase.js';
import { LoginWithGoogleUseCase } from '../application/use-cases/LoginWithGoogleUseCase.js';
import { EnableTotpUseCase } from '../application/use-cases/EnableTotpUseCase.js';
import { VerifyTotpUseCase } from '../application/use-cases/VerifyTotpUseCase.js';
import { RefreshTokenUseCase } from '../application/use-cases/RefreshTokenUseCase.js';
import { LogoutUseCase } from '../application/use-cases/LogoutUseCase.js';
import { GetCurrentUserUseCase } from '../application/use-cases/GetCurrentUserUseCase.js';
import { UpdateLocalePreferenceUseCase } from '../application/use-cases/UpdateLocalePreferenceUseCase.js';
import { CreateHouseholdUseCase } from '../application/use-cases/CreateHouseholdUseCase.js';
import { InviteToHouseholdUseCase } from '../application/use-cases/InviteToHouseholdUseCase.js';
import { AcceptInviteUseCase } from '../application/use-cases/AcceptInviteUseCase.js';
import { ExportHouseholdDataUseCase } from '../application/use-cases/ExportHouseholdDataUseCase.js';
import { DeleteHouseholdUseCase } from '../application/use-cases/DeleteHouseholdUseCase.js';
import type { OAuthProvider } from '../domain/ports.js';

const STUB_OAUTH_PROVIDER: OAuthProvider = {
  buildAuthorizeUrl: () => '',
  exchange: async () => ({
    email: '',
    subject: '',
    emailVerified: false,
  }),
};

@Module({
  imports: [AuthModule, ConfigModule],
  controllers: [AuthController, UsersController, HouseholdsController],
  providers: [
    JwtAuthGuard,
    TotpStepUpGuard,
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
      inject: [
        DrizzleUserRepository,
        DrizzleHouseholdRepository,
        Argon2PasswordHashing,
        OtplibTotpVerifier,
        DrizzleTotpSecretRepository,
        DrizzleBankConnectionChecker,
        JwtAccessTokenIssuerAdapter,
        RedisRefreshTokenStore,
      ],
      useFactory: (
        userRepo: DrizzleUserRepository,
        householdRepo: DrizzleHouseholdRepository,
        passwordHashing: Argon2PasswordHashing,
        totpVerifier: OtplibTotpVerifier,
        totpSecretRepo: DrizzleTotpSecretRepository,
        bankConnectionChecker: DrizzleBankConnectionChecker,
        jwtIssuer: JwtAccessTokenIssuerAdapter,
        refreshTokenStore: RedisRefreshTokenStore,
      ) =>
        new LoginWithPasswordUseCase(
          userRepo,
          householdRepo,
          passwordHashing,
          totpVerifier,
          totpSecretRepo,
          bankConnectionChecker,
          jwtIssuer,
          refreshTokenStore,
        ),
    },
    {
      provide: RequestMagicLinkUseCase,
      inject: [
        DrizzleUserRepository,
        DrizzleMagicLinkTokenRepository,
        DrizzleNotificationOutboxPort,
      ],
      useFactory: (
        userRepo: DrizzleUserRepository,
        magicLinkTokenRepo: DrizzleMagicLinkTokenRepository,
        notificationOutbox: DrizzleNotificationOutboxPort,
      ) => new RequestMagicLinkUseCase(userRepo, magicLinkTokenRepo, notificationOutbox),
    },
    {
      provide: ConsumeMagicLinkUseCase,
      inject: [
        DrizzleUserRepository,
        DrizzleHouseholdRepository,
        DrizzleMagicLinkTokenRepository,
        JwtAccessTokenIssuerAdapter,
        RedisRefreshTokenStore,
      ],
      useFactory: (
        userRepo: DrizzleUserRepository,
        householdRepo: DrizzleHouseholdRepository,
        magicLinkTokenRepo: DrizzleMagicLinkTokenRepository,
        jwtIssuer: JwtAccessTokenIssuerAdapter,
        refreshTokenStore: RedisRefreshTokenStore,
      ) =>
        new ConsumeMagicLinkUseCase(
          userRepo,
          householdRepo,
          magicLinkTokenRepo,
          jwtIssuer,
          refreshTokenStore,
        ),
    },
    {
      provide: LoginWithGoogleUseCase,
      inject: [
        DrizzleUserRepository,
        DrizzleHouseholdRepository,
        JwtAccessTokenIssuerAdapter,
        RedisRefreshTokenStore,
      ],
      useFactory: (
        userRepo: DrizzleUserRepository,
        householdRepo: DrizzleHouseholdRepository,
        jwtIssuer: JwtAccessTokenIssuerAdapter,
        refreshTokenStore: RedisRefreshTokenStore,
      ) =>
        new LoginWithGoogleUseCase(
          userRepo,
          householdRepo,
          STUB_OAUTH_PROVIDER,
          jwtIssuer,
          refreshTokenStore,
        ),
    },
    {
      provide: EnableTotpUseCase,
      inject: [DrizzleUserRepository, OtplibTotpVerifier, DrizzleTotpSecretRepository],
      useFactory: (
        userRepo: DrizzleUserRepository,
        totpVerifier: OtplibTotpVerifier,
        totpSecretRepo: DrizzleTotpSecretRepository,
      ) => new EnableTotpUseCase(userRepo, totpVerifier, totpSecretRepo),
    },
    {
      provide: VerifyTotpUseCase,
      inject: [OtplibTotpVerifier, DrizzleTotpSecretRepository, RedisTotpStepUpStore],
      useFactory: (
        totpVerifier: OtplibTotpVerifier,
        totpSecretRepo: DrizzleTotpSecretRepository,
        stepUpStore: RedisTotpStepUpStore,
      ) => new VerifyTotpUseCase(totpVerifier, totpSecretRepo, stepUpStore),
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
      provide: CreateHouseholdUseCase,
      inject: [DrizzleHouseholdRepository, DrizzleUserRepository],
      useFactory: (householdRepo: DrizzleHouseholdRepository, userRepo: DrizzleUserRepository) =>
        new CreateHouseholdUseCase(householdRepo, userRepo),
    },
    {
      provide: InviteToHouseholdUseCase,
      inject: [
        DrizzleHouseholdRepository,
        DrizzleUserRepository,
        DrizzleHouseholdInviteRepository,
        AppConfigAdapter,
      ],
      useFactory: (
        householdRepo: DrizzleHouseholdRepository,
        userRepo: DrizzleUserRepository,
        inviteRepo: DrizzleHouseholdInviteRepository,
        config: AppConfigAdapter,
      ) => new InviteToHouseholdUseCase(householdRepo, userRepo, inviteRepo, config),
    },
    {
      provide: AcceptInviteUseCase,
      inject: [DrizzleHouseholdRepository, DrizzleUserRepository, DrizzleHouseholdInviteRepository],
      useFactory: (
        householdRepo: DrizzleHouseholdRepository,
        userRepo: DrizzleUserRepository,
        inviteRepo: DrizzleHouseholdInviteRepository,
      ) => new AcceptInviteUseCase(householdRepo, userRepo, inviteRepo),
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
