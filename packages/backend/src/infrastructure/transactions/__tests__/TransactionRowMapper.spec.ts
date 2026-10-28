import { describe, expect, it } from 'vitest';
import {
  BankAccountId,
  CategoryId,
  HouseholdId,
  IsoDate,
  IsoDateTime,
  PlannedItemId,
  TransactionId,
} from '@power-budget/core';
import { NO_BANK_DETAILS } from '../../../domain/transactions/entities.js';
import type { BankTransactionDetails } from '../../../domain/transactions/entities.js';
import type { SelectTransaction } from '../../../../drizzle/schema.js';
import { TransactionRowMapper } from '../TransactionRowMapper.js';

const ids = {
  tx: TransactionId.of('01900000-0000-7000-8000-000000000001'),
  household: HouseholdId.of('01900000-0000-7000-8000-000000000002'),
  account: BankAccountId.of('01900000-0000-7000-8000-000000000003'),
  plannedItem: PlannedItemId.of('01900000-0000-7000-8000-000000000004'),
  category: CategoryId.of('01900000-0000-7000-8000-000000000005'),
};

const createdAt = new Date('2026-10-12T06:30:00.000Z');

const details: BankTransactionDetails = {
  bookingDate: IsoDate.of('2026-10-12'),
  valueDate: IsoDate.of('2026-10-13'),
  transactionAt: IsoDateTime.of('2026-10-11T18:45:00.000Z'),
  counterpartyName: 'Cafe Nero',
  counterpartyIbanHash: 'iban-hash',
  remittance: 'CARD 1234 CAFE NERO',
  mcc: '5812',
  bankTxCode: 'PMNT-CCRD-POSD',
  entryReference: 'entry-1',
  fingerprint: 'fp-1',
  originalAmount: { amountMinor: -500n, currency: 'EUR' },
};

function row(overrides: Partial<SelectTransaction> = {}): SelectTransaction {
  return {
    id: ids.tx,
    householdId: ids.household,
    accountId: ids.account,
    externalId: 'eb:entry-1',
    occurredOn: IsoDate.of('2026-10-11'),
    amountMinor: -2150n,
    currency: 'PLN',
    description: 'CARD 1234 CAFE NERO',
    merchant: 'Cafe Nero',
    source: 'bank_sync',
    status: 'booked',
    ignored: false,
    notes: null,
    bookingDate: '2026-10-12',
    valueDate: '2026-10-13',
    transactionAt: new Date('2026-10-11T18:45:00.000Z'),
    direction: 'debit',
    counterpartyName: 'Cafe Nero',
    counterpartyIbanHash: 'iban-hash',
    remittance: 'CARD 1234 CAFE NERO',
    mcc: '5812',
    bankTxCode: 'PMNT-CCRD-POSD',
    entryReference: 'entry-1',
    fingerprint: 'fp-1',
    sourceKind: 'enable_banking',
    originalAmountMinor: -500n,
    originalCurrency: 'EUR',
    reconciliation: null,
    suggestedPlannedItemId: ids.plannedItem,
    suggestedCategoryId: ids.category,
    suggestionConfidence: 0.875,
    suggestionSource: 'llm',
    autoMapped: true,
    createdAt,
    ...overrides,
  };
}

