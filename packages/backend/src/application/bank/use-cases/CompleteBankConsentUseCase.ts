import type { BankConnectionId, HouseholdId, UserId } from '@power-budget/core';
import type {
  BankConnectionRepository,
  BankConnectorRegistry,
} from '../../../domain/bank/ports.js';
import {
  BankConsentNotFoundError,
  BankConnectionInvalidStateError,
} from '../../../domain/bank/errors.js';

export interface CompleteBankConsentInput {
  readonly connectionId: BankConnectionId;
  readonly userId: UserId;
  readonly householdId: HouseholdId;
  readonly callbackPayload: Record<string, string>;
}

export interface CompleteBankConsentOutput {
  readonly connectionId: BankConnectionId;
}

export class CompleteBankConsentUseCase {
  constructor(
    private readonly connectionRepo: BankConnectionRepository,
    private readonly registry: BankConnectorRegistry,
  ) {}

  async execute(input: CompleteBankConsentInput): Promise<CompleteBankConsentOutput> {
    // Look the connection up by its own id inside the caller's household, and
    // require that the caller started it (audit C4). The consent token from the
    // callback can then only ever land on the caller's own pending connection.
    const scope = { householdId: input.householdId };
    const connection = await this.connectionRepo.findById(input.connectionId, scope);
    if (
      connection === null ||
      connection.userId !== input.userId ||
      connection.externalConsentRef === null
    ) {
      throw new BankConsentNotFoundError();
    }
    // Several attempts may be pending (an abandoned one never blocks a retry); once one of them
    // is active, a late callback of another must not open a second connection to the bank.
    const active = await this.connectionRepo.findActiveByUserAndBank(
      connection.userId,
      connection.bankId,
      connection.provider,
    );
    if (active !== null && active.id !== connection.id) {
      throw new BankConnectionInvalidStateError(
        'Another connection to this bank is already active',
      );
    }

    const connector = this.registry.resolve(connection.provider);
    const { consentToken, expiresAt } = await connector.completeConsent({
      externalConsentRef: connection.externalConsentRef,
      callbackPayload: input.callbackPayload,
    });

    await this.connectionRepo.updateConsent(connection.id, consentToken, expiresAt, scope);
    await this.connectionRepo.markActive(connection.id, scope);

    return { connectionId: connection.id };
  }
}
