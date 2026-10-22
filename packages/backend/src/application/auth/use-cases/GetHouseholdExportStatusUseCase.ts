import type { HouseholdId } from '@power-budget/core';
import type { HouseholdExport, HouseholdExportRepository } from '../../../domain/auth/ports.js';

export interface GetHouseholdExportStatusInput {
  readonly householdId: HouseholdId;
  readonly now?: Date;
}

export interface HouseholdExportStatusOutput {
  readonly status: HouseholdExport['status'];
  readonly url: string | null;
  readonly expiresAt: Date | null;
}

/** Status of the household's most recent export; null when none was ever requested. */
export class GetHouseholdExportStatusUseCase {
  constructor(private readonly exportRepo: HouseholdExportRepository) {}

  async execute(input: GetHouseholdExportStatusInput): Promise<HouseholdExportStatusOutput | null> {
    const latest = await this.exportRepo.findLatestByHousehold(input.householdId);
    if (!latest) {
      return null;
    }
    const now = input.now ?? new Date();
    const expired = latest.expiresAt !== null && latest.expiresAt.getTime() <= now.getTime();

    return {
      status: latest.status,
      url: latest.status === 'ready' && !expired ? latest.downloadUrl : null,
      expiresAt: latest.expiresAt,
    };
  }
}
