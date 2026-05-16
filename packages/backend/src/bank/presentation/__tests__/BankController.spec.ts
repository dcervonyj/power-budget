import { describe, it, expect, beforeEach } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { HouseholdId, UserId, BankConnectionId } from '@power-budget/core';
import { BankController } from '../BankController.js';
import { InitiateBankConnectionUseCase } from '../../application/use-cases/InitiateBankConnectionUseCase.js';
import { CompleteBankConsentUseCase } from '../../application/use-cases/CompleteBankConsentUseCase.js';
import { ListUserConnectionsUseCase } from '../../application/use-cases/ListUserConnectionsUseCase.js';
import { RefreshConnectionUseCase } from '../../application/use-cases/RefreshConnectionUseCase.js';
import { DisconnectBankUseCase } from '../../application/use-cases/DisconnectBankUseCase.js';
import { ReconnectBankUseCase } from '../../application/use-cases/ReconnectBankUseCase.js';
import { GetBankCatalogUseCase } from '../../application/use-cases/GetBankCatalogUseCase.js';
import { DrizzleBankAccountRepository } from '../../infrastructure/DrizzleBankAccountRepository.js';
import {
  BankConnectionNotFoundError,
  BankConnectionForbiddenError,
  BankConsentNotFoundError,
  BankConnectionAlreadyActiveError,
  BankConnectionInvalidStateError,
} from '../../domain/errors.js';
import type { AuthenticatedUser } from '../../../auth/presentation/decorators/CurrentUser.js';

const TEST_HOUSEHOLD_ID = '01900000-0000-7000-8000-000000000001' as HouseholdId;
const TEST_USER_ID = '01900000-0000-7000-8000-000000000002' as UserId;
const TEST_CONNECTION_ID = '01900000-0000-7000-8000-000000000003' as BankConnectionId;

function makeUser(householdId: HouseholdId | null = TEST_HOUSEHOLD_ID): AuthenticatedUser {
  return { userId: TEST_USER_ID, householdId };
}

