import {
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { PlanId } from '@power-budget/core';
import { brandOrNotFound } from '../http/brandedIds.js';
import { JwtAuthGuard } from '../auth/guards/JwtAuthGuard.js';
import { CurrentUser, type AuthenticatedUser } from '../auth/decorators/CurrentUser.js';
import { GetHouseholdDashboardUseCase } from '../../application/households/use-cases/GetHouseholdDashboardUseCase.js';
import {
  HouseholdDashboardResponseDto,
  toHouseholdDashboardCategoryDto,
} from './dto/HouseholdDashboardResponseDto.js';

@ApiTags('households')
@Controller('households')
export class HouseholdsController {
  constructor(
    @Inject(GetHouseholdDashboardUseCase)
    private readonly getHouseholdDashboard: GetHouseholdDashboardUseCase,
  ) {}

  @Get(':id/dashboard')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get household-level category dashboard for a plan' })
  @ApiParam({ name: 'id', description: 'Household ID' })
  @ApiQuery({ name: 'planId', required: true, type: String, description: 'Plan ID' })
  @ApiResponse({ status: 200, type: HouseholdDashboardResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'No household' })
  @ApiResponse({ status: 404, description: 'Household or plan not found' })
  @ApiResponse({ status: 503, description: 'Exchange rate unavailable (fx_rate_unavailable)' })
  async dashboard(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('planId', ParseUUIDPipe) planId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<HouseholdDashboardResponseDto> {
    if (!user.householdId) {
      throw new ForbiddenException('No household');
    }
    // Only the caller's own household is readable (audit H1). A foreign id
    // gets the same 404 as a missing one so household ids cannot be probed.
    if (id !== user.householdId) {
      throw new NotFoundException('Household not found');
    }

    // PLAN_NOT_FOUND is mapped to 404 `plan_not_found` by the exception filter.
    const result = await this.getHouseholdDashboard.execute({
      householdId: user.householdId,
      planId: brandOrNotFound(
        PlanId,
        planId,
        () => new Error(`PLAN_NOT_FOUND: Plan ${planId} not found`),
      ),
      viewerUserId: user.userId,
      asOf: new Date(),
    });

    return { planId, categories: result.categories.map(toHouseholdDashboardCategoryDto) };
  }
}
