import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from './guards/JwtAuthGuard.js';
import { CurrentUser, type AuthenticatedUser } from './decorators/CurrentUser.js';
import {
  RegisterDto,
  LoginDto,
  RequestMagicLinkDto,
  ConsumeMagicLinkDto,
  VerifyTotpDto,
  RefreshTokenDto,
  LogoutDto,
} from './dto/auth.dto.js';
import {
  AuthTokensDto,
  TotpEnrollmentDto,
  toAuthTokensDto,
  toTotpEnrollmentDto,
} from './dto/auth-response.dto.js';
import { RegisterUserUseCase } from '../../application/auth/use-cases/RegisterUserUseCase.js';
import { LoginWithPasswordUseCase } from '../../application/auth/use-cases/LoginWithPasswordUseCase.js';
import { RequestMagicLinkUseCase } from '../../application/auth/use-cases/RequestMagicLinkUseCase.js';
import { ConsumeMagicLinkUseCase } from '../../application/auth/use-cases/ConsumeMagicLinkUseCase.js';
import { EnableTotpUseCase } from '../../application/auth/use-cases/EnableTotpUseCase.js';
import { VerifyTotpUseCase } from '../../application/auth/use-cases/VerifyTotpUseCase.js';
import { RefreshTokenUseCase } from '../../application/auth/use-cases/RefreshTokenUseCase.js';
import { LogoutUseCase } from '../../application/auth/use-cases/LogoutUseCase.js';

// Google OAuth routes were removed (CLN-001 / audit C2): no real Google client
// exists and the stub provider let anyone mint tokens for a shared user.
// Re-add them only together with a real OAuthProvider, state validation and
// an emailVerified check.
//
// ThrottlerGuard (per IP and per account, see throttling.ts) guards every
// endpoint that checks a credential (CLN-004 / audit H4).
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly registerUser: RegisterUserUseCase,
    private readonly loginWithPassword: LoginWithPasswordUseCase,
    private readonly requestMagicLink: RequestMagicLinkUseCase,
    private readonly consumeMagicLink: ConsumeMagicLinkUseCase,
    private readonly enableTotp: EnableTotpUseCase,
    private readonly verifyTotp: VerifyTotpUseCase,
    private readonly refreshToken: RefreshTokenUseCase,
    private readonly logout: LogoutUseCase,
  ) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({ status: 201, description: 'User registered successfully', type: AuthTokensDto })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  async register(@Body() dto: RegisterDto): Promise<AuthTokensDto> {
    const result = await this.registerUser.execute({
      email: dto.email,
      password: dto.password,
      locale: dto.locale,
    });

    return toAuthTokensDto(result);
  }

  @Post('login')
  @UseGuards(ThrottlerGuard)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 201, description: 'Tokens issued', type: AuthTokensDto })
  @ApiResponse({ status: 401, description: 'Invalid credentials or TOTP code' })
  @ApiResponse({ status: 403, description: 'TOTP is enabled: send `totp` (code requires_totp)' })
  @ApiResponse({ status: 429, description: 'Too many attempts' })
  async login(@Body() dto: LoginDto): Promise<AuthTokensDto> {
    const result = await this.loginWithPassword.execute({
      email: dto.email,
      password: dto.password,
      totp: dto.totp,
    });

    return toAuthTokensDto(result);
  }

  @Post('magic-link/request')
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Request a magic-link login email' })
  @ApiBody({ type: RequestMagicLinkDto })
  @ApiResponse({ status: 204, description: 'Magic link sent (if account exists)' })
  @ApiResponse({ status: 429, description: 'Too many attempts' })
  async requestMagicLinkEndpoint(@Body() dto: RequestMagicLinkDto): Promise<void> {
    await this.requestMagicLink.execute({ email: dto.email });
  }

  @Post('magic-link/consume')
  @UseGuards(ThrottlerGuard)
  @ApiOperation({ summary: 'Consume a magic-link token and get tokens' })
  @ApiBody({ type: ConsumeMagicLinkDto })
  @ApiResponse({ status: 201, description: 'Tokens issued', type: AuthTokensDto })
  @ApiResponse({ status: 401, description: 'Token invalid or expired, or invalid TOTP code' })
  @ApiResponse({
    status: 403,
    description: 'TOTP is enabled: resend the token with `totp` (code requires_totp)',
  })
  @ApiResponse({ status: 429, description: 'Too many attempts' })
  async consumeMagicLinkEndpoint(@Body() dto: ConsumeMagicLinkDto): Promise<AuthTokensDto> {
    const result = await this.consumeMagicLink.execute({ token: dto.token, totp: dto.totp });

    return toAuthTokensDto(result);
  }

  @Post('totp/enable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Start TOTP enrolment for the current user',
    description:
      'First enrolment needs no step-up. Replacing an enabled TOTP needs a recent ' +
      'POST /auth/totp/verify. TOTP is enabled once the first code is verified. ' +
      'A replacement stays pending, and the current secret stays in force, until its ' +
      'first code is verified.',
  })
  @ApiResponse({
    status: 201,
    description: 'TOTP secret and QR code URI',
    type: TotpEnrollmentDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'TOTP already enabled and no recent step-up' })
  async totpEnable(@CurrentUser() user: AuthenticatedUser): Promise<TotpEnrollmentDto> {
    const result = await this.enableTotp.execute({ userId: user.userId });

    return toTotpEnrollmentDto(result);
  }

  @Post('totp/verify')
  // JwtAuthGuard first, so the account throttler can key on the user.
  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Verify a TOTP code',
    description:
      'Activates a pending enrolment (a code of a pending replacement swaps it in) ' +
      'and opens the 5-minute step-up window. A code is accepted only once.',
  })
  @ApiBody({ type: VerifyTotpDto })
  @ApiResponse({ status: 204, description: 'TOTP verified' })
  @ApiResponse({ status: 401, description: 'Unauthorized, or invalid or reused code' })
  @ApiResponse({ status: 403, description: 'No TOTP enrolment (code requires_totp_enrollment)' })
  @ApiResponse({ status: 429, description: 'Too many attempts' })
  async totpVerify(
    @Body() dto: VerifyTotpDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.verifyTotp.execute({ userId: user.userId, code: dto.code });
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Rotate refresh token and get a new access token' })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({ status: 201, description: 'New tokens issued', type: AuthTokensDto })
  @ApiResponse({ status: 401, description: 'Refresh token invalid or expired' })
  async refreshTokenEndpoint(@Body() dto: RefreshTokenDto): Promise<AuthTokensDto> {
    const result = await this.refreshToken.execute({ refreshToken: dto.refreshToken });

    return toAuthTokensDto(result);
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
