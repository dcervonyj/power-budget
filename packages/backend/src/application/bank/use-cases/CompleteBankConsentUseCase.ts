import type { BankConnectionId } from '@power-budget/core';
import type {
  BankConnectionRepository,
  BankConnectorRegistry,
} from '../../../domain/bank/ports.js';
import { BankConsentNotFoundError } from '../../../domain/bank/errors.js';

export interface CompleteBankConsentInput {
  readonly externalConsentRef: string;
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
    const connection = await this.connectionRepo.findByExternalConsentRef(input.externalConsentRef);
    if (connection === null) {
      throw new BankConsentNotFoundError();
    }

    const connector = this.registry.resolve(connection.provider);
    const { consentToken, expiresAt } = await connector.completeConsent({
      externalConsentRef: input.externalConsentRef,
      callbackPayload: input.callbackPayload,
    });

    await this.connectionRepo.updateConsent(connection.id, consentToken, expiresAt);
    await this.connectionRepo.markActive(connection.id);

    return { connectionId: connection.id };
  }
}
