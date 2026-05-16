import type { BankConnectionId, HouseholdId } from '@power-budget/core';
import type { BankConnectionRepository } from '../../domain/ports.js';
import type { ScheduledSyncTarget } from '../models/index.js';
export type { ScheduledSyncTarget };

export class BankSyncSchedulerUseCase {
  constructor(private readonly connectionRepo: BankConnectionRepository) {}

  async execute(): Promise<ScheduledSyncTarget[]> {
    const connections = await this.connectionRepo.findActiveConnections();
    return connections.map((c) => ({
      connectionId: c.id,
      householdId: c.householdId,
    }));
  }
}
