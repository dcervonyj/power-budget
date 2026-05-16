import { uuidv7 } from 'uuidv7';
import type { HouseholdId, UserId, HouseholdExportId } from '@power-budget/core';
import type { HouseholdExportRepository, HouseholdExportQueuePort } from '../../domain/ports.js';
import type { ExportHouseholdDataInput, ExportHouseholdDataOutput } from '../models/index.js';
export type { ExportHouseholdDataInput, ExportHouseholdDataOutput };

export class ExportHouseholdDataUseCase {
  constructor(
    private readonly exportRepo: HouseholdExportRepository,
    private readonly exportQueue: HouseholdExportQueuePort,
  ) {}

  async execute(input: ExportHouseholdDataInput): Promise<ExportHouseholdDataOutput> {
    const exportId = uuidv7() as HouseholdExportId;

    await this.exportRepo.create({
      id: exportId,
      householdId: input.householdId,
      requestedByUserId: input.requestedByUserId,
    });

    await this.exportQueue.enqueue({
      exportId,
      householdId: input.householdId,
    });

    return { exportId, status: 'pending' };
  }
}
