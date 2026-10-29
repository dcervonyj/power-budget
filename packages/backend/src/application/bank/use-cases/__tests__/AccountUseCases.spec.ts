import { describe, expect, it } from 'vitest';
import { createMock } from '@golevelup/ts-vitest';
import { BankAccountId, HouseholdId, UserId } from '@power-budget/core';
import type { Account, ManualAccount } from '../../../../domain/bank/entities.js';
import type { AccountRepository } from '../../../../domain/bank/ports.js';
import { CreateManualAccountUseCase } from '../CreateManualAccountUseCase.js';
import { ListAccountsUseCase } from '../ListAccountsUseCase.js';

const HOUSEHOLD = HouseholdId.of('01890a5d-ac96-774b-bcce-b302099a8057');
const USER = UserId.of('01890a5d-ac96-774b-bcce-b302099a8058');
const ACCOUNT_ID = '01890a5d-ac96-774b-bcce-b302099a8059';

const cash: ManualAccount = {
  id: BankAccountId.of(ACCOUNT_ID),
  householdId: HOUSEHOLD,
  ownerUserId: USER,
  kind: 'manual',
  name: 'Cash',
  currency: 'PLN',
  createdAt: new Date('2026-10-21T10:00:00.000Z'),
};

describe('ListAccountsUseCase', () => {
  it("lists only the caller's own accounts in the household", async () => {
    const repo = createMock<AccountRepository>();
    const accounts: Account[] = [cash];
    repo.listOwned.mockResolvedValue(accounts);

    await expect(
      new ListAccountsUseCase(repo).execute({ userId: USER, householdId: HOUSEHOLD }),
    ).resolves.toBe(accounts);

    expect(repo.listOwned).toHaveBeenCalledWith(USER, { householdId: HOUSEHOLD });
  });
});

describe('CreateManualAccountUseCase', () => {
  it('creates a manual account owned by the caller, with a trimmed name', async () => {
    const repo = createMock<AccountRepository>();
    repo.createManual.mockResolvedValue(cash);

    await expect(
      new CreateManualAccountUseCase(repo, { next: () => ACCOUNT_ID }).execute({
        userId: USER,
        householdId: HOUSEHOLD,
        name: '  Cash ',
        currency: 'PLN',
      }),
    ).resolves.toBe(cash);

    expect(repo.createManual).toHaveBeenCalledWith(
      {
        id: ACCOUNT_ID,
        householdId: HOUSEHOLD,
        ownerUserId: USER,
        name: 'Cash',
        currency: 'PLN',
      },
      { householdId: HOUSEHOLD },
    );
  });
});
