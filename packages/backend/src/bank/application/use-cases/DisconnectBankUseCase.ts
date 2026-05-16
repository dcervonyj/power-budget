import type { UserId, HouseholdId, BankConnectionId } from '@power-budget/core';
import type { BankConnectionRepository, BankConnectorRegistry } from '../../domain/ports.js';
import type { AuditLogger } from '../../../audit/domain/ports.js';
import { BankConnectionNotFoundError, BankConnectionForbiddenError } from '../../domain/errors.js';
import type { DisconnectBankInput } from '../models/index.js';
export type { DisconnectBankInput };

export class DisconnectBankUseCase {
  constructor(
    private readonly connectionRepo: BankConnectionRepository,
    private readonly registry: BankConnectorRegistry,
    private readonly auditLogger: AuditLogger,
  ) {}

  async execute(input: DisconnectBankInput): Promise<void> {
    const connection = await this.connectionRepo.findById(input.connectionId, {
      householdId: input.householdId,
    });
    if (connection === null) {
      throw new BankConnectionNotFoundError();
    }
    if (connection.userId !== input.userId) {
      throw new BankConnectionForbiddenError();
    }

    if (connection.encryptedConsent !== null) {
      const connector = this.registry.resolve(connection.provider);
      await connector.disconnect(connection.id, connection.encryptedConsent);
    }

    const now = new Date();
    await this.connectionRepo.markDisconnected(connection.id, now);

    await this.auditLogger.log({
      householdId: input.householdId,
      actorId: input.userId,
      subjectType: 'bank_connection',
      subjectId: input.connectionId,
      action: 'bank.disconnected',
      meta: { provider: connection.provider, bankId: connection.bankId },
    });
  }
}
