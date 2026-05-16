import { uuidv7 } from 'uuidv7';
import type { UserId, HouseholdId, BankConnectionId } from '@power-budget/core';
import type { BankProvider, BankId } from '../../domain/entities.js';
import type { BankConnectionRepository, BankConnectorRegistry } from '../../domain/ports.js';
import type { TotpSecretRepository } from '../../../auth/domain/ports.js';
import { BankConnectionAlreadyActiveError } from '../../domain/errors.js';
import { TotpEnrollmentRequiredError } from '../../../auth/domain/errors.js';

export interface InitiateBankConnectionInput {
  readonly userId: UserId;
  readonly householdId: HouseholdId;
  readonly provider: BankProvider;
  readonly bankId: BankId;
  readonly redirectUri: string;
}

export interface InitiateBankConnectionOutput {
  readonly consentUrl: string;
  readonly connectionId: BankConnectionId;
}

export class InitiateBankConnectionUseCase {
  constructor(
    private readonly connectionRepo: BankConnectionRepository,
    private readonly registry: BankConnectorRegistry,
    private readonly totpSecretRepo: TotpSecretRepository,
  ) {}

  async execute(input: InitiateBankConnectionInput): Promise<InitiateBankConnectionOutput> {
    const totpSecret = await this.totpSecretRepo.findByUser(input.userId);
    if (!totpSecret?.verifiedAt) {
      throw new TotpEnrollmentRequiredError();
    }

    const existing = await this.connectionRepo.findActiveByUserAndBank(
      input.userId,
      input.bankId,
      input.provider,
    );
    if (existing !== null) {
      throw new BankConnectionAlreadyActiveError();
    }

    const connector = this.registry.resolve(input.provider);
    const { consentUrl, externalConsentRef } = await connector.initiateConsent({
      userId: input.userId,
      bankId: input.bankId,
      redirectUri: input.redirectUri,
      historyDays: 90,
    });

    const connectionId = uuidv7() as BankConnectionId;
    await this.connectionRepo.create({
      id: connectionId,
      householdId: input.householdId,
      userId: input.userId,
      provider: input.provider,
      bankId: input.bankId,
      externalConsentRef,
    });

    return { consentUrl, connectionId };
  }
}
