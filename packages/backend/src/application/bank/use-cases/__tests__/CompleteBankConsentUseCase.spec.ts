import { describe, it, expect, beforeEach } from 'vitest';
import { createMock } from '@golevelup/ts-vitest';
import { UserId, HouseholdId, BankConnectionId, EncryptedString } from '@power-budget/core';
import type {
  BankConnectionRepository,
  BankConnector,
  BankConnectorRegistry,
  HouseholdScope,
} from '../../../../domain/bank/ports.js';
import type { BankConnection } from '../../../../domain/bank/entities.js';
import { CompleteBankConsentUseCase } from '../CompleteBankConsentUseCase.js';
import {
  BankConsentNotFoundError,
  BankConnectionInvalidStateError,
} from '../../../../domain/bank/errors.js';
// eslint-disable-next-line no-restricted-imports -- CLN-061 allow-list (temporary, see eslint.layers.js)
import { BankController } from '../../../../presentation/bank/BankController.js';

const ALICE = UserId.of('01900000-0000-7000-8000-00000000000a');
const ALICE_PARTNER = UserId.of('01900000-0000-7000-8000-00000000000c');
const MALLORY = UserId.of('01900000-0000-7000-8000-00000000000b');
const ALICE_HOUSEHOLD = HouseholdId.of('01900000-0000-7000-8000-0000000000a1');
const MALLORY_HOUSEHOLD = HouseholdId.of('01900000-0000-7000-8000-0000000000b1');
const ALICE_CONN = BankConnectionId.of('01900000-0000-7000-8000-0000000000a2');
const MALLORY_CONN = BankConnectionId.of('01900000-0000-7000-8000-0000000000b2');
const MALLORY_RETRY_CONN = BankConnectionId.of('01900000-0000-7000-8000-0000000000b3');
const MALLORY_TOKEN = EncryptedString.of('enc:mallory-wise-token');

