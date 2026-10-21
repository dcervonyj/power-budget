import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
  Delete,
  HttpCode,
  HttpStatus,
  UseGuards,
  ForbiddenException,
  Inject,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { HouseholdId } from '@power-budget/core';
import { JwtAuthGuard } from './guards/JwtAuthGuard.js';
import { TotpStepUpGuard } from './guards/TotpStepUpGuard.js';
import { RequireRecentTotp } from './decorators/RequireRecentTotp.js';
import { CurrentUser, type AuthenticatedUser } from './decorators/CurrentUser.js';
import {
  AcceptInviteDto,
  AcceptInviteResponseDto,
  CreateHouseholdDto,
  HouseholdInviteResponseDto,
  InviteToHouseholdDto,
} from './dto/households.dto.js';
import {
  HouseholdCreatedDto,
  HouseholdDeletionScheduledDto,
  HouseholdExportRequestedDto,
  toHouseholdCreatedDto,
  toHouseholdDeletionScheduledDto,
  toHouseholdExportRequestedDto,
} from './dto/households-response.dto.js';
import { CreateHouseholdUseCase } from '../../application/auth/use-cases/CreateHouseholdUseCase.js';
import { InviteToHouseholdUseCase } from '../../application/auth/use-cases/InviteToHouseholdUseCase.js';
import { AcceptInviteUseCase } from '../../application/auth/use-cases/AcceptInviteUseCase.js';
import { ResendHouseholdInviteUseCase } from '../../application/auth/use-cases/ResendHouseholdInviteUseCase.js';
import { RevokeHouseholdInviteUseCase } from '../../application/auth/use-cases/RevokeHouseholdInviteUseCase.js';
import { ListHouseholdInvitesUseCase } from '../../application/auth/use-cases/ListHouseholdInvitesUseCase.js';
import type { HouseholdInviteView } from '../../application/auth/use-cases/HouseholdInviteView.js';
import { ExportHouseholdDataUseCase } from '../../application/auth/use-cases/ExportHouseholdDataUseCase.js';
import { DeleteHouseholdUseCase } from '../../application/auth/use-cases/DeleteHouseholdUseCase.js';
import { HouseholdNotFoundError, HouseholdOwnerRequiredError } from '../../domain/auth/errors.js';

