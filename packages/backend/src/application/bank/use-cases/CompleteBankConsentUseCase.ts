import type { BankConnectionId, HouseholdId, UserId } from '@power-budget/core';
import type {
  BankConnectionRepository,
  BankConnectorRegistry,
} from '../../../domain/bank/ports.js';
import { BankConsentNotFoundError } from '../../../domain/bank/errors.js';

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
    const connection = await this.connectionRepo.findById(input.connectionId, {
      householdId: input.householdId,
    });
    if (
      connection === null ||
      connection.userId !== input.userId ||
      connection.externalConsentRef === null
    ) {
      throw new BankConsentNotFoundError();
    }

    const connector = this.registry.resolve(connection.provider);
    const { consentToken, expiresAt } = await connector.completeConsent({
      externalConsentRef: connection.externalConsentRef,
      callbackPayload: input.callbackPayload,
    });

    await this.connectionRepo.updateConsent(connection.id, consentToken, expiresAt);
    await this.connectionRepo.markActive(connection.id);

    return { connectionId: connection.id };
  }
}