describe('BankController', () => {
  let controller: BankController;
  let initiate: ReturnType<typeof mock<InitiateBankConnectionUseCase>>;
  let completeConsent: ReturnType<typeof mock<CompleteBankConsentUseCase>>;
  let listConnections: ReturnType<typeof mock<ListUserConnectionsUseCase>>;
  let refresh: ReturnType<typeof mock<RefreshConnectionUseCase>>;
  let disconnect: ReturnType<typeof mock<DisconnectBankUseCase>>;
  let reconnect: ReturnType<typeof mock<ReconnectBankUseCase>>;
  let getCatalog: ReturnType<typeof mock<GetBankCatalogUseCase>>;
  let bankAccountRepo: ReturnType<typeof mock<DrizzleBankAccountRepository>>;

  beforeEach(() => {
    initiate = mock<InitiateBankConnectionUseCase>();
    completeConsent = mock<CompleteBankConsentUseCase>();
    listConnections = mock<ListUserConnectionsUseCase>();
    refresh = mock<RefreshConnectionUseCase>();
    disconnect = mock<DisconnectBankUseCase>();
    reconnect = mock<ReconnectBankUseCase>();
    getCatalog = mock<GetBankCatalogUseCase>();
    bankAccountRepo = mock<DrizzleBankAccountRepository>();

    controller = new BankController(
      initiate,
      completeConsent,
      listConnections,
      refresh,
      disconnect,
      reconnect,
      getCatalog,
      bankAccountRepo,
    );
  });

  describe('GET /bank-connections/catalogue', () => {
    it('calls GetBankCatalogUseCase with country', async () => {
      const banks = [
        { bankId: 'PKO_PLPKOPPLPW', name: 'PKO BP', countryCode: 'PL', logoUrl: null },
      ];
      getCatalog.execute.mockResolvedValue(banks as never);

      const result = await controller.catalogue({ country: 'PL' } as never);

      expect(getCatalog.execute).toHaveBeenCalledWith({ country: 'PL' });
      expect(result).toEqual(banks);
    });

    it('defaults country to PL when not provided', async () => {
      getCatalog.execute.mockResolvedValue([]);
      await controller.catalogue({} as never);
      expect(getCatalog.execute).toHaveBeenCalledWith({ country: 'PL' });
    });
  });

  describe('POST /bank-connections (initiate)', () => {
    it('calls InitiateBankConnectionUseCase and returns consent url', async () => {
      initiate.execute.mockResolvedValue({ consentUrl: 'https://bank.test/consent' } as never);

      const result = await controller.initiateBankConnection(
        {
          provider: 'gocardless',
          bankId: 'PKO_PLPKOPPLPW',
          redirectUri: 'https://app.test',
        } as never,
        makeUser(),
      );

      expect(initiate.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: TEST_USER_ID,
          householdId: TEST_HOUSEHOLD_ID,
          provider: 'gocardless',
        }),
      );
      expect(result).toEqual({ consentUrl: 'https://bank.test/consent' });
    });

    it('throws ForbiddenException when user has no household', async () => {
      await expect(
        controller.initiateBankConnection({ provider: 'gocardless' } as never, makeUser(null)),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws ForbiddenException when connection already active', async () => {
      initiate.execute.mockRejectedValue(new BankConnectionAlreadyActiveError());
      await expect(
        controller.initiateBankConnection({ provider: 'gocardless' } as never, makeUser()),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('GET /bank-connections (list)', () => {
    it('calls ListUserConnectionsUseCase with userId', async () => {
      const connections = [{ id: TEST_CONNECTION_ID }];
      listConnections.execute.mockResolvedValue(connections as never);

      const result = await controller.listBankConnections(makeUser());

      expect(listConnections.execute).toHaveBeenCalledWith({ userId: TEST_USER_ID });
      expect(result).toEqual(connections);
    });
  });

  describe('POST /bank-connections/:id/refresh', () => {
    it('calls RefreshConnectionUseCase with connectionId and householdId', async () => {
      refresh.execute.mockResolvedValue(undefined);

      await controller.refreshConnection(TEST_CONNECTION_ID, makeUser());

      expect(refresh.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionId: TEST_CONNECTION_ID,
          householdId: TEST_HOUSEHOLD_ID,
        }),
      );
    });

    it('throws NotFoundException when connection not found', async () => {
      refresh.execute.mockRejectedValue(new BankConnectionNotFoundError());
      await expect(
        controller.refreshConnection(TEST_CONNECTION_ID, makeUser()),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws ForbiddenException when not your connection', async () => {
      refresh.execute.mockRejectedValue(new BankConnectionForbiddenError());
      await expect(
        controller.refreshConnection(TEST_CONNECTION_ID, makeUser()),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('DELETE /bank-connections/:id', () => {
    it('calls DisconnectBankUseCase with connectionId and householdId', async () => {
      disconnect.execute.mockResolvedValue(undefined);

      await controller.disconnectBank(TEST_CONNECTION_ID, makeUser());

      expect(disconnect.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionId: TEST_CONNECTION_ID,
          householdId: TEST_HOUSEHOLD_ID,
        }),
      );
    });

    it('throws NotFoundException when connection not found', async () => {
      disconnect.execute.mockRejectedValue(new BankConnectionNotFoundError());
      await expect(
        controller.disconnectBank(TEST_CONNECTION_ID, makeUser()),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('POST /bank-connections/:id/reconnect', () => {
    it('calls ReconnectBankUseCase and returns consent url', async () => {
      reconnect.execute.mockResolvedValue({ consentUrl: 'https://bank.test/reconnect' } as never);

      const result = await controller.reconnectBank(TEST_CONNECTION_ID, {}, makeUser());

      expect(reconnect.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionId: TEST_CONNECTION_ID,
          householdId: TEST_HOUSEHOLD_ID,
        }),
      );
      expect(result).toEqual({ consentUrl: 'https://bank.test/reconnect' });
    });

    it('throws ForbiddenException for invalid state', async () => {
      reconnect.execute.mockRejectedValue(new BankConnectionInvalidStateError('bad state'));
      await expect(
        controller.reconnectBank(TEST_CONNECTION_ID, {}, makeUser()),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('GET /bank-connections/:id/complete', () => {
    it('calls CompleteBankConsentUseCase and returns result', async () => {
      completeConsent.execute.mockResolvedValue({ status: 'active' } as never);

      const result = await controller.completeBankConsent(
        TEST_CONNECTION_ID,
        'auth-code',
        'state-ref',
      );

      expect(completeConsent.execute).toHaveBeenCalledWith(
        expect.objectContaining({ callbackPayload: { code: 'auth-code', state: 'state-ref' } }),
      );
      expect(result).toEqual({ status: 'active' });
    });

    it('throws NotFoundException when consent not found', async () => {
      completeConsent.execute.mockRejectedValue(new BankConsentNotFoundError());
      await expect(
        controller.completeBankConsent(TEST_CONNECTION_ID, 'code', 'state'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
