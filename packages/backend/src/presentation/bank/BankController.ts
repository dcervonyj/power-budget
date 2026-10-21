import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
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
import { BankConnectionId } from '@power-budget/core';
import { JwtAuthGuard } from '../auth/guards/JwtAuthGuard.js';
import { CurrentUser, type AuthenticatedUser } from '../auth/decorators/CurrentUser.js';
import {
  InitiateBankConnectionDto,
  GetCatalogQueryDto,
  ReconnectBankDto,
  BankAccountDto,
  toBankAccountDto,
} from './dto/bank.dto.js';
import {
  BankCatalogEntryDto,
  BankConnectionDto,
  BankConsentCompletedDto,
  BankConsentLinkDto,
  BankReconnectLinkDto,
  BankRefreshEnqueuedDto,
  toBankCatalogEntryDto,
  toBankConnectionDto,
  toBankConsentCompletedDto,
  toBankConsentLinkDto,
  toBankReconnectLinkDto,
  toBankRefreshEnqueuedDto,
} from './dto/bank-response.dto.js';
import { InitiateBankConnectionUseCase } from '../../application/bank/use-cases/InitiateBankConnectionUseCase.js';
import { CompleteBankConsentUseCase } from '../../application/bank/use-cases/CompleteBankConsentUseCase.js';
import { ListUserConnectionsUseCase } from '../../application/bank/use-cases/ListUserConnectionsUseCase.js';
import { RefreshConnectionUseCase } from '../../application/bank/use-cases/RefreshConnectionUseCase.js';
import { DisconnectBankUseCase } from '../../application/bank/use-cases/DisconnectBankUseCase.js';
import { ReconnectBankUseCase } from '../../application/bank/use-cases/ReconnectBankUseCase.js';
import { GetBankCatalogUseCase } from '../../application/bank/use-cases/GetBankCatalogUseCase.js';
import { ListConnectionAccountsUseCase } from '../../application/bank/use-cases/ListConnectionAccountsUseCase.js';
import {
  BankConnectionNotFoundError,
  BankConnectionForbiddenError,
  BankConsentNotFoundError,
  BankConnectionAlreadyActiveError,
  BankConnectionInvalidStateError,
} from '../../domain/bank/errors.js';
import { TotpEnrollmentRequiredError } from '../../domain/auth/errors.js';

/** Connection ids are UUIDv7; anything else is a 400 before it reaches a branded id. */
const UUID_V7_PIPE = new ParseUUIDPipe({ version: '7' });

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
    private readonly listConnectionAccounts: ListConnectionAccountsUseCase,
  ) {}

  @Get('catalogue')
  @ApiOperation({ summary: 'List available banks for a given country' })
  @ApiResponse({
    status: 200,
    description: 'List of bank institutions',
    type: [BankCatalogEntryDto],
  })
  async catalogue(@Query() query: GetCatalogQueryDto): Promise<BankCatalogEntryDto[]> {
    const country = query.country ?? 'PL';
    const entries = await this.getCatalog.execute({ country });

    return entries.map(toBankCatalogEntryDto);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Initiate a new bank connection (starts OAuth consent)' })
  @ApiBody({ type: InitiateBankConnectionDto })
  @ApiResponse({ status: 201, description: 'Consent link returned', type: BankConsentLinkDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Connection to this bank already exists' })
  async initiateBankConnection(
    @Body() dto: InitiateBankConnectionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BankConsentLinkDto> {
    if (!user.householdId) {
      throw new ForbiddenException('No household');
    }

    try {
      const output = await this.initiate.execute({
        userId: user.userId,
        householdId: user.householdId,
        provider: dto.provider,
        bankId: dto.bankId,
        redirectUri: dto.redirectUri,
      });

      return toBankConsentLinkDto(output);
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
  @ApiResponse({ status: 200, description: 'Connection activated', type: BankConsentCompletedDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Consent not found' })
  async completeBankConsent(
    @Param('id', UUID_V7_PIPE) id: string,
    @Query('code') code: string,
    @Query('state') state: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BankConsentCompletedDto> {
    if (!user.householdId) {
      throw new ForbiddenException('No household');
    }

    try {
      // Scoped to (connection id, caller, caller's household) — audit C4.
      const output = await this.completeConsent.execute({
        connectionId: BankConnectionId.of(id),
        userId: user.userId,
        householdId: user.householdId,
        callbackPayload: { code, state },
      });

      return toBankConsentCompletedDto(output);
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
  @ApiResponse({ status: 200, description: 'List of bank connections', type: [BankConnectionDto] })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async listBankConnections(@CurrentUser() user: AuthenticatedUser): Promise<BankConnectionDto[]> {
    const connections = await this.listConnections.execute({ userId: user.userId });

    return connections.map(toBankConnectionDto);
  }

  @Post(':id/refresh')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Trigger a manual sync for a bank connection' })
  @ApiParam({ name: 'id', description: 'Bank connection ID' })
  @ApiResponse({ status: 202, description: 'Refresh enqueued', type: BankRefreshEnqueuedDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Connection not found' })
  async refreshConnection(
    @Param('id', UUID_V7_PIPE) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BankRefreshEnqueuedDto> {
    if (!user.householdId) {
      throw new ForbiddenException('No household');
    }

    try {
      const output = await this.refresh.execute({
        connectionId: BankConnectionId.of(id),
        householdId: user.householdId,
        userId: user.userId,
      });

      return toBankRefreshEnqueuedDto(output);
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
    @Param('id', UUID_V7_PIPE) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    if (!user.householdId) {
      throw new ForbiddenException('No household');
    }

    try {
      await this.disconnect.execute({
        connectionId: BankConnectionId.of(id),
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
  @ApiResponse({
    status: 201,
    description: 'New consent link returned',
    type: BankReconnectLinkDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden or invalid state' })
  @ApiResponse({ status: 404, description: 'Connection not found' })
  @ApiBody({ type: ReconnectBankDto, required: false })
  async reconnectBank(
    @Param('id', UUID_V7_PIPE) id: string,
    @Body() body: ReconnectBankDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BankReconnectLinkDto> {
    if (!user.householdId) {
      throw new ForbiddenException('No household');
    }

    try {
      const output = await this.reconnect.execute({
        connectionId: BankConnectionId.of(id),
        householdId: user.householdId,
        userId: user.userId,
        redirectUri: body.redirectUri ?? 'https://app.power-budget.test/connect/callback',
      });

      return toBankReconnectLinkDto(output);
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
  @ApiResponse({ status: 200, description: 'List of bank accounts', type: [BankAccountDto] })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async listAccounts(
    @Param('id', UUID_V7_PIPE) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BankAccountDto[]> {
    if (!user.householdId) {
      return [];
    }

    const accounts = await this.listConnectionAccounts.execute({
      connectionId: BankConnectionId.of(id),
      householdId: user.householdId,
    });

    return accounts.map(toBankAccountDto);
  }
}
