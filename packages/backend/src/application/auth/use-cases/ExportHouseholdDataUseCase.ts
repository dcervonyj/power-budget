// eslint-disable-next-line no-restricted-imports -- CLN-061 allow-list (temporary, see eslint.layers.js)
import { uuidv7 } from 'uuidv7';
import { HouseholdExportId, type HouseholdId, type UserId } from '@power-budget/core';
import type {
  HouseholdExportRepository,
  HouseholdExportQueuePort,
} from '../../../domain/auth/ports.js';

export interface ExportHouseholdDataInput {
  readonly householdId: HouseholdId;
  readonly requestedByUserId: UserId;
}

export interface ExportHouseholdDataOutput {
  readonly exportId: HouseholdExportId;
  readonly status: 'pending';
}

export class ExportHouseholdDataUseCase {
  constructor(
    private readonly exportRepo: HouseholdExportRepository,
    private readonly exportQueue: HouseholdExportQueuePort,
  ) {}

  async execute(input: ExportHouseholdDataInput): Promise<ExportHouseholdDataOutput> {
    const exportId = HouseholdExportId.of(uuidv7());

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
