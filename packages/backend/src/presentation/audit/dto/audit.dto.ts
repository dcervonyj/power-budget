import { IsOptional, IsString, IsDateString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

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

  @ApiPropertyOptional({ type: String, description: 'Pagination cursor (last audit event ID)' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ type: Number, description: 'Page size', example: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;
}
