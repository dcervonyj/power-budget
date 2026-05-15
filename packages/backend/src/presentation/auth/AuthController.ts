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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
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

@ApiTags('auth')
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
  @ApiOperation({ summary: 'Register a new user' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 409, description: 'Email already in use' })
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
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 201, description: 'Tokens issued' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
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
  @ApiOperation({ summary: 'Request a magic-link login email' })
  @ApiBody({ type: RequestMagicLinkDto })
  @ApiResponse({ status: 204, description: 'Magic link sent (if account exists)' })
  async requestMagicLinkEndpoint(@Body() dto: RequestMagicLinkDto): Promise<void> {
    await this.requestMagicLink.execute({ email: dto.email });
  }

  @Post('magic-link/consume')
  @ApiOperation({ summary: 'Consume a magic-link token and get tokens' })
  @ApiBody({ type: ConsumeMagicLinkDto })
  @ApiResponse({ status: 201, description: 'Tokens issued' })
  @ApiResponse({ status: 401, description: 'Token invalid or expired' })
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
  @ApiOperation({ summary: 'Start Google OAuth flow (redirects to Google)' })
  @ApiResponse({ status: 302, description: 'Redirect to Google OAuth' })
  googleStart() {
    // Stub: OAuthProvider.buildAuthorizeUrl not yet wired to real Google OAuth
    const callbackUri = `${this.config.get<string>('APP_BASE_URL') ?? 'http://localhost:3000'}/auth/oauth/google/callback`;

    return {
      url: `https://accounts.google.com/o/oauth2/v2/auth?redirect_uri=${encodeURIComponent(callbackUri)}&response_type=code`,
    };
  }

  @Get('oauth/google/callback')
  @ApiOperation({ summary: 'Google OAuth callback' })
  @ApiQuery({ name: 'code', description: 'Authorization code from Google' })
  @ApiQuery({ name: 'state', description: 'OAuth state parameter' })
  @ApiResponse({ status: 200, description: 'Tokens issued' })
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
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Enable TOTP 2FA for the current user' })
  @ApiResponse({ status: 201, description: 'TOTP secret and QR code URI' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async totpEnable(@CurrentUser() user: AuthenticatedUser) {
    const result = await this.enableTotp.execute({ userId: user.userId });

    return { qrCodeUri: result.qrCodeUri, secret: result.secret };
  }

  @Post('totp/verify')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify and activate TOTP for the current user' })
  @ApiBody({ type: VerifyTotpDto })
  @ApiResponse({ status: 204, description: 'TOTP verified' })
  @ApiResponse({ status: 401, description: 'Unauthorized or invalid code' })
  async totpVerify(
    @Body() dto: VerifyTotpDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.verifyTotp.execute({ userId: user.userId, code: dto.code });
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Rotate refresh token and get a new access token' })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({ status: 201, description: 'New tokens issued' })
  @ApiResponse({ status: 401, description: 'Refresh token invalid or expired' })
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
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout and revoke refresh token' })
  @ApiBody({ type: LogoutDto })
  @ApiResponse({ status: 204, description: 'Logged out' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async logoutEndpoint(@Body() dto: LogoutDto): Promise<void> {
    await this.logout.execute({ refreshToken: dto.refreshToken });
  }
}
