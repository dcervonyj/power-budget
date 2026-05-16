import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import type { PlanId } from '@power-budget/core';
import { JwtAuthGuard } from '../../auth/presentation/guards/JwtAuthGuard.js';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../auth/presentation/decorators/CurrentUser.js';
import { GetPlanDashboardUseCase } from '../application/use-cases/GetPlanDashboardUseCase.js';
import { GetUnplannedTransactionsUseCase } from '../application/use-cases/GetUnplannedTransactionsUseCase.js';

@ApiTags('plans')
@Controller('plans')
export class PlansController {
  constructor(
    private readonly getDashboard: GetPlanDashboardUseCase,
    private readonly getUnplanned: GetUnplannedTransactionsUseCase,
  ) {}

  @Get(':id/dashboard')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get plan actuals dashboard' })
  @ApiParam({ name: 'id', description: 'Plan ID' })
  @ApiResponse({ status: 200, description: 'Plan actuals view' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'No household' })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  async dashboard(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    if (!user.householdId) {
      throw new ForbiddenException('No household');
    }
    try {
      return await this.getDashboard.execute({
        planId: id as PlanId,
        householdId: user.householdId,
        asOf: new Date(),
      });
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('PLAN_NOT_FOUND')) {
        throw new NotFoundException('Plan not found');
      }
      throw err;
    }
  }

  @Get(':id/dashboard/unplanned')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get paginated unplanned transactions for a plan period' })
  @ApiParam({ name: 'id', description: 'Plan ID' })
  @ApiQuery({
    name: 'direction',
    required: true,
    enum: ['income', 'expense'],
    description: 'Filter by transaction direction',
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    type: String,
    description: 'Pagination cursor (opaque, from previous response)',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Page size (default 50)' })
  @ApiResponse({ status: 200, description: 'Paginated unplanned transaction list' })
  @ApiResponse({ status: 400, description: 'Missing or invalid direction parameter' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'No household' })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  async unplanned(
    @Param('id') id: string,
    @Query('direction') direction: string,
    @Query('cursor') cursor: string | undefined,
    @Query('limit') limit: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!user.householdId) {
      throw new ForbiddenException('No household');
    }

    if (direction !== 'income' && direction !== 'expense') {
      throw new BadRequestException('direction must be "income" or "expense"');
    }

    const parsedLimit = limit !== undefined ? parseInt(limit, 10) : undefined;

    try {
      const page = await this.getUnplanned.execute({
        planId: id as PlanId,
        householdId: user.householdId,
        direction,
        cursor,
        limit: parsedLimit,
      });

      return {
        items: page.items.map((item) => ({
          id: item.id,
          description: item.description,
          amountMinor: Number(item.amountMinor),
          currency: item.currency,
          occurredOn: item.occurredOn,
          accountId: item.accountId,
          source: item.source,
        })),
        nextCursor: page.nextCursor,
      };
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('PLAN_NOT_FOUND')) {
        throw new NotFoundException('Plan not found');
      }
      throw err;
    }
  }
}
