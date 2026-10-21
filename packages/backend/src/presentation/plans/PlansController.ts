import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CategoryId, IsoDate, PlanId, PlannedItemId } from '@power-budget/core';
import type { HouseholdId } from '@power-budget/core';
import { JwtAuthGuard } from '../auth/guards/JwtAuthGuard.js';
import { CurrentUser, type AuthenticatedUser } from '../auth/decorators/CurrentUser.js';
import { GetPlanDashboardUseCase } from '../../application/plans/use-cases/GetPlanDashboardUseCase.js';
import { GetUnplannedTransactionsUseCase } from '../../application/plans/use-cases/GetUnplannedTransactionsUseCase.js';
import { ListPlansUseCase } from '../../application/plans/use-cases/ListPlansUseCase.js';
import { GetPlanUseCase } from '../../application/plans/use-cases/GetPlanUseCase.js';
import { CreatePlanUseCase } from '../../application/plans/use-cases/CreatePlanUseCase.js';
import { UpdatePlanUseCase } from '../../application/plans/use-cases/UpdatePlanUseCase.js';
import { ArchivePlanUseCase } from '../../application/plans/use-cases/ArchivePlanUseCase.js';
import { ClonePlanFromPreviousUseCase } from '../../application/plans/use-cases/ClonePlanFromPreviousUseCase.js';
import { ListPlannedItemsUseCase } from '../../application/plans/use-cases/ListPlannedItemsUseCase.js';
import { AddPlannedItemUseCase } from '../../application/plans/use-cases/AddPlannedItemUseCase.js';
import { UpdatePlannedItemUseCase } from '../../application/plans/use-cases/UpdatePlannedItemUseCase.js';
import { RemovePlannedItemUseCase } from '../../application/plans/use-cases/RemovePlannedItemUseCase.js';
import { GetPlannedItemHistoryUseCase } from '../../application/plans/use-cases/GetPlannedItemHistoryUseCase.js';
import type { PlannedItemPatch } from '../../domain/plans/entities.js';
import {
  PlanDashboardResponseDto,
  UnplannedQueryDto,
  UnplannedTransactionPageDto,
  toPlanDashboardDto,
  toUnplannedTransactionPageDto,
} from './dto/plan-dashboard.dto.js';
import {
  ClonePlanDto,
  CreatePlanDto,
  CreatePlannedItemDto,
  ListPlansQueryDto,
  PlanDto,
  PlannedItemDto,
  PlannedItemVersionDto,
  UpdatePlanDto,
  UpdatePlannedItemDto,
  toPlanDto,
  toPlannedItemDto,
  toPlannedItemVersionDto,
} from './dto/plans.dto.js';

/** Plan and planned item ids are UUIDv7 (they become branded ids). */
const UUID_V7 = new ParseUUIDPipe({ version: '7' });

interface MemberContext {
  readonly userId: AuthenticatedUser['userId'];
  readonly householdId: HouseholdId;
}

