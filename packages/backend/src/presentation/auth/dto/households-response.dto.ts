import { ApiProperty } from '@nestjs/swagger';
import type { HouseholdId } from '@power-budget/core';
import type { ExportHouseholdDataOutput } from '../../../application/auth/use-cases/ExportHouseholdDataUseCase.js';
import type { HouseholdExportStatusOutput } from '../../../application/auth/use-cases/GetHouseholdExportStatusUseCase.js';
import type { DeleteHouseholdOutput } from '../../../application/auth/use-cases/DeleteHouseholdUseCase.js';

export class HouseholdCreatedDto {
  @ApiProperty({ type: String })
  householdId!: string;
}

export class HouseholdExportRequestedDto {
  @ApiProperty({ type: String })
  exportId!: string;

  @ApiProperty({ type: String, enum: ['pending'] })
  status!: 'pending';
}

export class HouseholdExportStatusDto {
  @ApiProperty({ type: String, enum: ['pending', 'processing', 'ready', 'failed'] })
  status!: 'pending' | 'processing' | 'ready' | 'failed';

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Download link; set once the export is ready and not yet expired',
  })
  url!: string | null;

  @ApiProperty({ type: String, nullable: true, example: '2024-07-15T10:00:00.000Z' })
  expiresAt!: string | null;
}

export class HouseholdDeletionScheduledDto {
  @ApiProperty({
    type: String,
    description: 'When the household and its data will be purged',
    example: '2024-07-15T10:00:00.000Z',
  })
  scheduledFor!: string;
}

export function toHouseholdCreatedDto(householdId: HouseholdId): HouseholdCreatedDto {
  return { householdId };
}

export function toHouseholdExportRequestedDto(
  output: ExportHouseholdDataOutput,
): HouseholdExportRequestedDto {
  return { exportId: output.exportId, status: output.status };
}

export function toHouseholdExportStatusDto(
  output: HouseholdExportStatusOutput,
): HouseholdExportStatusDto {
  return {
    status: output.status,
    url: output.url,
    expiresAt: output.expiresAt ? output.expiresAt.toISOString() : null,
  };
}

export function toHouseholdDeletionScheduledDto(
  output: DeleteHouseholdOutput,
): HouseholdDeletionScheduledDto {
  return { scheduledFor: output.scheduledFor.toISOString() };
}
