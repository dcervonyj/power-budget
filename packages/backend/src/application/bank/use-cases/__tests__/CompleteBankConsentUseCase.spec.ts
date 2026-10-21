import { describe, it, expect, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { UserId, HouseholdId, BankConnectionId, EncryptedString } from '@power-budget/core';
import type {
  BankConnectionRepository,
  BankConnector,
  BankConnectorRegistry,
  HouseholdScope,
} from '../../../../domain/bank/ports.js';
import type { BankConnection } from '../../../../domain/bank/entities.js';
import { CompleteBankConsentUseCase } from '../CompleteBankConsentUseCase.js';
import { BankConsentNotFoundError } from '../../../../domain/bank/errors.js';
import { BankController } from '../../../../presentation/bank/BankController.js';

const ALICE = '01900000-0000-7000-8000-00000000000a' as UserId;
const ALICE_PARTNER = '01900000-0000-7000-8000-00000000000c' as UserId;
const MALLORY = '01900000-0000-7000-8000-00000000000b' as UserId;
const ALICE_HOUSEHOLD = '01900000-0000-7000-8000-0000000000a1' as HouseholdId;
const MALLORY_HOUSEHOLD = '01900000-0000-7000-8000-0000000000b1' as HouseholdId;
const ALICE_CONN = '01900000-0000-7000-8000-0000000000a2' as BankConnectionId;
const MALLORY_CONN = '01900000-0000-7000-8000-0000000000b2' as BankConnectionId;
const MALLORY_TOKEN = 'enc:mallory-wise-token' as EncryptedString;

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
    status: 'active',
    disconnectedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('CompleteBankConsentUseCase', () => {
  let connections: BankConnection[];
  let connectionRepo: ReturnType<typeof mock<BankConnectionRepository>>;
  let connector: ReturnType<typeof mock<BankConnector>>;
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
    connectionRepo = mock<BankConnectionRepository>();
    connectionRepo.findById.mockImplementation(findScoped);
    connector = mock<BankConnector>();
    connector.completeConsent.mockResolvedValue({ consentToken: MALLORY_TOKEN, expiresAt: null });
    const registry = mock<BankConnectorRegistry>();
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
    expect(connectionRepo.updateConsent).not.toHaveBeenCalledWith(
      ALICE_CONN,
      MALLORY_TOKEN,
      null,
      expect.anything(),
    );
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
    const complete = mock<CompleteBankConsentUseCase>();
    complete.execute.mockResolvedValue({ connectionId: MALLORY_CONN });
    const controller = new BankController(
      mock(),
      complete,
      mock(),
      mock(),
      mock(),
      mock(),
      mock(),
      mock(),
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
