import { Controller, Get, Patch, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from './guards/JwtAuthGuard.js';
import { CurrentUser, type AuthenticatedUser } from './decorators/CurrentUser.js';
import {
  UpdateLocaleDto,
  UpdateUserProfileDto,
  UserProfileDto,
  toUserProfileDto,
} from './dto/users.dto.js';
import { GetUserProfileUseCase } from '../../application/auth/use-cases/GetUserProfileUseCase.js';
import { UpdateUserProfileUseCase } from '../../application/auth/use-cases/UpdateUserProfileUseCase.js';
import { UpdateLocalePreferenceUseCase } from '../../application/auth/use-cases/UpdateLocalePreferenceUseCase.js';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly getProfile: GetUserProfileUseCase,
    private readonly updateProfile: UpdateUserProfileUseCase,
    private readonly updateLocale: UpdateLocalePreferenceUseCase,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Get the current user profile and preferences' })
  @ApiResponse({ status: 200, description: 'Current user profile', type: UserProfileDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMe(@CurrentUser() user: AuthenticatedUser): Promise<UserProfileDto> {
    const profile = await this.getProfile.execute({ userId: user.userId });

    return toUserProfileDto(profile);
  }

  @Patch('me')
  @ApiOperation({
    summary: 'Update the display name and preferences (locale, base currency, time zone)',
  })
  @ApiBody({ type: UpdateUserProfileDto })
  @ApiResponse({ status: 200, description: 'Updated profile', type: UserProfileDto })
  @ApiResponse({ status: 400, description: 'Invalid field (e.g. unknown time zone)' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async patchMe(
    @Body() dto: UpdateUserProfileDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<UserProfileDto> {
    const profile = await this.updateProfile.execute({
      userId: user.userId,
      patch: {
        ...(dto.displayName !== undefined ? { displayName: dto.displayName } : {}),
        ...(dto.locale !== undefined ? { locale: dto.locale } : {}),
        ...(dto.baseCurrency !== undefined ? { baseCurrency: dto.baseCurrency } : {}),
        ...(dto.timezone !== undefined ? { timezone: dto.timezone } : {}),
      },
    });

    return toUserProfileDto(profile);
  }

  @Patch('me/locale')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Update the current user locale preference',
    description: 'Deprecated: use PATCH /users/me with `locale`.',
    deprecated: true,
  })
  @ApiBody({ type: UpdateLocaleDto })
  @ApiResponse({ status: 204, description: 'Locale updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateLocalePreference(
    @Body() dto: UpdateLocaleDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.updateLocale.execute({ userId: user.userId, locale: dto.locale });
  }
}
