import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
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
  CurrencyCode,
  IsoDate,
  PlannedItemId,
  PlanId,
  TransactionId,
} from '@power-budget/core';
import { JwtAuthGuard } from '../auth/guards/JwtAuthGuard.js';
import { CurrentUser, type AuthenticatedUser } from '../auth/decorators/CurrentUser.js';
import {
  AddManualTransactionDto,
  BulkMapDto,
  ListTransactionsQueryDto,
  MarkTransferDto,
  PatchTransactionDto,
  SetMappingDto,
} from './dto/transactions.dto.js';
import { AddManualTransactionUseCase } from '../../application/transactions/use-cases/AddManualTransactionUseCase.js';
import { BulkActOnTransactionsUseCase } from '../../application/transactions/use-cases/BulkActOnTransactionsUseCase.js';
import { BulkMapTransactionsUseCase } from '../../application/transactions/use-cases/BulkMapTransactionsUseCase.js';
import { GetTransactionUseCase } from '../../application/transactions/use-cases/GetTransactionUseCase.js';
import { ListTransactionsUseCase } from '../../application/transactions/use-cases/ListTransactionsUseCase.js';
import { MapTransactionUseCase } from '../../application/transactions/use-cases/MapTransactionUseCase.js';
import { MarkAsTransferUseCase } from '../../application/transactions/use-cases/MarkAsTransferUseCase.js';
import { PatchTransactionUseCase } from '../../application/transactions/use-cases/PatchTransactionUseCase.js';
import { UnmarkTransferUseCase } from '../../application/transactions/use-cases/UnmarkTransferUseCase.js';
import {
  TransactionDetailDto,
  TransactionDto,
  TransactionPageDto,
  toTransactionDetailDto,
  toTransactionDto,
  toTransactionPageDto,
} from './dto/transaction-response.dto.js';

const STUB_PLAN_ID = '00000000-0000-0000-0000-000000000000' as PlanId;

