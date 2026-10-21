import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import type {
  CategoryKind,
  CategoryPrivacyLevel,
  CategoryView,
} from '../../../domain/categories/entities.js';
import { ToBoolean } from '../../http/validators.js';

const KINDS: readonly CategoryKind[] = ['income', 'expense'];
const PRIVACY_LEVELS: readonly CategoryPrivacyLevel[] = [
  'full_detail',
  'total_with_counts',
  'total_only',
];
const COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

export class ListCategoriesQueryDto {
  @ApiPropertyOptional({
    type: Boolean,
    description: 'Include archived categories (default false)',
  })
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  includeArchived?: boolean;
}

export class CreateCategoryDto {
  @ApiProperty({ type: String, maxLength: 100, example: 'Coffee' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ enum: KINDS, description: 'Defaults to expense' })
  @IsOptional()
  @IsIn(KINDS)
  kind?: CategoryKind;

  @ApiPropertyOptional({ type: String, maxLength: 100, example: 'coffee' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  icon?: string;

  @ApiPropertyOptional({ type: String, example: '#6B7280' })
  @IsOptional()
  @Matches(COLOR_PATTERN, { message: 'color must be a #RRGGBB hex colour' })
  color?: string;
}

/** PATCH /categories/:id. Household categories only; system categories are read-only. */
export class UpdateCategoryDto {
  @ApiPropertyOptional({ type: String, maxLength: 100 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ type: String, maxLength: 100 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  icon?: string;

  @ApiPropertyOptional({ type: String, example: '#10B981' })
  @IsOptional()
  @Matches(COLOR_PATTERN, { message: 'color must be a #RRGGBB hex colour' })
  color?: string;

  @ApiPropertyOptional({ enum: PRIVACY_LEVELS })
  @IsOptional()
  @IsIn(PRIVACY_LEVELS)
  privacy?: CategoryPrivacyLevel;

  @ApiPropertyOptional({ type: Boolean, description: 'true archives, false restores' })
  @IsOptional()
  @IsBoolean()
  archived?: boolean;
}

export class CategoryDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ enum: KINDS })
  kind!: string;

  @ApiProperty({ type: String, example: 'tag' })
  icon!: string;

  @ApiProperty({ type: String, example: '#6B7280' })
  color!: string;

  @ApiProperty({
    type: Boolean,
    description: 'Seeded category shared by all households (read-only)',
  })
  isSystem!: boolean;

  @ApiProperty({ type: String, nullable: true, example: 'expense.groceries' })
  seedKey!: string | null;

  @ApiProperty({ enum: PRIVACY_LEVELS })
  privacy!: string;

  @ApiProperty({ type: Boolean })
  archived!: boolean;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  archivedAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;
}

export function toCategoryDto(category: CategoryView): CategoryDto {
  return {
    id: category.id,
    name: category.name,
    kind: category.kind,
    icon: category.icon,
    color: category.color,
    isSystem: category.householdId === null,
    seedKey: category.seedKey,
    privacy: category.privacy,
    archived: category.archivedAt !== null,
    archivedAt: category.archivedAt,
    createdAt: category.createdAt,
  };
}
