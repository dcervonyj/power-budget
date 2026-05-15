import { Controller, Post, Body, Param, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from './guards/JwtAuthGuard.js';
import { CurrentUser, type AuthenticatedUser } from './decorators/CurrentUser.js';
import { CreateHouseholdDto, InviteToHouseholdDto } from './dto/households.dto.js';
import { CreateHouseholdUseCase } from '../../application/auth/use-cases/CreateHouseholdUseCase.js';
import { InviteToHouseholdUseCase } from '../../application/auth/use-cases/InviteToHouseholdUseCase.js';
import { AcceptInviteUseCase } from '../../application/auth/use-cases/AcceptInviteUseCase.js';

@ApiTags('households')
@ApiBearerAuth()
@Controller('households')
@UseGuards(JwtAuthGuard)
export class HouseholdsController {
  constructor(
    private readonly createHousehold: CreateHouseholdUseCase,
    private readonly inviteToHousehold: InviteToHouseholdUseCase,
    private readonly acceptInvite: AcceptInviteUseCase,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new household' })
  @ApiBody({ type: CreateHouseholdDto })
  @ApiResponse({ status: 201, description: 'Household created' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
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
  @ApiOperation({ summary: 'Invite a user to the current household' })
  @ApiBody({ type: InviteToHouseholdDto })
  @ApiResponse({ status: 204, description: 'Invitation sent' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
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
  @ApiOperation({ summary: 'Accept a household invitation' })
  @ApiParam({ name: 'token', description: 'Invitation token from email' })
  @ApiResponse({ status: 204, description: 'Invitation accepted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async acceptInviteEndpoint(
    @Param('token') token: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.acceptInvite.execute({ token, acceptingUserId: user.userId });
  }
}
