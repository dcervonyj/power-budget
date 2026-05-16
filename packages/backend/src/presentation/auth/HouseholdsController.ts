import {
  Controller,
  Post,
  Body,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import type { HouseholdId } from '@power-budget/core';
import { JwtAuthGuard } from './guards/JwtAuthGuard.js';
import { CurrentUser, type AuthenticatedUser } from './decorators/CurrentUser.js';
import { CreateHouseholdDto, InviteToHouseholdDto } from './dto/households.dto.js';
import { CreateHouseholdUseCase } from '../../application/auth/use-cases/CreateHouseholdUseCase.js';
import { InviteToHouseholdUseCase } from '../../application/auth/use-cases/InviteToHouseholdUseCase.js';
import { AcceptInviteUseCase } from '../../application/auth/use-cases/AcceptInviteUseCase.js';
import { ExportHouseholdDataUseCase } from '../../application/auth/use-cases/ExportHouseholdDataUseCase.js';
import { DeleteHouseholdUseCase } from '../../application/auth/use-cases/DeleteHouseholdUseCase.js';

@ApiTags('households')
@ApiBearerAuth()
@Controller('households')
@UseGuards(JwtAuthGuard)
export class HouseholdsController {
  constructor(
    private readonly createHousehold: CreateHouseholdUseCase,
    private readonly inviteToHousehold: InviteToHouseholdUseCase,
    private readonly acceptInvite: AcceptInviteUseCase,
    private readonly exportData: ExportHouseholdDataUseCase,
    private readonly scheduleDelete: DeleteHouseholdUseCase,
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

  @Post('export')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Request a household data export' })
  @ApiResponse({ status: 201, description: 'Export requested' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'No household' })
  async requestExport(@CurrentUser() user: AuthenticatedUser) {
    if (!user.householdId) {
      throw new ForbiddenException('No household');
    }
    return this.exportData.execute({
      householdId: user.householdId,
      requestedByUserId: user.userId,
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Schedule household deletion (30-day hold)' })
  @ApiParam({ name: 'id', description: 'Household ID' })
  @ApiResponse({ status: 202, description: 'Deletion scheduled' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'No household' })
  async deleteHousehold(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    if (!user.householdId) {
      throw new ForbiddenException('No household');
    }
    return this.scheduleDelete.execute({
      householdId: id as HouseholdId,
      requestedByUserId: user.userId,
    });
  }
}
