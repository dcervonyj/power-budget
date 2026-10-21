import { describe, expect, it } from 'vitest';
import { BankAccountId, BankConnectionId, HouseholdId, UserId } from '@power-budget/core';
import { toAccountDto } from '../dto/accounts.dto.js';

const base = {
  id: BankAccountId.of('01890a5d-ac96-774b-bcce-b302099a8059'),
  householdId: HouseholdId.of('01890a5d-ac96-774b-bcce-b302099a8057'),
  ownerUserId: UserId.of('01890a5d-ac96-774b-bcce-b302099a8058'),
  currency: 'PLN' as const,
  createdAt: new Date('2026-10-21T10:00:00.000Z'),
};

describe('toAccountDto', () => {
  it('maps a bank account with its connection and balance as a string', () => {
    expect(
      toAccountDto({
        ...base,
        kind: 'bank',
        name: 'PKO',
        connectionId: BankConnectionId.of('01890a5d-ac96-774b-bcce-b302099a8061'),
        balance: { amountMinor: 9007199254740993n, currency: 'PLN' },
        lastSyncedAt: new Date('2026-10-20T08:00:00.000Z'),
      }),
    ).toEqual({
      id: base.id,
      kind: 'bank',
      name: 'PKO',
      currency: 'PLN',
      connectionId: '01890a5d-ac96-774b-bcce-b302099a8061',
      balance: { amountMinor: '9007199254740993', currency: 'PLN' },
      lastSyncedAt: '2026-10-20T08:00:00.000Z',
      createdAt: '2026-10-21T10:00:00.000Z',
    });
  });

  it('maps a manual account without connection, balance or sync time', () => {
    expect(toAccountDto({ ...base, kind: 'manual', name: 'Cash' })).toEqual({
      id: base.id,
      kind: 'manual',
      name: 'Cash',
      currency: 'PLN',
      connectionId: null,
      balance: null,
      lastSyncedAt: null,
      createdAt: '2026-10-21T10:00:00.000Z',
    });
  });
});
