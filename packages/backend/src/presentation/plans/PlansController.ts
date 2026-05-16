import {
  Controller,
  Get,
  Param,
  UseGuards,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import type { PlanId } from '@power-budget/core';
import { JwtAuthGuard } from '../auth/guards/JwtAuthGuard.js';
import { CurrentUser, type AuthenticatedUser } from '../auth/decorators/CurrentUser.js';
import { GetPlanDashboardUseCase } from '../../application/plans/use-cases/GetPlanDashboardUseCase.js';

@ApiTags('plans')
@Controller('plans')
export class PlansController {
  constructor(private readonly getDashboard: GetPlanDashboardUseCase) {}

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
}
