import {
  Controller,
  Get,
  Param,
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
import type { HouseholdId, PlanId } from '@power-budget/core';
import { JwtAuthGuard } from '../auth/guards/JwtAuthGuard.js';
import { CurrentUser, type AuthenticatedUser } from '../auth/decorators/CurrentUser.js';
import { GetHouseholdDashboardUseCase } from '../../application/households/use-cases/GetHouseholdDashboardUseCase.js';
import {
  HouseholdDashboardResponseDto,
  HouseholdDashboardCategoryDto,
} from './dto/HouseholdDashboardResponseDto.js';

@ApiTags('households')
@Controller('households')
export class HouseholdsController {
  constructor(private readonly getHouseholdDashboard: GetHouseholdDashboardUseCase) {}

  @Get(':id/dashboard')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get household-level category dashboard for a plan' })
  @ApiParam({ name: 'id', description: 'Household ID' })
  @ApiQuery({ name: 'planId', required: true, type: String, description: 'Plan ID' })
  @ApiResponse({ status: 200, type: HouseholdDashboardResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'No household' })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  async dashboard(
    @Param('id') id: string,
    @Query('planId') planId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<HouseholdDashboardResponseDto> {
    if (!user.householdId) {
      throw new ForbiddenException('No household');
    }

    try {
      const result = await this.getHouseholdDashboard.execute({
        householdId: id as HouseholdId,
        planId: planId as PlanId,
        viewerUserId: user.userId,
      });

      const categories: HouseholdDashboardCategoryDto[] = result.categories.map((agg) => ({
        categoryId: agg.categoryId,
        categoryName: agg.category.name,
        privacyLevel: agg.privacyLevel,
        totalAmountMinor: Number(agg.totalAmount.amountMinor),
        currency: agg.totalAmount.currency,
        transactionCount: agg.transactionCount,
      }));

      return { planId, categories };
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('PLAN_NOT_FOUND')) {
        throw new NotFoundException('Plan not found');
      }
      throw err;
    }
  }
}
