import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../../infrastructure/auth/AuthModule.js';
import { AuthController } from './AuthController.js';
import { UsersController } from './UsersController.js';
import { HouseholdsController } from './HouseholdsController.js';
import { JwtAuthGuard } from './guards/JwtAuthGuard.js';
import { TotpStepUpGuard } from './guards/TotpStepUpGuard.js';
import { AppConfigAdapter } from './AppConfigAdapter.js';
import { DrizzleUserRepository } from '../../infrastructure/auth/DrizzleUserRepository.js';
import { DrizzleHouseholdRepository } from '../../infrastructure/auth/DrizzleHouseholdRepository.js';
import { DrizzleMagicLinkTokenRepository } from '../../infrastructure/auth/DrizzleMagicLinkTokenRepository.js';
import { DrizzleTotpSecretRepository } from '../../infrastructure/auth/DrizzleTotpSecretRepository.js';
import { DrizzleHouseholdInviteRepository } from '../../infrastructure/auth/DrizzleHouseholdInviteRepository.js';
import { DrizzleNotificationOutboxPort } from '../../infrastructure/auth/DrizzleNotificationOutboxPort.js';
import { DrizzleBankConnectionChecker } from '../../infrastructure/auth/DrizzleBankConnectionChecker.js';
import { Argon2PasswordHashing } from '../../infrastructure/auth/Argon2PasswordHashing.js';
import { OtplibTotpVerifier } from '../../infrastructure/auth/OtplibTotpVerifier.js';
import { JwtAccessTokenIssuerAdapter } from '../../infrastructure/auth/JwtAccessTokenIssuer.js';
import { RedisRefreshTokenStore } from '../../infrastructure/auth/RedisRefreshTokenStore.js';
import { RedisTotpStepUpStore } from '../../infrastructure/auth/RedisTotpStepUpStore.js';
import { RegisterUserUseCase } from '../../application/auth/use-cases/RegisterUserUseCase.js';
import { LoginWithPasswordUseCase } from '../../application/auth/use-cases/LoginWithPasswordUseCase.js';
import { RequestMagicLinkUseCase } from '../../application/auth/use-cases/RequestMagicLinkUseCase.js';
import { ConsumeMagicLinkUseCase } from '../../application/auth/use-cases/ConsumeMagicLinkUseCase.js';
import { LoginWithGoogleUseCase } from '../../application/auth/use-cases/LoginWithGoogleUseCase.js';
import { EnableTotpUseCase } from '../../application/auth/use-cases/EnableTotpUseCase.js';
import { VerifyTotpUseCase } from '../../application/auth/use-cases/VerifyTotpUseCase.js';
import { RefreshTokenUseCase } from '../../application/auth/use-cases/RefreshTokenUseCase.js';
import { LogoutUseCase } from '../../application/auth/use-cases/LogoutUseCase.js';
import { GetCurrentUserUseCase } from '../../application/auth/use-cases/GetCurrentUserUseCase.js';
import { UpdateLocalePreferenceUseCase } from '../../application/auth/use-cases/UpdateLocalePreferenceUseCase.js';
import { CreateHouseholdUseCase } from '../../application/auth/use-cases/CreateHouseholdUseCase.js';
import { InviteToHouseholdUseCase } from '../../application/auth/use-cases/InviteToHouseholdUseCase.js';
import { AcceptInviteUseCase } from '../../application/auth/use-cases/AcceptInviteUseCase.js';
import type { OAuthProvider } from '../../domain/auth/ports.js';

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
  ],
})
export class AuthPresentationModule {}