// Domain errors (TRANSACTION_NOT_FOUND, ALREADY_MAPPED, ...) are mapped to HTTP
// statuses with their `code` by SentryExceptionFilter; no per-route try/catch.
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
    private readonly bulkActOnTransactions: BulkActOnTransactionsUseCase,
    private readonly markAsTransfer: MarkAsTransferUseCase,
    private readonly unmarkTransfer: UnmarkTransferUseCase,
    private readonly patchTransaction: PatchTransactionUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary: "List the caller's own transactions",
    description:
      "Only transactions on the caller's accounts; a partner's appear only as dashboard aggregates. Keyset-paged (occurredOn desc, id desc). Each row carries its mapping (plan and category names, archived plans included), mapping source, transfer link, ignored flag and booking status, read in one query.",
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of transactions',
    type: TransactionPageDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid query parameters' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async list(
    @Query() query: ListTransactionsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TransactionPageDto> {
    if (!user.householdId) {
      return { items: [], nextCursor: null, hasMore: false };
    }

    const page = await this.listTransactions.execute({
      query: {
        householdId: user.householdId,
        ownerUserId: user.userId,
        accountId: query.accountId as BankAccountId | undefined,
        dateFrom: query.from as IsoDate | undefined,
        dateTo: query.to as IsoDate | undefined,
        search: query.q,
        unmappedOnly: query.unmappedOnly,
        mapped: query.mapped,
        transfer: query.transfer,
        status: query.status,
        cursor: query.cursor,
        limit: query.limit,
      },
      householdId: user.householdId,
    });

    return toTransactionPageDto(page);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single transaction by ID' })
  @ApiParam({ name: 'id', description: 'Transaction ID' })
  @ApiResponse({ status: 200, description: 'Transaction detail', type: TransactionDetailDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 404,
    description:
      "Transaction not found, or a partner's (transactions are private to the account owner)",
  })
  async getOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TransactionDetailDto> {
    if (!user.householdId) {
      throw new NotFoundException('No household');
    }

    const detail = await this.getTransaction.execute(
      id as TransactionId,
      user.householdId,
      user.userId,
    );

    return toTransactionDetailDto(detail);
  }

  @Post()
  @ApiOperation({ summary: 'Add a manual transaction' })
  @ApiBody({ type: AddManualTransactionDto })
  @ApiResponse({ status: 201, description: 'Transaction created', type: TransactionDto })
  @ApiResponse({
    status: 400,
    description: 'Invalid body, zero amount, or amount not in the account currency',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: "Account not found or not the caller's own" })
  async addManual(
    @Body() dto: AddManualTransactionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TransactionDto> {
    if (!user.householdId) {
      throw new NotFoundException('No household');
    }

    const created = await this.addManualTransaction.execute({
      householdId: user.householdId,
      userId: user.userId,
      accountId: dto.accountId as BankAccountId,
      occurredOn: dto.occurredOn,
      amountMinor: BigInt(dto.amountMinor),
      // Validated against CURRENCIES by the DTO.
      currency: dto.currency as CurrencyCode,
      description: dto.description,
      merchant: dto.merchant ?? null,
      notes: dto.notes ?? null,
    });

    return toTransactionDto(created);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Patch notes or ignored flag on a transaction' })
  @ApiParam({ name: 'id', description: 'Transaction ID' })
  @ApiBody({ type: PatchTransactionDto })
  @ApiResponse({
    status: 200,
    description: 'Updated transaction',
    type: TransactionDetailDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid id or body' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 404,
    description:
      "Transaction not found, or a partner's (transactions are private to the account owner)",
  })
  async patch(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PatchTransactionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TransactionDetailDto> {
    if (!user.householdId) {
      throw new NotFoundException('No household');
    }

    // Transaction ids are not validated as v7 here, like the other routes of this controller.
    const transactionId = id as TransactionId;
    await this.patchTransaction.execute({
      transactionId,
      householdId: user.householdId,
      userId: user.userId,
      patch: {
        notes: dto.notes,
        ignored: dto.ignored,
      },
    });
    const detail = await this.getTransaction.execute(transactionId, user.householdId, user.userId);

    return toTransactionDetailDto(detail);
  }

  @Patch(':id/mapping')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Set or clear the planned-item mapping for a transaction' })
  @ApiParam({ name: 'id', description: 'Transaction ID' })
  @ApiBody({ type: SetMappingDto })
  @ApiResponse({ status: 204, description: 'Mapping updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 404,
    description:
      "Transaction not found, or a partner's (transactions are private to the account owner)",
  })
  async setMapping(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetMappingDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    if (!user.householdId) {
      return;
    }

    await this.mapTransaction.execute({
      transactionId: id as TransactionId,
      plannedItemId: (dto.plannedItemId as PlannedItemId) ?? null,
      by: user.userId,
      householdId: user.householdId,
      planId: STUB_PLAN_ID,
    });
  }

  @Post(':id/transfer')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark a transaction as a transfer between own accounts' })
  @ApiParam({ name: 'id', description: 'Transaction ID' })
  @ApiBody({ type: MarkTransferDto })
  @ApiResponse({ status: 204, description: 'Marked as transfer' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 404,
    description:
      "Transaction not found, or a partner's (transactions are private to the account owner)",
  })
  async markTransfer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MarkTransferDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    if (!user.householdId) {
      return;
    }

    await this.markAsTransfer.execute({
      transactionId: id as TransactionId,
      counterpartId: (dto.counterpartTransactionId as TransactionId | undefined) ?? null,
      by: user.userId,
      householdId: user.householdId,
    });
  }

  @Delete(':id/transfer')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unmark a transaction as a transfer' })
  @ApiParam({ name: 'id', description: 'Transaction ID' })
  @ApiResponse({ status: 204, description: 'Transfer flag removed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 404,
    description:
      "Transaction not found, or a partner's (transactions are private to the account owner)",
  })
  async unmarkTransferHandler(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    if (!user.householdId) {
      return;
    }

    await this.unmarkTransfer.execute({
      transactionId: id as TransactionId,
      householdId: user.householdId,
      userId: user.userId,
    });
  }

  @Post('bulk')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Bulk-map or bulk-act on a set of transactions',
    description:
      "`map` sets `payload.plannedItemId` on every id; `transfer` marks each id as a standalone transfer (ids already a transfer stay as they are); `ignore` sets `ignored`. All or nothing: every id must be on the caller's own accounts, and nothing is written when one is not.",
  })
  @ApiBody({ type: BulkMapDto })
  @ApiResponse({ status: 204, description: 'Bulk operation applied' })
  @ApiResponse({
    status: 404,
    description: "An id is not one of the caller's own transactions; nothing is written",
  })
  @ApiResponse({
    status: 409,
    description:
      '`transfer`: one of the transactions is mapped to a planned item; nothing is written',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async bulkMap(@Body() dto: BulkMapDto, @CurrentUser() user: AuthenticatedUser): Promise<void> {
    if (!user.householdId) {
      return;
    }

    if (dto.op !== 'map') {
      await this.bulkActOnTransactions.execute({
        action: dto.op,
        transactionIds: dto.ids.map((txId) => txId as TransactionId),
        by: user.userId,
        householdId: user.householdId,
      });

      return;
    }

    const plannedItemId = dto.payload?.['plannedItemId'] as string | undefined as
      PlannedItemId | undefined;
    if (!plannedItemId) {
      return;
    }

    await this.bulkMapTransactions.execute({
      mappings: dto.ids.map((txId) => ({
        transactionId: txId as TransactionId,
        plannedItemId,
      })),
      by: user.userId,
      householdId: user.householdId,
      planId: STUB_PLAN_ID,
    });
  }
}
