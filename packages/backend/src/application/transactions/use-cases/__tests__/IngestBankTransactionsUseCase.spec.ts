import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { IngestBankTransactionsUseCase } from '../IngestBankTransactionsUseCase.js';
import type { TransactionRepository } from '../../../../domain/transactions/ports.js';
import type { NewTransaction } from '../../../../domain/transactions/entities.js';
import type { HouseholdId, BankAccountId } from '@power-budget/core';
import { IsoDate } from '@power-budget/core';
import type { RawTransaction } from '../../../../domain/bank/entities.js';

const VALID_UUID = '01900000-0000-7000-8000-000000000001';
const makeId = () => VALID_UUID;

const householdId = 'hh-1' as unknown as HouseholdId;
const accountId = 'acc-1' as unknown as BankAccountId;

function makeRawTx(overrides: Partial<RawTransaction> = {}): RawTransaction {
  return {
    accountExternalId: 'ext-acc-1',
    status: 'booked',
    entryReference: 'ext-1',
    bookingDate: IsoDate.of('2024-01-15'),
    valueDate: null,
    transactionDate: null,
    amountMinor: 1000n,
    currency: 'PLN',
    direction: 'credit',
    originalAmount: null,
    counterpartyName: 'Starbucks',
    counterpartyIban: null,
    remittance: 'Coffee shop',
    mcc: null,
    bankTxCode: null,
    balanceAfter: null,
    ...overrides,
  };
}

const rawTx = makeRawTx();

/** The rows handed to the repository, flattened over every insertBankBatch call. */
function insertedRows(repo: ReturnType<typeof mock<TransactionRepository>>): NewTransaction[] {
  return vi.mocked(repo.insertBankBatch).mock.calls.flatMap((call) => [...call[0]]);
}

