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
import { IsoDate } from '@power-budget/core';
import type { RawTransaction } from '../../../../domain/bank/entities.js';

const VALID_UUID = '01900000-0000-7000-8000-000000000001';
const makeId = () => VALID_UUID;

const txId = '01900000-0000-7000-8000-000000000001' as unknown as TransactionId;
const householdId = 'hh-1' as unknown as HouseholdId;
const accountId = 'acc-1' as unknown as BankAccountId;
const plannedItemId = 'pi-1' as unknown as PlannedItemId;

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
  status: 'booked',
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

    expect(txRepo.patch).toHaveBeenCalledWith(
      txId,
      { suggestedPlannedItemId: plannedItemId },
      { householdId },
    );
  });

  it('does not patch when suggestion is null', async () => {
    txRepo.upsertByExternalId.mockResolvedValue({ id: txId, created: true });
    txRepo.findById.mockResolvedValue(fakeTx);
    suggestionPort.suggest.mockReturnValue(null);

    await useCase.execute({ accountId, rawTransactions: [rawTx], householdId });

    expect(txRepo.patch).not.toHaveBeenCalled();
  });

  it('ingests multiple transactions in order', async () => {
    const raw2 = makeRawTx({ entryReference: 'ext-2', remittance: 'Lunch' });
    txRepo.upsertByExternalId.mockResolvedValue({ id: txId, created: false });

    await useCase.execute({ accountId, rawTransactions: [rawTx, raw2], householdId });

    expect(txRepo.upsertByExternalId).toHaveBeenCalledTimes(2);
    expect(vi.mocked(txRepo.upsertByExternalId).mock.calls[0]![0].externalId).toBe('ext-1');
    expect(vi.mocked(txRepo.upsertByExternalId).mock.calls[1]![0].externalId).toBe('ext-2');
  });

  it('stores a booked row with its remittance, counterparty and booking date', async () => {
    txRepo.upsertByExternalId.mockResolvedValue({ id: txId, created: false });

    await useCase.execute({ accountId, rawTransactions: [rawTx], householdId });

    expect(txRepo.upsertByExternalId).toHaveBeenCalledWith({
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
    });
  });

  it('stores the FX instructed amount, MCC and bank code with the booked row', async () => {
    txRepo.upsertByExternalId.mockResolvedValue({ id: txId, created: false });
    const fxCardPayment = makeRawTx({
      amountMinor: -4321n,
      direction: 'debit',
      originalAmount: { amountMinor: -1000n, currency: 'EUR' },
      mcc: '5812',
      bankTxCode: 'PMNT-CCRD-POSD',
      remittance: '',
    });

    await useCase.execute({ accountId, rawTransactions: [fxCardPayment], householdId });

    const stored = vi.mocked(txRepo.upsertByExternalId).mock.calls[0]![0];
    expect(stored.bank.originalAmount).toEqual({ amountMinor: -1000n, currency: 'EUR' });
    expect(stored.bank.mcc).toBe('5812');
    expect(stored.bank.bankTxCode).toBe('PMNT-CCRD-POSD');
    expect(stored.bank.remittance).toBeNull();
  });

  it('uses the transaction date as the economic date when the bank sends one', async () => {
    txRepo.upsertByExternalId.mockResolvedValue({ id: txId, created: false });
    const cardPayment = makeRawTx({
      transactionDate: IsoDate.of('2024-01-13'),
      valueDate: IsoDate.of('2024-01-16'),
    });

    await useCase.execute({ accountId, rawTransactions: [cardPayment], householdId });

    expect(vi.mocked(txRepo.upsertByExternalId).mock.calls[0]![0].occurredOn).toBe('2024-01-13');
  });

  it('falls back to the value date when the bank sends neither transaction nor booking date', async () => {
    txRepo.upsertByExternalId.mockResolvedValue({ id: txId, created: false });
    const valueDated = makeRawTx({ bookingDate: null, valueDate: IsoDate.of('2024-01-16') });

    await useCase.execute({ accountId, rawTransactions: [valueDated], householdId });

    expect(vi.mocked(txRepo.upsertByExternalId).mock.calls[0]![0].occurredOn).toBe('2024-01-16');
  });

  it('skips a row without any date', async () => {
    const undated = makeRawTx({ bookingDate: null });

    await useCase.execute({ accountId, rawTransactions: [undated], householdId });

    expect(txRepo.upsertByExternalId).not.toHaveBeenCalled();
  });

  it('stores only booked rows until the pending/booked reconciliation lands (SYNC-006)', async () => {
    txRepo.upsertByExternalId.mockResolvedValue({ id: txId, created: false });
    const rows = [
      makeRawTx({ status: 'pending', entryReference: null }),
      makeRawTx({ status: 'cancelled', entryReference: null }),
      makeRawTx({ status: 'scheduled', entryReference: null }),
      makeRawTx({ status: 'other', entryReference: null }),
      makeRawTx({ status: 'booked', entryReference: 'booked-1' }),
    ];

    await useCase.execute({ accountId, rawTransactions: rows, householdId });

    expect(txRepo.upsertByExternalId).toHaveBeenCalledOnce();
    expect(vi.mocked(txRepo.upsertByExternalId).mock.calls[0]![0].externalId).toBe('booked-1');
  });

  it('stores an unsupported-currency row ignored and does not read it back', async () => {
    txRepo.upsertByExternalId.mockResolvedValue({ id: txId, created: true });

    await useCase.execute({
      accountId,
      rawTransactions: [makeRawTx({ currency: 'HUF' })],
      householdId,
    });

    const stored = vi.mocked(txRepo.upsertByExternalId).mock.calls[0]![0];
    expect(stored.ignored).toBe(true);
    expect(stored.amount).toEqual({ amountMinor: 1000n, currency: 'HUF' });
    expect(txRepo.findById).not.toHaveBeenCalled();
  });

  it('stores a supported currency row counted, normalising the code', async () => {
    txRepo.upsertByExternalId.mockResolvedValue({ id: txId, created: false });

    await useCase.execute({
      accountId,
      rawTransactions: [makeRawTx({ currency: 'pln' })],
      householdId,
    });

    const stored = vi.mocked(txRepo.upsertByExternalId).mock.calls[0]![0];
    expect(stored.ignored).toBe(false);
    expect(stored.amount.currency).toBe('PLN');
  });

  it('gives identical rows without an entry reference distinct keys, the first keeping the old one', async () => {
    txRepo.upsertByExternalId.mockResolvedValue({ id: txId, created: false });
    const twin = makeRawTx({ entryReference: null });

    await useCase.execute({ accountId, rawTransactions: [twin, twin, twin], householdId });
    await useCase.execute({ accountId, rawTransactions: [twin], householdId });

    const keys = vi.mocked(txRepo.upsertByExternalId).mock.calls.map((call) => call[0].externalId);
    expect(new Set(keys.slice(0, 3)).size).toBe(3);
    expect(keys[3]).toBe(keys[0]);
  });

  it('never adds an ordinal to rows keyed by a bank entry reference', async () => {
    txRepo.upsertByExternalId.mockResolvedValue({ id: txId, created: false });

    await useCase.execute({ accountId, rawTransactions: [rawTx, rawTx], householdId });

    const keys = vi.mocked(txRepo.upsertByExternalId).mock.calls.map((call) => call[0].externalId);
    expect(keys).toEqual(['ext-1', 'ext-1']);
  });
});