describe('TransactionRowMapper', () => {
  const mapper = new TransactionRowMapper();

  it('maps every v2 column of a row to the entity', () => {
    expect(mapper.toEntity(row())).toEqual({
      id: ids.tx,
      householdId: ids.household,
      accountId: ids.account,
      externalId: 'eb:entry-1',
      occurredOn: IsoDate.of('2026-10-11'),
      amount: { amountMinor: -2150n, currency: 'PLN' },
      description: 'CARD 1234 CAFE NERO',
      merchant: 'Cafe Nero',
      source: 'bank_sync',
      sourceKind: 'enable_banking',
      status: 'booked',
      direction: 'debit',
      bank: details,
      reconciliation: null,
      ignored: false,
      notes: null,
      suggestedPlannedItemId: ids.plannedItem,
      suggestedCategoryId: ids.category,
      suggestionConfidence: 0.875,
      suggestionSource: 'llm',
      autoMapped: true,
      createdAt: '2026-10-12T06:30:00.000Z',
    });
  });

  it('maps a row that predates SYNC-001 (no bank fields, no source kind)', () => {
    const entity = mapper.toEntity(
      row({
        status: 'pending',
        direction: 'credit',
        sourceKind: null,
        bookingDate: null,
        valueDate: null,
        transactionAt: null,
        counterpartyName: null,
        counterpartyIbanHash: null,
        remittance: null,
        mcc: null,
        bankTxCode: null,
        entryReference: null,
        fingerprint: null,
        originalAmountMinor: null,
        originalCurrency: null,
        suggestedPlannedItemId: null,
        suggestedCategoryId: null,
        suggestionConfidence: null,
        suggestionSource: null,
        autoMapped: false,
      }),
    );

    expect(entity).toMatchObject({
      status: 'pending',
      direction: 'credit',
      sourceKind: null,
      bank: NO_BANK_DETAILS,
      suggestedPlannedItemId: null,
      suggestedCategoryId: null,
      suggestionConfidence: null,
      suggestionSource: null,
      autoMapped: false,
    });
  });

  it('rejects a status or suggestion source outside the allowed values', () => {
    expect(() => mapper.toEntity(row({ status: 'posted' }))).toThrow(/transaction status/);
    expect(() => mapper.toEntity(row({ suggestionSource: 'guess' }))).toThrow(/suggestion source/);
  });

  it('reads the reconciliation history written by upgradeInPlace', () => {
    const entity = mapper.toEntity(
      row({
        reconciliation: {
          upgrades: [
            {
              upgradedAt: '2026-10-12T06:30:00+00:00',
              from: {
                status: 'live',
                externalId: null,
                occurredOn: '2026-10-10',
                amountMinor: '-2000',
                currency: 'PLN',
                description: 'live row',
                sourceKind: 'pko_email',
                fingerprint: null,
              },
            },
          ],
        },
      }),
    );

    expect(entity.reconciliation).toEqual({
      upgrades: [
        {
          upgradedAt: '2026-10-12T06:30:00.000Z',
          from: {
            status: 'live',
            externalId: null,
            occurredOn: '2026-10-10',
            amount: { amountMinor: -2000n, currency: 'PLN' },
            description: 'live row',
            sourceKind: 'pko_email',
            fingerprint: null,
          },
        },
      ],
    });
  });

  it('throws on a malformed reconciliation instead of guessing', () => {
    expect(() => mapper.toEntity(row({ reconciliation: { upgrades: 'no' } }))).toThrow(
      /no upgrades/,
    );
    expect(() =>
      mapper.toEntity(row({ reconciliation: { upgrades: [{ upgradedAt: 1, from: {} }] } })),
    ).toThrow(/upgradedAt is not a string/);
    expect(() =>
      mapper.toEntity(
        row({
          reconciliation: {
            upgrades: [
              {
                upgradedAt: '2026-10-12T06:30:00Z',
                from: {
                  status: 'booked',
                  occurredOn: '2026-10-10',
                  amountMinor: '1',
                  currency: 'PLN',
                  description: 'x',
                },
              },
            ],
          },
        }),
      ),
    ).toThrow(/provisional status/);
  });

  it('builds insert values with the bank columns and without the generated direction', () => {
    const values = mapper.toInsert({
      id: ids.tx,
      householdId: ids.household,
      accountId: ids.account,
      externalId: 'eb:entry-1',
      occurredOn: IsoDate.of('2026-10-11'),
      amount: { amountMinor: -2150n, currency: 'PLN' },
      description: 'CARD 1234 CAFE NERO',
      merchant: 'Cafe Nero',
      source: 'bank_sync',
      sourceKind: 'enable_banking',
      status: 'booked',
      bank: details,
      ignored: false,
    });

    expect(values).toEqual({
      id: ids.tx,
      householdId: ids.household,
      accountId: ids.account,
      externalId: 'eb:entry-1',
      occurredOn: IsoDate.of('2026-10-11'),
      amountMinor: -2150n,
      currency: 'PLN',
      description: 'CARD 1234 CAFE NERO',
      merchant: 'Cafe Nero',
      source: 'bank_sync',
      sourceKind: 'enable_banking',
      status: 'booked',
      ignored: false,
      notes: null,
      bookingDate: '2026-10-12',
      valueDate: '2026-10-13',
      transactionAt: new Date('2026-10-11T18:45:00.000Z'),
      counterpartyName: 'Cafe Nero',
      counterpartyIbanHash: 'iban-hash',
      remittance: 'CARD 1234 CAFE NERO',
      mcc: '5812',
      bankTxCode: 'PMNT-CCRD-POSD',
      entryReference: 'entry-1',
      fingerprint: 'fp-1',
      originalAmountMinor: -500n,
      originalCurrency: 'EUR',
    });
  });

  it('patches only the given fields, the suggested planned item included', () => {
    expect(mapper.patchColumns({ suggestedPlannedItemId: ids.plannedItem })).toEqual({
      suggestedPlannedItemId: ids.plannedItem,
    });
    expect(
      mapper.patchColumns({
        notes: null,
        ignored: true,
        suggestedPlannedItemId: null,
        suggestedCategoryId: ids.category,
        suggestionConfidence: 0.5,
        suggestionSource: 'merchant_rule',
        autoMapped: false,
      }),
    ).toEqual({
      notes: null,
      ignored: true,
      suggestedPlannedItemId: null,
      suggestedCategoryId: ids.category,
      suggestionConfidence: 0.5,
      suggestionSource: 'merchant_rule',
      autoMapped: false,
    });
    expect(mapper.patchColumns({})).toEqual({});
  });
});
