import type { UserId, HouseholdId, BankConnectionId } from '@power-budget/core';
import type { BankConnectionRepository, BankConnectorRegistry } from '../../domain/ports.js';
import {
  BankConnectionNotFoundError,
  BankConnectionForbiddenError,
  BankConnectionInvalidStateError,
} from '../../domain/errors.js';
import type { ReconnectBankInput, ReconnectBankOutput } from '../models/index.js';
export type { ReconnectBankInput, ReconnectBankOutput };

export class ReconnectBankUseCase {
  constructor(
    private readonly connectionRepo: BankConnectionRepository,
    private readonly registry: BankConnectorRegistry,
  ) {}

  async execute(input: ReconnectBankInput): Promise<ReconnectBankOutput> {
    const connection = await this.connectionRepo.findById(input.connectionId, {
      householdId: input.householdId,
    });
    if (connection === null) {
      throw new BankConnectionNotFoundError();
    }
    if (connection.userId !== input.userId) {
      throw new BankConnectionForbiddenError();
    }
    if (
      connection.status !== 'expired' &&
      connection.status !== 'disconnected' &&
      connection.status !== 'reconnect_required'
    ) {
      throw new BankConnectionInvalidStateError(
        `Cannot reconnect a connection with status: ${connection.status}`,
      );
    }

    const connector = this.registry.resolve(connection.provider);
    const { consentUrl } = await connector.refreshConsent(connection.id);

    return { consentUrl };
  }
}
