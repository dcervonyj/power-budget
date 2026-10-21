import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
  ForbiddenException,
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
import { JwtAuthGuard } from '../auth/guards/JwtAuthGuard.js';
import { CurrentUser, type AuthenticatedUser } from '../auth/decorators/CurrentUser.js';
import { GetPlanDashboardUseCase } from '../../application/plans/use-cases/GetPlanDashboardUseCase.js';
import { GetUnplannedTransactionsUseCase } from '../../application/plans/use-cases/GetUnplannedTransactionsUseCase.js';
import {
  PlanDashboardResponseDto,
  UnplannedQueryDto,
  UnplannedTransactionPageDto,
  toPlanDashboardDto,
  toUnplannedTransactionPageDto,
} from './dto/plan-dashboard.dto.js';

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
  @ApiResponse({ status: 200, description: 'Plan actuals view', type: PlanDashboardResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'No household' })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  async dashboard(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PlanDashboardResponseDto> {
    if (!user.householdId) {
      throw new ForbiddenException('No household');
    }
    // PLAN_NOT_FOUND is mapped to 404 `plan_not_found` by the exception filter.
    const view = await this.getDashboard.execute({
      planId: id as PlanId,
      householdId: user.householdId,
      asOf: new Date(),
    });

    return toPlanDashboardDto(view);
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
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Page size (default 50, max 200)',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated unplanned transaction list',
    type: UnplannedTransactionPageDto,
  })
  @ApiResponse({ status: 400, description: 'Missing or invalid direction parameter' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'No household' })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  async unplanned(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: UnplannedQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<UnplannedTransactionPageDto> {
    if (!user.householdId) {
      throw new ForbiddenException('No household');
    }

    const page = await this.getUnplanned.execute({
      planId: id as PlanId,
      householdId: user.householdId,
      direction: query.direction,
      cursor: query.cursor,
      limit: query.limit,
    });

    return toUnplannedTransactionPageDto(page);
  }
}
