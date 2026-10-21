import {
  Body,
  Controller,
  ForbiddenException,
  Get,
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
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CategoryId } from '@power-budget/core';
import type { HouseholdId } from '@power-budget/core';
import { JwtAuthGuard } from '../auth/guards/JwtAuthGuard.js';
import { CurrentUser, type AuthenticatedUser } from '../auth/decorators/CurrentUser.js';
import { ListCategoriesUseCase } from '../../application/categories/use-cases/ListCategoriesUseCase.js';
import { CreateCategoryUseCase } from '../../application/categories/use-cases/CreateCategoryUseCase.js';
import { UpdateCategoryUseCase } from '../../application/categories/use-cases/UpdateCategoryUseCase.js';
import {
  CategoryDto,
  CreateCategoryDto,
  ListCategoriesQueryDto,
  UpdateCategoryDto,
  toCategoryDto,
} from './dto/categories.dto.js';

@ApiTags('categories')
@ApiBearerAuth()
@Controller('categories')
@UseGuards(JwtAuthGuard)
@ApiResponse({ status: 401, description: 'Unauthorized' })
@ApiResponse({ status: 403, description: 'No household' })
export class CategoriesController {
  constructor(
    private readonly listCategories: ListCategoriesUseCase,
    private readonly createCategory: CreateCategoryUseCase,
    private readonly updateCategory: UpdateCategoryUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: "List system categories and the household's own categories" })
  @ApiResponse({ status: 200, description: 'Categories', type: [CategoryDto] })
  async list(
    @Query() query: ListCategoriesQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CategoryDto[]> {
    const categories = await this.listCategories.execute({
      householdId: this.householdOf(user),
      includeArchived: query.includeArchived ?? false,
    });

    return categories.map(toCategoryDto);
  }

  @Post()
  @ApiOperation({ summary: 'Create a household category' })
  @ApiBody({ type: CreateCategoryDto })
  @ApiResponse({ status: 201, description: 'Category created', type: CategoryDto })
  @ApiResponse({ status: 409, description: 'An active category with this name exists' })
  async create(
    @Body() dto: CreateCategoryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CategoryDto> {
    const category = await this.createCategory.execute({
      householdId: this.householdOf(user),
      userId: user.userId,
      name: dto.name,
      kind: dto.kind ?? 'expense',
      ...(dto.icon !== undefined ? { icon: dto.icon } : {}),
      ...(dto.color !== undefined ? { color: dto.color } : {}),
    });

    return toCategoryDto(category);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Rename, restyle, archive/restore or set the privacy of a category' })
  @ApiParam({ name: 'id', description: 'Category ID' })
  @ApiBody({ type: UpdateCategoryDto })
  @ApiResponse({ status: 200, description: 'Updated category', type: CategoryDto })
  @ApiResponse({ status: 403, description: 'System categories are read-only' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  @ApiResponse({ status: 409, description: 'An active category with this name exists' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CategoryDto> {
    const category = await this.updateCategory.execute({
      householdId: this.householdOf(user),
      userId: user.userId,
      categoryId: CategoryId.of(id),
      changes: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.icon !== undefined ? { icon: dto.icon } : {}),
        ...(dto.color !== undefined ? { color: dto.color } : {}),
        ...(dto.privacy !== undefined ? { privacy: dto.privacy } : {}),
        ...(dto.archived !== undefined ? { archived: dto.archived } : {}),
      },
    });

    return toCategoryDto(category);
  }

  private householdOf(user: AuthenticatedUser): HouseholdId {
    if (!user.householdId) {
      throw new ForbiddenException('No household');
    }

    return user.householdId;
  }
}