function makeConnection(overrides: Partial<BankConnection>): BankConnection {
  return {
    id: ALICE_CONN,
    householdId: ALICE_HOUSEHOLD,
    userId: ALICE,
    provider: 'wise_personal',
    bankId: 'wise',
    externalConsentRef: 'wise-alice-ref',
    encryptedConsent: null,
    expiresAt: null,
    status: 'pending',
    disconnectedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('CompleteBankConsentUseCase', () => {
  let connections: BankConnection[];
  let connectionRepo: ReturnType<typeof createMock<BankConnectionRepository>>;
  let connector: ReturnType<typeof createMock<BankConnector>>;
  let useCase: CompleteBankConsentUseCase;

  function findScoped(id: BankConnectionId, scope: HouseholdScope): Promise<BankConnection | null> {
    const found = connections.find((c) => c.id === id && c.householdId === scope.householdId);

    return Promise.resolve(found ?? null);
  }

  beforeEach(() => {
    // Alice's connection is listed first, as the old unscoped `limit 1` lookup would hit it.
    connections = [
      makeConnection({}),
      makeConnection({
        id: MALLORY_CONN,
        householdId: MALLORY_HOUSEHOLD,
        userId: MALLORY,
        externalConsentRef: 'wise-mallory-ref',
      }),
    ];
    connectionRepo = createMock<BankConnectionRepository>();
    connectionRepo.findById.mockImplementation(findScoped);
    connectionRepo.findActiveByUserAndBank.mockResolvedValue(null);
    connector = createMock<BankConnector>();
    connector.completeConsent.mockResolvedValue({ consentToken: MALLORY_TOKEN, expiresAt: null });
    const registry = createMock<BankConnectorRegistry>();
    registry.resolve.mockReturnValue(connector);
    useCase = new CompleteBankConsentUseCase(connectionRepo, registry);
  });

  it("writes the consent token only onto the caller's own connection", async () => {
    const result = await useCase.execute({
      connectionId: MALLORY_CONN,
      userId: MALLORY,
      householdId: MALLORY_HOUSEHOLD,
      callbackPayload: { apiToken: 'mallory-token' },
    });

    expect(result).toEqual({ connectionId: MALLORY_CONN });
    expect(connector.completeConsent).toHaveBeenCalledWith({
      externalConsentRef: 'wise-mallory-ref',
      callbackPayload: { apiToken: 'mallory-token' },
    });
    expect(connectionRepo.updateConsent).toHaveBeenCalledWith(MALLORY_CONN, MALLORY_TOKEN, null, {
      householdId: MALLORY_HOUSEHOLD,
    });
    expect(connectionRepo.updateConsent).toHaveBeenCalledTimes(1);
    expect(connectionRepo.markActive).toHaveBeenCalledWith(MALLORY_CONN, {
      householdId: MALLORY_HOUSEHOLD,
    });
  });

  // CLN-038: an abandoned attempt completed late must not open a second connection to the bank.
  it('refuses a pending connection when another one to the same bank is already active', async () => {
    connectionRepo.findActiveByUserAndBank.mockResolvedValue(
      makeConnection({
        id: MALLORY_RETRY_CONN,
        householdId: MALLORY_HOUSEHOLD,
        userId: MALLORY,
        status: 'active',
      }),
    );

    await expect(
      useCase.execute({
        connectionId: MALLORY_CONN,
        userId: MALLORY,
        householdId: MALLORY_HOUSEHOLD,
        callbackPayload: { apiToken: 'mallory-token' },
      }),
    ).rejects.toThrow(BankConnectionInvalidStateError);
    expect(connectionRepo.findActiveByUserAndBank).toHaveBeenCalledWith(
      MALLORY,
      'wise',
      'wise_personal',
    );
    expect(connector.completeConsent).not.toHaveBeenCalled();
    expect(connectionRepo.markActive).not.toHaveBeenCalled();
  });

  it('completes again when the active connection to the bank is this one', async () => {
    connectionRepo.findActiveByUserAndBank.mockResolvedValue(
      makeConnection({
        id: MALLORY_CONN,
        householdId: MALLORY_HOUSEHOLD,
        userId: MALLORY,
        status: 'active',
      }),
    );

    const result = await useCase.execute({
      connectionId: MALLORY_CONN,
      userId: MALLORY,
      householdId: MALLORY_HOUSEHOLD,
      callbackPayload: { apiToken: 'mallory-token' },
    });

    expect(result).toEqual({ connectionId: MALLORY_CONN });
    expect(connectionRepo.markActive).toHaveBeenCalledWith(MALLORY_CONN, {
      householdId: MALLORY_HOUSEHOLD,
    });
  });

  it("refuses to complete another household's connection", async () => {
    await expect(
      useCase.execute({
        connectionId: ALICE_CONN,
        userId: MALLORY,
        householdId: MALLORY_HOUSEHOLD,
        callbackPayload: { apiToken: 'mallory-token' },
      }),
    ).rejects.toThrow(BankConsentNotFoundError);
    expect(connector.completeConsent).not.toHaveBeenCalled();
    expect(connectionRepo.updateConsent).not.toHaveBeenCalled();
    expect(connectionRepo.markActive).not.toHaveBeenCalled();
  });

  it("refuses to complete the partner's connection in the same household", async () => {
    await expect(
      useCase.execute({
        connectionId: ALICE_CONN,
        userId: ALICE_PARTNER,
        householdId: ALICE_HOUSEHOLD,
        callbackPayload: { apiToken: 'partner-token' },
      }),
    ).rejects.toThrow(BankConsentNotFoundError);
    expect(connectionRepo.updateConsent).not.toHaveBeenCalled();
  });
});

describe('BankController.completeBankConsent', () => {
  it('scopes completion to the path connection id and the authenticated caller', async () => {
    const complete = createMock<CompleteBankConsentUseCase>();
    complete.execute.mockResolvedValue({ connectionId: MALLORY_CONN });
    const controller = new BankController(
      createMock(),
      complete,
      createMock(),
      createMock(),
      createMock(),
      createMock(),
      createMock(),
      createMock(),
    );

    await controller.completeBankConsent(MALLORY_CONN, 'code-1', 'wise-alice-ref', {
      userId: MALLORY,
      householdId: MALLORY_HOUSEHOLD,
    });

    expect(complete.execute).toHaveBeenCalledWith({
      connectionId: MALLORY_CONN,
      userId: MALLORY,
      householdId: MALLORY_HOUSEHOLD,
      callbackPayload: { code: 'code-1', state: 'wise-alice-ref' },
    });
  });
});