@ApiTags('plans')
@ApiBearerAuth()
@Controller('plans')
@UseGuards(JwtAuthGuard)
@ApiResponse({ status: 401, description: 'Unauthorized' })
@ApiResponse({ status: 403, description: 'No household' })
export class PlansController {
  constructor(
    private readonly listPlans: ListPlansUseCase,
    private readonly getPlan: GetPlanUseCase,
    private readonly createPlan: CreatePlanUseCase,
    private readonly updatePlan: UpdatePlanUseCase,
    private readonly archivePlan: ArchivePlanUseCase,
    private readonly clonePlan: ClonePlanFromPreviousUseCase,
    private readonly listItems: ListPlannedItemsUseCase,
    private readonly addItem: AddPlannedItemUseCase,
    private readonly updateItem: UpdatePlannedItemUseCase,
    private readonly removeItem: RemovePlannedItemUseCase,
    private readonly itemHistory: GetPlannedItemHistoryUseCase,
    private readonly getDashboard: GetPlanDashboardUseCase,
    private readonly getUnplanned: GetUnplannedTransactionsUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List plans: household plans plus your own personal plans',
  })
  @ApiResponse({ status: 200, description: 'Plans ordered by period start', type: [PlanDto] })
  async list(
    @Query() query: ListPlansQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PlanDto[]> {
    const member = this.member(user);
    const plans = await this.listPlans.execute({ ...member, status: query.status ?? 'active' });

    return plans.map(toPlanDto);
  }

  @Post()
  @ApiOperation({ summary: 'Create a plan' })
  @ApiBody({ type: CreatePlanDto })
  @ApiResponse({ status: 201, description: 'Plan created', type: PlanDto })
  @ApiResponse({ status: 400, description: 'Invalid body or period' })
  @ApiResponse({ status: 409, description: 'An active plan of this type and period overlaps' })
  async create(
    @Body() dto: CreatePlanDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PlanDto> {
    const plan = await this.createPlan.execute({
      ...this.member(user),
      name: dto.name,
      type: dto.type,
      periodKind: dto.periodKind,
      periodStart: IsoDate.of(dto.periodStart),
      ...(dto.periodEnd !== undefined ? { periodEnd: IsoDate.of(dto.periodEnd) } : {}),
      baseCurrency: dto.baseCurrency,
    });

    return toPlanDto(plan);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a plan' })
  @ApiParam({ name: 'id', description: 'Plan ID (UUIDv7)' })
  @ApiResponse({ status: 200, description: 'The plan', type: PlanDto })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  async get(
    @Param('id', UUID_V7) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PlanDto> {
    const plan = await this.getPlan.execute({ ...this.member(user), planId: PlanId.of(id) });

    return toPlanDto(plan);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Rename a plan, move its period or change its base currency' })
  @ApiParam({ name: 'id', description: 'Plan ID (UUIDv7)' })
  @ApiBody({ type: UpdatePlanDto })
  @ApiResponse({ status: 200, description: 'Updated plan', type: PlanDto })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  @ApiResponse({ status: 409, description: 'Plan archived, or the new period overlaps' })
  async update(
    @Param('id', UUID_V7) id: string,
    @Body() dto: UpdatePlanDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PlanDto> {
    const plan = await this.updatePlan.execute({
      ...this.member(user),
      planId: PlanId.of(id),
      patch: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.periodStart !== undefined ? { periodStart: IsoDate.of(dto.periodStart) } : {}),
        ...(dto.periodEnd !== undefined ? { periodEnd: IsoDate.of(dto.periodEnd) } : {}),
        ...(dto.baseCurrency !== undefined ? { baseCurrency: dto.baseCurrency } : {}),
      },
    });

    return toPlanDto(plan);
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Archive a plan (idempotent). Archived plans are read-only' })
  @ApiParam({ name: 'id', description: 'Plan ID (UUIDv7)' })
  @ApiResponse({ status: 204, description: 'Plan archived' })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  async archive(
    @Param('id', UUID_V7) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.archivePlan.execute({ ...this.member(user), planId: PlanId.of(id) });
  }

  @Post(':id/clone')
  @ApiOperation({
    summary: 'Clone a plan and its planned items into a new period (default: the next one)',
  })
  @ApiParam({ name: 'id', description: 'Source plan ID (UUIDv7)' })
  @ApiBody({ type: ClonePlanDto })
  @ApiResponse({ status: 201, description: 'The new plan', type: PlanDto })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  @ApiResponse({ status: 409, description: 'An active plan of this type and period overlaps' })
  async clone(
    @Param('id', UUID_V7) id: string,
    @Body() dto: ClonePlanDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PlanDto> {
    const plan = await this.clonePlan.execute({
      ...this.member(user),
      sourcePlanId: PlanId.of(id),
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.periodStart !== undefined ? { periodStart: IsoDate.of(dto.periodStart) } : {}),
      ...(dto.periodEnd !== undefined ? { periodEnd: IsoDate.of(dto.periodEnd) } : {}),
    });

    return toPlanDto(plan);
  }

  @Get(':id/items')
  @ApiOperation({ summary: 'List the planned items of a plan' })
  @ApiParam({ name: 'id', description: 'Plan ID (UUIDv7)' })
  @ApiResponse({ status: 200, description: 'Planned items', type: [PlannedItemDto] })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  async items(
    @Param('id', UUID_V7) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PlannedItemDto[]> {
    const items = await this.listItems.execute({ ...this.member(user), planId: PlanId.of(id) });

    return items.map(toPlannedItemDto);
  }

  @Post(':id/items')
  @ApiOperation({ summary: 'Add a planned item' })
  @ApiParam({ name: 'id', description: 'Plan ID (UUIDv7)' })
  @ApiBody({ type: CreatePlannedItemDto })
  @ApiResponse({ status: 201, description: 'Planned item created', type: PlannedItemDto })
  @ApiResponse({ status: 404, description: 'Plan or category not found' })
  @ApiResponse({ status: 409, description: 'Plan archived' })
  async createItem(
    @Param('id', UUID_V7) id: string,
    @Body() dto: CreatePlannedItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PlannedItemDto> {
    const item = await this.addItem.execute({
      ...this.member(user),
      planId: PlanId.of(id),
      categoryId: CategoryId.of(dto.categoryId),
      direction: dto.direction,
      amount: { amountMinor: BigInt(dto.amountMinor), currency: dto.currency },
      note: dto.note ?? null,
    });

    return toPlannedItemDto(item);
  }

  @Patch(':id/items/:itemId')
  @ApiOperation({ summary: 'Change a planned item (the change is kept in its history)' })
  @ApiParam({ name: 'id', description: 'Plan ID (UUIDv7)' })
  @ApiParam({ name: 'itemId', description: 'Planned item ID (UUIDv7)' })
  @ApiBody({ type: UpdatePlannedItemDto })
  @ApiResponse({ status: 200, description: 'Updated planned item', type: PlannedItemDto })
  @ApiResponse({ status: 404, description: 'Plan or planned item not found' })
  @ApiResponse({ status: 409, description: 'Plan archived' })
  async patchItem(
    @Param('id', UUID_V7) id: string,
    @Param('itemId', UUID_V7) itemId: string,
    @Body() dto: UpdatePlannedItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PlannedItemDto> {
    const item = await this.updateItem.execute({
      ...this.member(user),
      planId: PlanId.of(id),
      itemId: PlannedItemId.of(itemId),
      patch: this.itemPatch(dto),
      ...(dto.reason !== undefined ? { reason: dto.reason } : {}),
    });

    return toPlannedItemDto(item);
  }

  @Delete(':id/items/:itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Remove a planned item; transactions mapped to it become unplanned',
  })
  @ApiParam({ name: 'id', description: 'Plan ID (UUIDv7)' })
  @ApiParam({ name: 'itemId', description: 'Planned item ID (UUIDv7)' })
  @ApiResponse({ status: 204, description: 'Planned item removed' })
  @ApiResponse({ status: 404, description: 'Plan or planned item not found' })
  @ApiResponse({ status: 409, description: 'Plan archived' })
  async deleteItem(
    @Param('id', UUID_V7) id: string,
    @Param('itemId', UUID_V7) itemId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.removeItem.execute({
      ...this.member(user),
      planId: PlanId.of(id),
      itemId: PlannedItemId.of(itemId),
    });
  }

  @Get(':id/items/:itemId/history')
  @ApiOperation({ summary: 'Change history of a planned item, newest first' })
  @ApiParam({ name: 'id', description: 'Plan ID (UUIDv7)' })
  @ApiParam({ name: 'itemId', description: 'Planned item ID (UUIDv7)' })
  @ApiResponse({ status: 200, description: 'History entries', type: [PlannedItemVersionDto] })
  @ApiResponse({ status: 404, description: 'Plan or planned item not found' })
  async history(
    @Param('id', UUID_V7) id: string,
    @Param('itemId', UUID_V7) itemId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PlannedItemVersionDto[]> {
    const versions = await this.itemHistory.execute({
      ...this.member(user),
      planId: PlanId.of(id),
      itemId: PlannedItemId.of(itemId),
    });

    return versions.map(toPlannedItemVersionDto);
  }

  @Get(':id/dashboard')
  @ApiOperation({ summary: 'Get plan actuals dashboard' })
  @ApiParam({ name: 'id', description: 'Plan ID (UUIDv7)' })
  @ApiResponse({ status: 200, description: 'Plan actuals view', type: PlanDashboardResponseDto })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  async dashboard(
    @Param('id', UUID_V7) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PlanDashboardResponseDto> {
    // PLAN_NOT_FOUND is mapped to 404 `plan_not_found` by the exception filter.
    const view = await this.getDashboard.execute({
      ...this.member(user),
      planId: PlanId.of(id),
      asOf: new Date(),
    });

    return toPlanDashboardDto(view);
  }

  @Get(':id/dashboard/unplanned')
  @ApiOperation({ summary: 'Get paginated unplanned transactions for a plan period' })
  @ApiParam({ name: 'id', description: 'Plan ID (UUIDv7)' })
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
  @ApiResponse({ status: 404, description: 'Plan not found' })
  async unplanned(
    @Param('id', UUID_V7) id: string,
    @Query() query: UnplannedQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<UnplannedTransactionPageDto> {
    const page = await this.getUnplanned.execute({
      ...this.member(user),
      planId: PlanId.of(id),
      direction: query.direction,
      cursor: query.cursor,
      limit: query.limit,
    });

    return toUnplannedTransactionPageDto(page);
  }

  private member(user: AuthenticatedUser): MemberContext {
    if (!user.householdId) {
      throw new ForbiddenException('No household');
    }

    return { userId: user.userId, householdId: user.householdId };
  }

  private itemPatch(dto: UpdatePlannedItemDto): PlannedItemPatch {
    return {
      ...(dto.amountMinor !== undefined && dto.currency !== undefined
        ? { amount: { amountMinor: BigInt(dto.amountMinor), currency: dto.currency } }
        : {}),
      ...(dto.note !== undefined ? { note: dto.note } : {}),
    };
  }
}
