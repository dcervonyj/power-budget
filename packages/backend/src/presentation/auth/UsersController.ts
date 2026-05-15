import { Controller, Get, Patch, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './guards/JwtAuthGuard.js';
import { CurrentUser, type AuthenticatedUser } from './decorators/CurrentUser.js';
import { UpdateLocaleDto } from './dto/users.dto.js';
import { GetCurrentUserUseCase } from '../../application/auth/use-cases/GetCurrentUserUseCase.js';
import { UpdateLocalePreferenceUseCase } from '../../application/auth/use-cases/UpdateLocalePreferenceUseCase.js';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly getCurrentUser: GetCurrentUserUseCase,
    private readonly updateLocale: UpdateLocalePreferenceUseCase,
  ) {}

  @Get('me')
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
  async updateLocalePreference(
    @Body() dto: UpdateLocaleDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.updateLocale.execute({ userId: user.userId, locale: dto.locale });
  }
}