@ApiTags('households')
@ApiBearerAuth()
@Controller('households')
@UseGuards(JwtAuthGuard)
export class HouseholdsController {
  constructor(
    @Inject(CreateHouseholdUseCase) private readonly createHousehold: CreateHouseholdUseCase,
    @Inject(InviteToHouseholdUseCase) private readonly inviteToHousehold: InviteToHouseholdUseCase,
    @Inject(AcceptInviteUseCase) private readonly acceptInvite: AcceptInviteUseCase,
    @Inject(ResendHouseholdInviteUseCase)
    private readonly resendInvite: ResendHouseholdInviteUseCase,
    @Inject(RevokeHouseholdInviteUseCase)
    private readonly revokeInvite: RevokeHouseholdInviteUseCase,
    @Inject(ListHouseholdInvitesUseCase) private readonly listInvites: ListHouseholdInvitesUseCase,
    @Inject(ExportHouseholdDataUseCase) private readonly exportData: ExportHouseholdDataUseCase,
    @Inject(DeleteHouseholdUseCase) private readonly scheduleDelete: DeleteHouseholdUseCase,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new household' })
  @ApiBody({ type: CreateHouseholdDto })
  @ApiResponse({ status: 201, description: 'Household created', type: HouseholdCreatedDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(
    @Body() dto: CreateHouseholdDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<HouseholdCreatedDto> {
    const result = await this.createHousehold.execute({
      userId: user.userId,
      name: dto.name,
      baseCurrency: dto.baseCurrency,
    });

    return toHouseholdCreatedDto(result.id);
  }

  @Post('invites')
  // Per IP and per invitee email (body `email`), like the credential endpoints.
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Invite the partner by email (owner only)',
    description:
      'Emails a single-use link valid for 7 days. A household has one open invite: a new ' +
      'invite revokes the previous one. At most two members per household.',
  })
  @ApiBody({ type: InviteToHouseholdDto })
  @ApiResponse({ status: 201, type: HouseholdInviteResponseDto, description: 'Invite emailed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Caller is not the owner (household_owner_required)' })
  @ApiResponse({
    status: 409,
    description: 'Household already has two members (household_full) or own email (invite_self)',
  })
  @ApiResponse({ status: 429, description: 'Too many invites' })
  async invite(
    @Body() dto: InviteToHouseholdDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<HouseholdInviteResponseDto> {
    const view = await this.inviteToHousehold.execute({
      inviterUserId: user.userId,
      inviteeEmail: dto.email,
      householdId: this.householdOf(user),
    });

    return this.toInviteDto(view);
  }

  @Get('invites')
  @ApiOperation({ summary: 'List the open invite of the household (owner only)' })
  @ApiResponse({ status: 200, type: [HouseholdInviteResponseDto] })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Caller is not the owner (household_owner_required)' })
  async invites(@CurrentUser() user: AuthenticatedUser): Promise<HouseholdInviteResponseDto[]> {
    const views = await this.listInvites.execute({
      userId: user.userId,
      householdId: this.householdOf(user),
    });

    return views.map((view) => this.toInviteDto(view));
  }

  @Post('invites/accept')
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Accept a household invite',
    description:
      'The caller must be signed in with the invited email. Their own solo household is ' +
      'left (and scheduled for deletion) when it holds no data; otherwise 409 ' +
      'household_not_empty. Use the returned access token from now on.',
  })
  @ApiBody({ type: AcceptInviteDto })
  @ApiResponse({ status: 200, type: AcceptInviteResponseDto, description: 'Joined' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Signed in with another email (email_mismatch)' })
  @ApiResponse({ status: 404, description: 'Unknown or revoked invite (invite_not_found)' })
  @ApiResponse({
    status: 409,
    description: 'invite_already_used, already_in_household, household_full or household_not_empty',
  })
  @ApiResponse({ status: 410, description: 'Invite expired (invite_expired)' })
  async acceptInviteEndpoint(
    @Body() dto: AcceptInviteDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AcceptInviteResponseDto> {
    return this.acceptInvite.execute({ token: dto.token, acceptingUserId: user.userId });
  }

  @Post('invites/:inviteId/resend')
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resend an open invite (owner only)',
    description: 'Issues a new token and a new 7-day expiry; the previous link stops working.',
  })
  @ApiParam({ name: 'inviteId', description: 'Invite ID' })
  @ApiResponse({ status: 200, type: HouseholdInviteResponseDto, description: 'Invite emailed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Caller is not the owner (household_owner_required)' })
  @ApiResponse({ status: 404, description: 'No open invite with this id (invite_not_found)' })
  @ApiResponse({ status: 429, description: 'Too many invites' })
  async resend(
    @Param('inviteId', ParseUUIDPipe) inviteId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<HouseholdInviteResponseDto> {
    const view = await this.resendInvite.execute({
      userId: user.userId,
      householdId: this.householdOf(user),
      inviteId,
    });

    return this.toInviteDto(view);
  }

  @Delete('invites/:inviteId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke an open invite (owner only)' })
  @ApiParam({ name: 'inviteId', description: 'Invite ID' })
  @ApiResponse({ status: 204, description: 'Invite revoked' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Caller is not the owner (household_owner_required)' })
  @ApiResponse({ status: 404, description: 'No open invite with this id (invite_not_found)' })
  async revoke(
    @Param('inviteId', ParseUUIDPipe) inviteId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.revokeInvite.execute({
      userId: user.userId,
      householdId: this.householdOf(user),
      inviteId,
    });
  }

  @Post('export')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Request a household data export' })
  @ApiResponse({ status: 201, description: 'Export requested', type: HouseholdExportRequestedDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'No household' })
  async requestExport(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<HouseholdExportRequestedDto> {
    if (!user.householdId) {
      throw new ForbiddenException('No household');
    }
    const output = await this.exportData.execute({
      householdId: user.householdId,
      requestedByUserId: user.userId,
    });

    return toHouseholdExportRequestedDto(output);
  }

  @Delete(':id')
  // TOTP step-up (CLN-004, audit C3): POST /auth/totp/verify within 5 minutes.
  @UseGuards(TotpStepUpGuard)
  @RequireRecentTotp()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Schedule household deletion (30-day hold)' })
  @ApiParam({ name: 'id', description: 'Household ID' })
  @ApiResponse({
    status: 202,
    description: 'Deletion scheduled',
    type: HouseholdDeletionScheduledDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description:
      'No household, caller is not the owner, or no recent TOTP verification ' +
      '(codes requires_totp, requires_totp_enrollment)',
  })
  @ApiResponse({ status: 404, description: 'Household not found' })
  async deleteHousehold(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<HouseholdDeletionScheduledDto> {
    if (!user.householdId) {
      throw new ForbiddenException('No household');
    }
    // The path id must be the caller's own household (audit C3).
    if (id !== user.householdId) {
      throw new NotFoundException('Household not found');
    }

    try {
      const output = await this.scheduleDelete.execute({
        householdId: user.householdId,
        requestedByUserId: user.userId,
      });

      return toHouseholdDeletionScheduledDto(output);
    } catch (err) {
      throw this.toHttpError(err);
    }
  }

  /** A user without a household owns none, so the owner-only endpoints answer 403. */
  private householdOf(user: AuthenticatedUser): HouseholdId {
    if (user.householdId === null) {
      throw new HouseholdOwnerRequiredError();
    }

    return user.householdId;
  }

  private toInviteDto(view: HouseholdInviteView): HouseholdInviteResponseDto {
    return {
      id: view.id,
      email: view.email,
      status: view.status,
      expiresAt: view.expiresAt.toISOString(),
      createdAt: view.createdAt.toISOString(),
    };
  }

  private toHttpError(err: unknown): unknown {
    if (err instanceof HouseholdNotFoundError) {
      return new NotFoundException('Household not found');
    }
    if (err instanceof HouseholdOwnerRequiredError) {
      return new ForbiddenException('Only the household owner can delete the household');
    }

    return err;
  }
}
