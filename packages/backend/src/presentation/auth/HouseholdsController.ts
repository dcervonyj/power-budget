import { Controller, Post, Body, Param, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './guards/JwtAuthGuard.js';
import { CurrentUser, type AuthenticatedUser } from './decorators/CurrentUser.js';
import { CreateHouseholdDto, InviteToHouseholdDto } from './dto/households.dto.js';
import { CreateHouseholdUseCase } from '../../application/auth/use-cases/CreateHouseholdUseCase.js';
import { InviteToHouseholdUseCase } from '../../application/auth/use-cases/InviteToHouseholdUseCase.js';
import { AcceptInviteUseCase } from '../../application/auth/use-cases/AcceptInviteUseCase.js';

@Controller('households')
@UseGuards(JwtAuthGuard)
export class HouseholdsController {
  constructor(
    private readonly createHousehold: CreateHouseholdUseCase,
    private readonly inviteToHousehold: InviteToHouseholdUseCase,
    private readonly acceptInvite: AcceptInviteUseCase,
  ) {}

  @Post()
  async create(@Body() dto: CreateHouseholdDto, @CurrentUser() user: AuthenticatedUser) {
    const result = await this.createHousehold.execute({
      userId: user.userId,
      name: dto.name,
      baseCurrency: dto.baseCurrency,
    });

    return { householdId: result.id };
  }

  @Post('invite')
  @HttpCode(HttpStatus.NO_CONTENT)
  async invite(
    @Body() dto: InviteToHouseholdDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    if (user.householdId === null) {
      return;
    }
    await this.inviteToHousehold.execute({
      inviterUserId: user.userId,
      inviteeEmail: dto.email,
      householdId: user.householdId,
    });
  }

  @Post('invite/:token/accept')
  @HttpCode(HttpStatus.NO_CONTENT)
  async acceptInviteEndpoint(
    @Param('token') token: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.acceptInvite.execute({ token, acceptingUserId: user.userId });
  }
}
