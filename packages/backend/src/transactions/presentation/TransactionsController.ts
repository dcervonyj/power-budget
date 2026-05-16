import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
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
import type {
  BankAccountId,
  IsoDate,
  PlannedItemId,
  PlanId,
  TransactionId,
} from '@power-budget/core';
import { JwtAuthGuard } from '../../auth/presentation/guards/JwtAuthGuard.js';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../auth/presentation/decorators/CurrentUser.js';
import {
  AddManualTransactionDto,
  BulkMapDto,
  ListTransactionsQueryDto,
  MarkTransferDto,
  PatchTransactionDto,
  SetMappingDto,
} from './dto/transactions.dto.js';
import { AddManualTransactionUseCase } from '../application/use-cases/AddManualTransactionUseCase.js';
import { BulkMapTransactionsUseCase } from '../application/use-cases/BulkMapTransactionsUseCase.js';
import { GetTransactionUseCase } from '../application/use-cases/GetTransactionUseCase.js';
import { ListTransactionsUseCase } from '../application/use-cases/ListTransactionsUseCase.js';
import { MapTransactionUseCase } from '../application/use-cases/MapTransactionUseCase.js';
import { MarkAsTransferUseCase } from '../application/use-cases/MarkAsTransferUseCase.js';
import { PatchTransactionUseCase } from '../application/use-cases/PatchTransactionUseCase.js';
import { UnmarkTransferUseCase } from '../application/use-cases/UnmarkTransferUseCase.js';
import { TransactionNotFoundError } from '../domain/errors.js';

const STUB_PLAN_ID = '00000000-0000-0000-0000-000000000000' as PlanId;

