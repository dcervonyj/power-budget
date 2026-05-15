import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { IngestBankTransactionsUseCase } from '../IngestBankTransactionsUseCase.js';
import type {
  TransactionRepository,
  MappingRepository,
  MappingSuggestionPort,
} from '../../../../domain/transactions/ports.js';
import type { Transaction } from '../../../../domain/transactions/entities.js';
import type { TransactionId, PlannedItemId, HouseholdId, BankAccountId } from '@power-budget/core';

const VALID_UUID = '01900000-0000-7000-8000-000000000001';
const makeId = () => VALID_UUID;

const txId = '01900000-0000-7000-8000-000000000001' as unknown as TransactionId;
const householdId = 'hh-1' as unknown as HouseholdId;
const accountId = 'acc-1' as unknown as BankAccountId;
const plannedItemId = 'pi-1' as unknown as PlannedItemId;

const rawTx = {
  externalId: 'ext-1',
  occurredOn: '2024-01-15',
  amountMinor: 1000n,
  currency: 'PLN',
  description: 'Coffee shop',
  merchant: 'Starbucks',
};

const fakeTx = {
  id: txId,
  householdId,
  accountId,
  externalId: 'ext-1',
  occurredOn: '2024-01-15',
  amount: { amountMinor: 1000n, currency: 'PLN' },
  description: 'Coffee shop',
  merchant: 'Starbucks',
  source: 'bank_sync',
  status: 'posted',
  notes: null,
  ignored: false,
  suggestedPlannedItemId: null,
  createdAt: '2024-01-15T10:00:00Z',
} as unknown as Transaction;

describe('IngestBankTransactionsUseCase', () => {
  let txRepo: ReturnType<typeof mock<TransactionRepository>>;
  let mappingRepo: ReturnType<typeof mock<MappingRepository>>;
  let suggestionPort: ReturnType<typeof mock<MappingSuggestionPort>>;
  let useCase: IngestBankTransactionsUseCase;

  beforeEach(() => {
    txRepo = mock<TransactionRepository>();
    mappingRepo = mock<MappingRepository>();
    suggestionPort = mock<MappingSuggestionPort>();
    useCase = new IngestBankTransactionsUseCase(txRepo, mappingRepo, suggestionPort, makeId);
  });

  it('skips already-existing transactions (upsert returns created=false)', async () => {
    txRepo.upsertByExternalId.mockResolvedValue({ id: txId, created: false });

    await useCase.execute({ accountId, rawTransactions: [rawTx], householdId });

    expect(txRepo.findById).not.toHaveBeenCalled();
    expect(txRepo.patch).not.toHaveBeenCalled();
  });

  it('stores suggestion when suggestionPort returns a plannedItemId', async () => {
    txRepo.upsertByExternalId.mockResolvedValue({ id: txId, created: true });
    txRepo.findById.mockResolvedValue(fakeTx);
    suggestionPort.suggest.mockReturnValue(plannedItemId);

    await useCase.execute({ accountId, rawTransactions: [rawTx], householdId });

    expect(txRepo.patch).toHaveBeenCalledWith(txId, { suggestedPlannedItemId: plannedItemId });
  });

  it('does not patch when suggestion is null', async () => {
    txRepo.upsertByExternalId.mockResolvedValue({ id: txId, created: true });
    txRepo.findById.mockResolvedValue(fakeTx);
    suggestionPort.suggest.mockReturnValue(null);

    await useCase.execute({ accountId, rawTransactions: [rawTx], householdId });

    expect(txRepo.patch).not.toHaveBeenCalled();
  });

  it('ingests multiple transactions in order', async () => {
    const raw2 = { ...rawTx, externalId: 'ext-2', description: 'Lunch' };
    txRepo.upsertByExternalId.mockResolvedValue({ id: txId, created: false });

    await useCase.execute({ accountId, rawTransactions: [rawTx, raw2], householdId });

    expect(txRepo.upsertByExternalId).toHaveBeenCalledTimes(2);
    expect(vi.mocked(txRepo.upsertByExternalId).mock.calls[0]![0].externalId).toBe('ext-1');
    expect(vi.mocked(txRepo.upsertByExternalId).mock.calls[1]![0].externalId).toBe('ext-2');
  });
});
