import { IsOptional, IsString, IsDateString, IsInt, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ClampMax } from '../../http/validators.js';

export const AUDIT_PAGE_MAX = 200;

export class ListAuditLogQueryDto {
  @ApiPropertyOptional({
    type: String,
    description: 'Filter by subject entity type',
    example: 'transaction',
  })
  @IsOptional()
  @IsString()
  subjectType?: string;

  @ApiPropertyOptional({ type: String, description: 'Filter by subject entity ID' })
  @IsOptional()
  @IsString()
  subjectId?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Start date filter (ISO 8601)',
    example: '2024-01-01',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'End date filter (ISO 8601)',
    example: '2024-12-31',
  })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({
    type: String,
    description: 'Pagination cursor (`nextCursor` of the previous page)',
  })
  @IsOptional()
  @IsUUID('7')
  cursor?: string;

  @ApiPropertyOptional({
    type: Number,
    description: `Page size (default 50, values above ${AUDIT_PAGE_MAX} are clamped)`,
    example: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @ClampMax(AUDIT_PAGE_MAX)
  limit?: number;
}
