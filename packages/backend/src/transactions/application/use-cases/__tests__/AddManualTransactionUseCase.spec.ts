import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import type { HouseholdId, BankAccountId, TransactionId } from '@power-budget/core';
import type { TransactionRepository } from '../../../domain/ports.js';
import type { Transaction } from '../../../domain/entities.js';
import { AddManualTransactionUseCase } from '../AddManualTransactionUseCase.js';

const HOUSEHOLD_ID = '01900000-0000-7000-8000-000000000001' as HouseholdId;
const ACCOUNT_ID = '01900000-0000-7000-8000-000000000002' as BankAccountId;
const NEW_TX_ID = '01900000-0000-7000-8000-000000000010' as TransactionId;

function makeFakeTransaction(overrides?: Partial<Transaction>): Transaction {
  return {
    id: NEW_TX_ID,
    householdId: HOUSEHOLD_ID,
    accountId: ACCOUNT_ID,
    occurredOn: '2025-01-15' as any,
    amount: { amountMinor: 5000n, currency: 'PLN' as any },
    description: 'Test purchase',
    merchant: null,
    notes: null,
    ignored: false,
    externalId: null,
    suggestedPlannedItemId: null,
    createdAt: new Date().toISOString() as any,
    ...overrides,
  } as unknown as Transaction;
}

describe('AddManualTransactionUseCase', () => {
  let transactionRepo: ReturnType<typeof mock<TransactionRepository>>;
  let generateId: ReturnType<typeof vi.fn>;
  let useCase: AddManualTransactionUseCase;

  beforeEach(() => {
    transactionRepo = mock<TransactionRepository>();
    generateId = vi.fn().mockReturnValue(NEW_TX_ID);
    useCase = new AddManualTransactionUseCase(transactionRepo, generateId);
  });

  it('creates a manual transaction and returns it', async () => {
    const fakeTx = makeFakeTransaction();
    transactionRepo.insertManual.mockResolvedValue(fakeTx);

    const result = await useCase.execute({
      householdId: HOUSEHOLD_ID,
      accountId: ACCOUNT_ID,
      occurredOn: '2025-01-15',
      amountMinor: 5000n,
      currency: 'PLN',
      description: 'Test purchase',
      merchant: null,
      notes: null,
    });

    expect(result).toBe(fakeTx);
    expect(transactionRepo.insertManual).toHaveBeenCalledOnce();
  });

  it('calls generateId to create a new transaction ID', async () => {
    transactionRepo.insertManual.mockResolvedValue(makeFakeTransaction());

    await useCase.execute({
      householdId: HOUSEHOLD_ID,
      accountId: ACCOUNT_ID,
      occurredOn: '2025-01-15',
      amountMinor: 5000n,
      currency: 'PLN',
      description: 'Test',
      merchant: null,
      notes: null,
    });

    expect(generateId).toHaveBeenCalledOnce();
  });

  it('passes all input fields to the repository', async () => {
    transactionRepo.insertManual.mockResolvedValue(makeFakeTransaction());

    await useCase.execute({
      householdId: HOUSEHOLD_ID,
      accountId: ACCOUNT_ID,
      occurredOn: '2025-01-15',
      amountMinor: 5000n,
      currency: 'EUR',
      description: 'Coffee',
      merchant: 'Starbucks',
      notes: 'Client meeting',
    });

    const [arg] = transactionRepo.insertManual.mock.calls[0]!;
    expect(arg.householdId).toBe(HOUSEHOLD_ID);
    expect(arg.accountId).toBe(ACCOUNT_ID);
    expect(arg.amount).toEqual({ amountMinor: 5000n, currency: 'EUR' });
    expect(arg.description).toBe('Coffee');
    expect(arg.merchant).toBe('Starbucks');
    expect(arg.notes).toBe('Client meeting');
  });
});