@ApiTags('transactions')
@ApiBearerAuth()
@Controller('transactions')
@UseGuards(JwtAuthGuard)
export class TransactionsController {
  constructor(
    private readonly listTransactions: ListTransactionsUseCase,
    private readonly getTransaction: GetTransactionUseCase,
    private readonly addManualTransaction: AddManualTransactionUseCase,
    private readonly mapTransaction: MapTransactionUseCase,
    private readonly bulkMapTransactions: BulkMapTransactionsUseCase,
    private readonly markAsTransfer: MarkAsTransferUseCase,
    private readonly unmarkTransfer: UnmarkTransferUseCase,
    private readonly patchTransaction: PatchTransactionUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List transactions for the current household' })
  @ApiResponse({ status: 200, description: 'Paginated list of transactions' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async list(@Query() query: ListTransactionsQueryDto, @CurrentUser() user: AuthenticatedUser) {
    if (!user.householdId) {
      return { items: [], nextCursor: null, hasMore: false };
    }

    return this.listTransactions.execute({
      query: {
        householdId: user.householdId,
        accountId: query.accountId as BankAccountId | undefined,
        dateFrom: query.from as IsoDate | undefined,
        dateTo: query.to as IsoDate | undefined,
        search: query.q,
        unmappedOnly: query.unmappedOnly,
        cursor: query.cursor as TransactionId | undefined,
        limit: query.limit,
      },
      householdId: user.householdId,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single transaction by ID' })
  @ApiParam({ name: 'id', description: 'Transaction ID' })
  @ApiResponse({ status: 200, description: 'Transaction detail' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async getOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    if (!user.householdId) {
      throw new NotFoundException('No household');
    }

    try {
      return await this.getTransaction.execute(id as TransactionId, user.householdId);
    } catch (err) {
      if (err instanceof TransactionNotFoundError) {
        throw new NotFoundException('Transaction not found');
      }
      throw err;
    }
  }

  @Post()
  @ApiOperation({ summary: 'Add a manual transaction' })
  @ApiBody({ type: AddManualTransactionDto })
  @ApiResponse({ status: 201, description: 'Transaction created' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async addManual(@Body() dto: AddManualTransactionDto, @CurrentUser() user: AuthenticatedUser) {
    if (!user.householdId) {
      throw new NotFoundException('No household');
    }

    return this.addManualTransaction.execute({
      householdId: user.householdId,
      accountId: dto.accountId as BankAccountId,
      occurredOn: dto.occurredOn,
      amountMinor: BigInt(dto.amountMinor),
      currency: dto.currency,
      description: dto.description,
      merchant: dto.merchant ?? null,
      notes: dto.notes ?? null,
    });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Patch notes or ignored flag on a transaction' })
  @ApiParam({ name: 'id', description: 'Transaction ID' })
  @ApiBody({ type: PatchTransactionDto })
  @ApiResponse({ status: 200, description: 'Transaction updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async patch(
    @Param('id') id: string,
    @Body() dto: PatchTransactionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!user.householdId) {
      throw new NotFoundException('No household');
    }

    try {
      await this.patchTransaction.execute({
        transactionId: id as TransactionId,
        householdId: user.householdId,
        patch: {
          notes: dto.notes ?? undefined,
          ignored: dto.ignored,
        },
      });
    } catch (err) {
      if (err instanceof TransactionNotFoundError) {
        throw new NotFoundException('Transaction not found');
      }
      throw err;
    }
  }

  @Patch(':id/mapping')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Set or clear the planned-item mapping for a transaction' })
  @ApiParam({ name: 'id', description: 'Transaction ID' })
  @ApiBody({ type: SetMappingDto })
  @ApiResponse({ status: 204, description: 'Mapping updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async setMapping(
    @Param('id') id: string,
    @Body() dto: SetMappingDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    if (!user.householdId) {
      return;
    }

    try {
      await this.mapTransaction.execute({
        transactionId: id as TransactionId,
        plannedItemId: (dto.plannedItemId as PlannedItemId) ?? null,
        by: user.userId,
        householdId: user.householdId,
        planId: STUB_PLAN_ID,
      });
    } catch (err) {
      if (err instanceof TransactionNotFoundError) {
        throw new NotFoundException('Transaction not found');
      }
      throw err;
    }
  }

  @Post(':id/transfer')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark a transaction as a transfer between own accounts' })
  @ApiParam({ name: 'id', description: 'Transaction ID' })
  @ApiBody({ type: MarkTransferDto })
  @ApiResponse({ status: 204, description: 'Marked as transfer' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async markTransfer(
    @Param('id') id: string,
    @Body() dto: MarkTransferDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    if (!user.householdId) {
      return;
    }

    try {
      await this.markAsTransfer.execute({
        transactionId: id as TransactionId,
        counterpartId: (dto.counterpartTransactionId as TransactionId | undefined) ?? null,
        by: user.userId,
        householdId: user.householdId,
      });
    } catch (err) {
      if (err instanceof TransactionNotFoundError) {
        throw new NotFoundException('Transaction not found');
      }
      throw err;
    }
  }

  @Delete(':id/transfer')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unmark a transaction as a transfer' })
  @ApiParam({ name: 'id', description: 'Transaction ID' })
  @ApiResponse({ status: 204, description: 'Transfer flag removed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async unmarkTransferHandler(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    if (!user.householdId) {
      return;
    }

    try {
      await this.unmarkTransfer.execute({
        transactionId: id as TransactionId,
        householdId: user.householdId,
      });
    } catch (err) {
      if (err instanceof TransactionNotFoundError) {
        throw new NotFoundException('Transaction not found');
      }
      throw err;
    }
  }

  @Post('bulk')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Bulk-map or bulk-act on a set of transactions' })
  @ApiBody({ type: BulkMapDto })
  @ApiResponse({ status: 204, description: 'Bulk operation applied' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async bulkMap(@Body() dto: BulkMapDto, @CurrentUser() user: AuthenticatedUser): Promise<void> {
    if (!user.householdId || dto.op !== 'map') {
      return;
    }

    const plannedItemId = dto.payload?.['plannedItemId'] as string | undefined as
      | PlannedItemId
      | undefined;
    if (!plannedItemId) {
      return;
    }

    await this.bulkMapTransactions.execute({
      mappings: dto.ids.map((txId) => ({
        transactionId: txId as TransactionId,
        plannedItemId,
      })),
      by: user.userId,
      planId: STUB_PLAN_ID,
    });
  }
}
