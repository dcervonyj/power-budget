import { describe, it, expect } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { BankAccountId, BankConnectionId, HouseholdId } from '@power-budget/core';
import type { BankAccountRepository } from '../../../../domain/bank/ports.js';
import type { BankAccount } from '../../../../domain/bank/entities.js';
import { ListConnectionAccountsUseCase } from '../ListConnectionAccountsUseCase.js';

const HOUSEHOLD = HouseholdId.of('01900000-0000-7000-8000-0000000000a1');
const CONNECTION = BankConnectionId.of('01900000-0000-7000-8000-0000000000a2');
const ACCOUNT = BankAccountId.of('01900000-0000-7000-8000-0000000000a3');

describe('ListConnectionAccountsUseCase', () => {
  it("lists the connection's accounts inside the caller's household", async () => {
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
    const repo = mock<BankAccountRepository>();
    repo.listByConnection.mockResolvedValue([account]);

    const result = await new ListConnectionAccountsUseCase(repo).execute({
      connectionId: CONNECTION,
      householdId: HOUSEHOLD,
    });

    expect(result).toEqual([account]);
    expect(repo.listByConnection).toHaveBeenCalledWith(CONNECTION, { householdId: HOUSEHOLD });
  });
});
