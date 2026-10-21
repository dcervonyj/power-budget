import { beforeEach, describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { BankAccountId, HouseholdId, UserId } from '@power-budget/core';
import type { Transaction } from '../../../../domain/transactions/entities.js';
import type { TransactionRepository } from '../../../../domain/transactions/ports.js';
import {
  BankAccountNotFoundError,
  TransactionCurrencyMismatchError,
} from '../../../../domain/transactions/errors.js';
import { AddManualTransactionUseCase } from '../AddManualTransactionUseCase.js';

const HOUSEHOLD = HouseholdId.of('01890a5d-ac96-774b-bcce-b302099a8057');
const USER = UserId.of('01890a5d-ac96-774b-bcce-b302099a8058');
const ACCOUNT = BankAccountId.of('01890a5d-ac96-774b-bcce-b302099a8059');
const NEW_ID = '01890a5d-ac96-774b-bcce-b302099a8060';

const input = {
  householdId: HOUSEHOLD,
  userId: USER,
  accountId: ACCOUNT,
  occurredOn: '2026-10-21',
  amountMinor: -1250n,
  currency: 'PLN' as const,
  description: 'Bakery',
  merchant: null,
  notes: 'cash',
};

describe('AddManualTransactionUseCase', () => {
  let repo: ReturnType<typeof mock<TransactionRepository>>;
  let useCase: AddManualTransactionUseCase;

  beforeEach(() => {
    repo = mock<TransactionRepository>();
    useCase = new AddManualTransactionUseCase(repo, () => NEW_ID);
  });

  it("looks the account up among the caller's own accounts in the household", async () => {
    repo.findOwnedAccount.mockResolvedValue({ id: ACCOUNT, currency: 'PLN' });
    const created = { id: NEW_ID } as unknown as Transaction;
    repo.insertManual.mockResolvedValue(created);

    await expect(useCase.execute(input)).resolves.toBe(created);

    expect(repo.findOwnedAccount).toHaveBeenCalledWith(ACCOUNT, USER, { householdId: HOUSEHOLD });
    expect(repo.insertManual).toHaveBeenCalledWith({
      id: NEW_ID,
      householdId: HOUSEHOLD,
      accountId: ACCOUNT,
      occurredOn: '2026-10-21',
      amount: { amountMinor: -1250n, currency: 'PLN' },
      description: 'Bakery',
      merchant: null,
      notes: 'cash',
    });
  });

  it('rejects an account that is not the caller’s own (other household or partner)', async () => {
    repo.findOwnedAccount.mockResolvedValue(null);

    await expect(useCase.execute(input)).rejects.toBeInstanceOf(BankAccountNotFoundError);
    expect(repo.insertManual).not.toHaveBeenCalled();
  });

  it('rejects an amount in another currency than the account', async () => {
    repo.findOwnedAccount.mockResolvedValue({ id: ACCOUNT, currency: 'EUR' });

    await expect(useCase.execute(input)).rejects.toBeInstanceOf(TransactionCurrencyMismatchError);
    expect(repo.insertManual).not.toHaveBeenCalled();
  });
});
