import { describe, it, expect } from 'vitest';
import { createMock } from '@golevelup/ts-vitest';
import { BankAccountId, BankConnectionId, HouseholdId, UserId } from '@power-budget/core';
import type {
  BankAccountRepository,
  BankConnectionRepository,
} from '../../../../domain/bank/ports.js';
import type { BankAccount, BankConnection } from '../../../../domain/bank/entities.js';
import { BankConnectionNotFoundError } from '../../../../domain/bank/errors.js';
import { ListConnectionAccountsUseCase } from '../ListConnectionAccountsUseCase.js';
import { makeBankConnection } from '../../../../test/doubles/transactions.js';

const HOUSEHOLD = HouseholdId.of('01900000-0000-7000-8000-0000000000a1');
const CONNECTION = BankConnectionId.of('01900000-0000-7000-8000-0000000000a2');
const ACCOUNT = BankAccountId.of('01900000-0000-7000-8000-0000000000a3');
const OWNER = UserId.of('01900000-0000-7000-8000-0000000000a4');
const PARTNER = UserId.of('01900000-0000-7000-8000-0000000000a5');

const account: BankAccount = {
  id: ACCOUNT,
  householdId: HOUSEHOLD,
  connectionId: CONNECTION,
  externalId: 'ext-1',
  name: 'Main',
  iban: null,
  currency: 'PLN',
  balanceMinor: 150000n,
  lastSyncedAt: null,
  createdAt: new Date('2026-10-21T10:00:00.000Z'),
};

function setup(connection: BankConnection | null) {
  const connectionRepo = createMock<BankConnectionRepository>();
  const accountRepo = createMock<BankAccountRepository>();
  connectionRepo.findById.mockResolvedValue(connection);
  accountRepo.listByConnection.mockResolvedValue([account]);

  return {
    connectionRepo,
    accountRepo,
    useCase: new ListConnectionAccountsUseCase(connectionRepo, accountRepo),
  };
}

const ownConnection = makeBankConnection({ id: CONNECTION, householdId: HOUSEHOLD, userId: OWNER });

describe('ListConnectionAccountsUseCase', () => {
  it("lists the accounts of the caller's own connection", async () => {
    const { connectionRepo, accountRepo, useCase } = setup(ownConnection);

    const result = await useCase.execute({
      connectionId: CONNECTION,
      householdId: HOUSEHOLD,
      userId: OWNER,
    });

    expect(result).toEqual([account]);
    expect(connectionRepo.findById).toHaveBeenCalledWith(CONNECTION, { householdId: HOUSEHOLD });
    expect(accountRepo.listByConnection).toHaveBeenCalledWith(CONNECTION, {
      householdId: HOUSEHOLD,
    });
  });

  it.each([
    ["the partner's connection", ownConnection, PARTNER],
    ['an unknown connection', null, OWNER],
  ])('throws BankConnectionNotFoundError for %s', async (_name, connection, userId) => {
    const { accountRepo, useCase } = setup(connection);

    await expect(
      useCase.execute({ connectionId: CONNECTION, householdId: HOUSEHOLD, userId }),
    ).rejects.toBeInstanceOf(BankConnectionNotFoundError);
    expect(accountRepo.listByConnection).not.toHaveBeenCalled();
  });
});
