import { ApiProperty } from '@nestjs/swagger';
import type { HouseholdId } from '@power-budget/core';
import type { ExportHouseholdDataOutput } from '../../../application/auth/use-cases/ExportHouseholdDataUseCase.js';
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

export function toHouseholdDeletionScheduledDto(
  output: DeleteHouseholdOutput,
): HouseholdDeletionScheduledDto {
  return { scheduledFor: output.scheduledFor.toISOString() };
}