describe('IngestBankTransactionsUseCase', () => {
  let txRepo: ReturnType<typeof mock<TransactionRepository>>;
  let useCase: IngestBankTransactionsUseCase;

  beforeEach(() => {
    txRepo = mock<TransactionRepository>();
    txRepo.insertBankBatch.mockResolvedValue(0);
    useCase = new IngestBankTransactionsUseCase(txRepo, makeId);
  });

  it('writes all booked rows of an account with one insertBankBatch call', async () => {
    const raw2 = makeRawTx({ entryReference: 'ext-2', remittance: 'Lunch' });
    const raw3 = makeRawTx({ entryReference: 'ext-3', remittance: 'Dinner' });

    await useCase.execute({ accountId, rawTransactions: [rawTx, raw2, raw3], householdId });

    expect(txRepo.insertBankBatch).toHaveBeenCalledOnce();
    expect(insertedRows(txRepo).map((row) => row.externalId)).toEqual(['ext-1', 'ext-2', 'ext-3']);
  });

  it('runs no write when there is nothing to store', async () => {
    await useCase.execute({ accountId, rawTransactions: [], householdId });

    expect(txRepo.insertBankBatch).not.toHaveBeenCalled();
  });

  it('stores a booked row with its remittance, counterparty and booking date', async () => {
    await useCase.execute({ accountId, rawTransactions: [rawTx], householdId });

    expect(insertedRows(txRepo)).toEqual([
      {
        id: VALID_UUID,
        householdId,
        accountId,
        externalId: 'ext-1',
        occurredOn: '2024-01-15',
        amount: { amountMinor: 1000n, currency: 'PLN' },
        description: 'Coffee shop',
        merchant: 'Starbucks',
        source: 'bank_sync',
        sourceKind: null,
        status: 'booked',
        bank: {
          bookingDate: '2024-01-15',
          valueDate: null,
          transactionAt: null,
          counterpartyName: 'Starbucks',
          counterpartyIbanHash: null,
          remittance: 'Coffee shop',
          mcc: null,
          bankTxCode: null,
          entryReference: 'ext-1',
          fingerprint: null,
          originalAmount: null,
        },
        ignored: false,
      },
    ]);
  });

  it('stores the FX instructed amount, MCC and bank code with the booked row', async () => {
    const fxCardPayment = makeRawTx({
      amountMinor: -4321n,
      direction: 'debit',
      originalAmount: { amountMinor: -1000n, currency: 'EUR' },
      mcc: '5812',
      bankTxCode: 'PMNT-CCRD-POSD',
      remittance: '',
    });

    await useCase.execute({ accountId, rawTransactions: [fxCardPayment], householdId });

    const stored = insertedRows(txRepo)[0]!;
    expect(stored.bank.originalAmount).toEqual({ amountMinor: -1000n, currency: 'EUR' });
    expect(stored.bank.mcc).toBe('5812');
    expect(stored.bank.bankTxCode).toBe('PMNT-CCRD-POSD');
    expect(stored.bank.remittance).toBeNull();
  });

  it('uses the transaction date as the economic date when the bank sends one', async () => {
    const cardPayment = makeRawTx({
      transactionDate: IsoDate.of('2024-01-13'),
      valueDate: IsoDate.of('2024-01-16'),
    });

    await useCase.execute({ accountId, rawTransactions: [cardPayment], householdId });

    expect(insertedRows(txRepo)[0]!.occurredOn).toBe('2024-01-13');
  });

  it('falls back to the value date when the bank sends neither transaction nor booking date', async () => {
    const valueDated = makeRawTx({ bookingDate: null, valueDate: IsoDate.of('2024-01-16') });

    await useCase.execute({ accountId, rawTransactions: [valueDated], householdId });

    expect(insertedRows(txRepo)[0]!.occurredOn).toBe('2024-01-16');
  });

  it('skips a row without any date', async () => {
    const undated = makeRawTx({ bookingDate: null });

    await useCase.execute({ accountId, rawTransactions: [undated], householdId });

    expect(txRepo.insertBankBatch).not.toHaveBeenCalled();
  });

  it('stores only booked rows until the pending/booked reconciliation lands (SYNC-006)', async () => {
    const rows = [
      makeRawTx({ status: 'pending', entryReference: null }),
      makeRawTx({ status: 'cancelled', entryReference: null }),
      makeRawTx({ status: 'scheduled', entryReference: null }),
      makeRawTx({ status: 'other', entryReference: null }),
      makeRawTx({ status: 'booked', entryReference: 'booked-1' }),
    ];

    await useCase.execute({ accountId, rawTransactions: rows, householdId });

    expect(txRepo.insertBankBatch).toHaveBeenCalledOnce();
    expect(insertedRows(txRepo)).toHaveLength(1);
    expect(insertedRows(txRepo)[0]!.externalId).toBe('booked-1');
  });

  it('stores an unsupported-currency row ignored', async () => {
    await useCase.execute({
      accountId,
      rawTransactions: [makeRawTx({ currency: 'HUF' })],
      householdId,
    });

    const stored = insertedRows(txRepo)[0]!;
    expect(stored.ignored).toBe(true);
    expect(stored.amount).toEqual({ amountMinor: 1000n, currency: 'HUF' });
  });

  it('stores a supported currency row counted, normalising the code', async () => {
    await useCase.execute({
      accountId,
      rawTransactions: [makeRawTx({ currency: 'pln' })],
      householdId,
    });

    const stored = insertedRows(txRepo)[0]!;
    expect(stored.ignored).toBe(false);
    expect(stored.amount.currency).toBe('PLN');
  });

  it('gives identical rows without an entry reference distinct keys, the first keeping the old one', async () => {
    const twin = makeRawTx({ entryReference: null });

    await useCase.execute({ accountId, rawTransactions: [twin, twin, twin], householdId });
    await useCase.execute({ accountId, rawTransactions: [twin], householdId });

    const keys = insertedRows(txRepo).map((row) => row.externalId);
    expect(new Set(keys.slice(0, 3)).size).toBe(3);
    expect(keys[3]).toBe(keys[0]);
  });

  it('never adds an ordinal to rows keyed by a bank entry reference', async () => {
    await useCase.execute({ accountId, rawTransactions: [rawTx, rawTx], householdId });

    const keys = insertedRows(txRepo).map((row) => row.externalId);
    expect(keys).toEqual(['ext-1', 'ext-1']);
  });
});
