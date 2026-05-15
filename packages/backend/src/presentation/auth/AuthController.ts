import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  Redirect,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from './guards/JwtAuthGuard.js';
import { TotpStepUpGuard } from './guards/TotpStepUpGuard.js';
import { CurrentUser, type AuthenticatedUser } from './decorators/CurrentUser.js';
import { RequireRecentTotp } from './decorators/RequireRecentTotp.js';
import {
  RegisterDto,
  LoginDto,
  RequestMagicLinkDto,
  ConsumeMagicLinkDto,
  VerifyTotpDto,
  RefreshTokenDto,
  LogoutDto,
} from './dto/auth.dto.js';
import { RegisterUserUseCase } from '../../application/auth/use-cases/RegisterUserUseCase.js';
import { LoginWithPasswordUseCase } from '../../application/auth/use-cases/LoginWithPasswordUseCase.js';
import { RequestMagicLinkUseCase } from '../../application/auth/use-cases/RequestMagicLinkUseCase.js';
import { ConsumeMagicLinkUseCase } from '../../application/auth/use-cases/ConsumeMagicLinkUseCase.js';
import { LoginWithGoogleUseCase } from '../../application/auth/use-cases/LoginWithGoogleUseCase.js';
import { EnableTotpUseCase } from '../../application/auth/use-cases/EnableTotpUseCase.js';
import { VerifyTotpUseCase } from '../../application/auth/use-cases/VerifyTotpUseCase.js';
import { RefreshTokenUseCase } from '../../application/auth/use-cases/RefreshTokenUseCase.js';
import { LogoutUseCase } from '../../application/auth/use-cases/LogoutUseCase.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly registerUser: RegisterUserUseCase,
    private readonly loginWithPassword: LoginWithPasswordUseCase,
    private readonly requestMagicLink: RequestMagicLinkUseCase,
    private readonly consumeMagicLink: ConsumeMagicLinkUseCase,
    private readonly loginWithGoogle: LoginWithGoogleUseCase,
    private readonly enableTotp: EnableTotpUseCase,
    private readonly verifyTotp: VerifyTotpUseCase,
    private readonly refreshToken: RefreshTokenUseCase,
    private readonly logout: LogoutUseCase,
    private readonly config: ConfigService,
  ) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    const result = await this.registerUser.execute({
      email: dto.email,
      password: dto.password,
      locale: dto.locale,
    });

    return {
      userId: result.userId,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    };
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    const result = await this.loginWithPassword.execute({
      email: dto.email,
      password: dto.password,
      totp: dto.totp,
    });

    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      userId: result.userId,
    };
  }

  @Post('magic-link/request')
  @HttpCode(HttpStatus.NO_CONTENT)
  async requestMagicLinkEndpoint(@Body() dto: RequestMagicLinkDto): Promise<void> {
    await this.requestMagicLink.execute({ email: dto.email });
  }

  @Post('magic-link/consume')
  async consumeMagicLinkEndpoint(@Body() dto: ConsumeMagicLinkDto) {
    const result = await this.consumeMagicLink.execute({ token: dto.token });

    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      userId: result.userId,
    };
  }

  @Get('oauth/google/start')
  @Redirect()
  googleStart() {
    // Stub: OAuthProvider.buildAuthorizeUrl not yet wired to real Google OAuth
    const callbackUri = `${this.config.get<string>('APP_BASE_URL') ?? 'http://localhost:3000'}/auth/oauth/google/callback`;

    return {
      url: `https://accounts.google.com/o/oauth2/v2/auth?redirect_uri=${encodeURIComponent(callbackUri)}&response_type=code`,
    };
  }

  @Get('oauth/google/callback')
  async googleCallback(@Query('code') code: string, @Query('state') state: string) {
    const redirectUri = `${this.config.get<string>('APP_BASE_URL') ?? 'http://localhost:3000'}/auth/oauth/google/callback`;
    const result = await this.loginWithGoogle.execute({ code, redirectUri, state });

    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      userId: result.userId,
    };
  }

  @Post('totp/enable')
  @UseGuards(JwtAuthGuard, TotpStepUpGuard)
  @RequireRecentTotp()
  async totpEnable(@CurrentUser() user: AuthenticatedUser) {
    const result = await this.enableTotp.execute({ userId: user.userId });

    return { qrCodeUri: result.qrCodeUri, secret: result.secret };
  }

  @Post('totp/verify')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async totpVerify(
    @Body() dto: VerifyTotpDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.verifyTotp.execute({ userId: user.userId, code: dto.code });
  }

  @Post('refresh')
  async refreshTokenEndpoint(@Body() dto: RefreshTokenDto) {
    const result = await this.refreshToken.execute({ refreshToken: dto.refreshToken });

    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      userId: result.userId,
    };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logoutEndpoint(@Body() dto: LogoutDto): Promise<void> {
    await this.logout.execute({ refreshToken: dto.refreshToken });
  }
}
