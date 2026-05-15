import { Controller, Get, Patch, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from './guards/JwtAuthGuard.js';
import { CurrentUser, type AuthenticatedUser } from './decorators/CurrentUser.js';
import { UpdateLocaleDto } from './dto/users.dto.js';
import { GetCurrentUserUseCase } from '../../application/auth/use-cases/GetCurrentUserUseCase.js';
import { UpdateLocalePreferenceUseCase } from '../../application/auth/use-cases/UpdateLocalePreferenceUseCase.js';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly getCurrentUser: GetCurrentUserUseCase,
    private readonly updateLocale: UpdateLocalePreferenceUseCase,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Get the current authenticated user' })
  @ApiResponse({ status: 200, description: 'Current user profile' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMe(@CurrentUser() user: AuthenticatedUser) {
    const result = await this.getCurrentUser.execute({ userId: user.userId });

    return {
      id: result.id,
      email: result.email,
      displayName: result.displayName,
      localePreference: result.localePreference,
      defaultLocale: result.defaultLocale,
    };
  }

  @Patch('me/locale')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Update the current user locale preference' })
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
