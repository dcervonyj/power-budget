import type { UserId } from '@power-budget/core';
import type { BankConnection } from '../../../domain/bank/entities.js';
import type { BankConnectionRepository } from '../../../domain/bank/ports.js';

export class ListUserConnectionsUseCase {
  constructor(private readonly connectionRepo: BankConnectionRepository) {}

  async execute(input: { userId: UserId }): Promise<BankConnection[]> {
    return this.connectionRepo.listByUser(input.userId);
  }
}
