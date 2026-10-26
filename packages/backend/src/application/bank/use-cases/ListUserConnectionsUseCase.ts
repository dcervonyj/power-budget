import type { UserId } from '@power-budget/core';
import type { BankConnection } from '../../../domain/bank/entities.js';
import type { BankConnectionRepository } from '../../../domain/bank/ports.js';

function isConsented(connection: BankConnection): boolean {
  return connection.status !== 'pending';
}

export class ListUserConnectionsUseCase {
  constructor(private readonly connectionRepo: BankConnectionRepository) {}

  async execute(input: { userId: UserId }): Promise<BankConnection[]> {
    // User-scoped by design: the caller's own connections. RLS limits them to the household.
    const connections = await this.connectionRepo.listByUser(input.userId);

    // A `pending` connection is a consent in progress (or abandoned), not a connection yet.
    return connections.filter(isConsented);
  }
}
