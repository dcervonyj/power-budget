import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import type { BankConnectionId } from '@power-budget/core';
import { JwtAuthGuard } from '../../auth/presentation/guards/JwtAuthGuard.js';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../auth/presentation/decorators/CurrentUser.js';
import { InitiateBankConnectionDto, GetCatalogQueryDto } from './dto/bank.dto.js';
import { InitiateBankConnectionUseCase } from '../application/use-cases/InitiateBankConnectionUseCase.js';
import { CompleteBankConsentUseCase } from '../application/use-cases/CompleteBankConsentUseCase.js';
import { ListUserConnectionsUseCase } from '../application/use-cases/ListUserConnectionsUseCase.js';
import { RefreshConnectionUseCase } from '../application/use-cases/RefreshConnectionUseCase.js';
import { DisconnectBankUseCase } from '../application/use-cases/DisconnectBankUseCase.js';
import { ReconnectBankUseCase } from '../application/use-cases/ReconnectBankUseCase.js';
import { GetBankCatalogUseCase } from '../application/use-cases/GetBankCatalogUseCase.js';
import { DrizzleBankAccountRepository } from '../infrastructure/DrizzleBankAccountRepository.js';
import {
  BankConnectionNotFoundError,
  BankConnectionForbiddenError,
  BankConsentNotFoundError,
  BankConnectionAlreadyActiveError,
  BankConnectionInvalidStateError,
} from '../domain/errors.js';
import { TotpEnrollmentRequiredError } from '../../auth/domain/errors.js';

@ApiTags('bank-connections')
@Controller('bank-connections')
export class BankController {
  constructor(
    private readonly initiate: InitiateBankConnectionUseCase,
    private readonly completeConsent: CompleteBankConsentUseCase,
    private readonly listConnections: ListUserConnectionsUseCase,
    private readonly refresh: RefreshConnectionUseCase,
    private readonly disconnect: DisconnectBankUseCase,
    private readonly reconnect: ReconnectBankUseCase,
    private readonly getCatalog: GetBankCatalogUseCase,
    private readonly bankAccountRepo: DrizzleBankAccountRepository,
  ) {}

  @Get('catalogue')
  @ApiOperation({ summary: 'List available banks for a given country' })
  @ApiResponse({ status: 200, description: 'List of bank institutions' })
  async catalogue(@Query() query: GetCatalogQueryDto) {
    const country = query.country ?? 'PL';

    return this.getCatalog.execute({ country });
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Initiate a new bank connection (starts OAuth consent)' })
  @ApiBody({ type: InitiateBankConnectionDto })
  @ApiResponse({ status: 201, description: 'Consent link returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Connection to this bank already exists' })
  async initiateBankConnection(
    @Body() dto: InitiateBankConnectionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!user.householdId) {
      throw new ForbiddenException('No household');
    }

    try {
      return await this.initiate.execute({
        userId: user.userId,
        householdId: user.householdId,
        provider: dto.provider,
        bankId: dto.bankId,
        redirectUri: dto.redirectUri,
      });
    } catch (err) {
      if (err instanceof BankConnectionAlreadyActiveError) {
        throw new ForbiddenException('Connection to this bank already exists');
      }
      if (err instanceof TotpEnrollmentRequiredError) {
        throw new ForbiddenException({
          code: 'requires_totp_enrollment',
          redirectHint: '/auth/totp/enroll',
        });
      }

      throw err;
    }
  }

  @Get(':id/complete')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Complete bank OAuth consent callback' })
  @ApiParam({ name: 'id', description: 'Bank connection ID' })
  @ApiQuery({ name: 'code', description: 'OAuth authorization code' })
  @ApiQuery({ name: 'state', description: 'OAuth state / consent reference' })
  @ApiResponse({ status: 200, description: 'Connection activated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Consent not found' })
  async completeBankConsent(
    @Param('id') _id: string,
    @Query('code') code: string,
    @Query('state') state: string,
  ) {
    try {
      return await this.completeConsent.execute({
        externalConsentRef: state,
        callbackPayload: { code, state },
      });
    } catch (err) {
      if (err instanceof BankConsentNotFoundError) {
        throw new NotFoundException('Consent not found');
      }

      throw err;
    }
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List bank connections for the current user' })
  @ApiResponse({ status: 200, description: 'List of bank connections' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async listBankConnections(@CurrentUser() user: AuthenticatedUser) {
    return this.listConnections.execute({ userId: user.userId });
  }

  @Post(':id/refresh')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Trigger a manual sync for a bank connection' })
  @ApiParam({ name: 'id', description: 'Bank connection ID' })
  @ApiResponse({ status: 202, description: 'Refresh enqueued' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Connection not found' })
  async refreshConnection(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    if (!user.householdId) {
      throw new ForbiddenException('No household');
    }

    try {
      return await this.refresh.execute({
        connectionId: id as BankConnectionId,
        householdId: user.householdId,
        userId: user.userId,
      });
    } catch (err) {
      if (err instanceof BankConnectionNotFoundError) {
        throw new NotFoundException('Connection not found');
      }
      if (err instanceof BankConnectionForbiddenError) {
        throw new ForbiddenException('Not your connection');
      }

      throw err;
    }
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disconnect (delete) a bank connection' })
  @ApiParam({ name: 'id', description: 'Bank connection ID' })
  @ApiResponse({ status: 204, description: 'Connection removed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Connection not found' })
  async disconnectBank(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    if (!user.householdId) {
      throw new ForbiddenException('No household');
    }

    try {
      await this.disconnect.execute({
        connectionId: id as BankConnectionId,
        householdId: user.householdId,
        userId: user.userId,
      });
    } catch (err) {
      if (err instanceof BankConnectionNotFoundError) {
        throw new NotFoundException('Connection not found');
      }
      if (err instanceof BankConnectionForbiddenError) {
        throw new ForbiddenException('Not your connection');
      }

      throw err;
    }
  }

  @Post(':id/reconnect')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Re-initiate consent for an expired bank connection' })
  @ApiParam({ name: 'id', description: 'Bank connection ID' })
  @ApiResponse({ status: 201, description: 'New consent link returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden or invalid state' })
  @ApiResponse({ status: 404, description: 'Connection not found' })
  async reconnectBank(
    @Param('id') id: string,
    @Body() body: { redirectUri?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!user.householdId) {
      throw new ForbiddenException('No household');
    }

    try {
      return await this.reconnect.execute({
        connectionId: id as BankConnectionId,
        householdId: user.householdId,
        userId: user.userId,
        redirectUri: body.redirectUri ?? 'https://app.power-budget.test/connect/callback',
      });
    } catch (err) {
      if (err instanceof BankConnectionNotFoundError) {
        throw new NotFoundException('Connection not found');
      }
      if (err instanceof BankConnectionForbiddenError) {
        throw new ForbiddenException('Not your connection');
      }
      if (err instanceof BankConnectionInvalidStateError) {
        throw new ForbiddenException(err.message);
      }

      throw err;
    }
  }

  @Get(':id/accounts')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List bank accounts for a connection' })
  @ApiParam({ name: 'id', description: 'Bank connection ID' })
  @ApiResponse({ status: 200, description: 'List of bank accounts' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async listAccounts(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    if (!user.householdId) {
      return [];
    }

    return this.bankAccountRepo.listByConnection(id as BankConnectionId, {
      householdId: user.householdId,
    });
  }
}
