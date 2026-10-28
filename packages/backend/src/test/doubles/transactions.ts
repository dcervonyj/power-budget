import {
  BankAccountId,
  BankConnectionId,
  HouseholdId,
  IsoDate,
  IsoDateTime,
  PlannedItemId,
  TransactionId,
  TransactionMappingId,
  TransferId,
  UserId,
} from '@power-budget/core';
import type { BankAccount, BankConnection } from '../../domain/bank/entities.js';
import {
  NO_BANK_DETAILS,
  type Transaction,
  type TransactionMapping,
  type Transfer,
} from '../../domain/transactions/entities.js';
import { testUuid } from './testUuid.js';

export function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: TransactionId.of(testUuid('tx-default')),
    householdId: HouseholdId.of(testUuid('hh-default')),
    accountId: BankAccountId.of(testUuid('acc-default')),
    externalId: null,
    occurredOn: IsoDate.of('2026-10-05'),
    amount: { amountMinor: -1000n, currency: 'PLN' },
    description: 'Fixture',
    merchant: null,
    source: 'bank_sync',
    sourceKind: null,
    status: 'booked',
    direction: 'debit',
    bank: NO_BANK_DETAILS,
    reconciliation: null,
    ignored: false,
    notes: null,
    createdAt: IsoDateTime.of('2026-10-05T10:00:00.000Z'),
    suggestedPlannedItemId: null,
    suggestedCategoryId: null,
    suggestionConfidence: null,
    suggestionSource: null,
    autoMapped: false,
    ...overrides,
  };
}

export function makeTransactionMapping(
  overrides: Partial<TransactionMapping> = {},
): TransactionMapping {
  return {
    id: TransactionMappingId.of(testUuid('mapping-default')),
    transactionId: TransactionId.of(testUuid('tx-default')),
    plannedItemId: PlannedItemId.of(testUuid('item-default')),
    householdId: HouseholdId.of(testUuid('hh-default')),
    mappedBy: UserId.of(testUuid('user-default')),
    mappedAt: IsoDateTime.of('2026-10-05T10:00:00.000Z'),
    ...overrides,
  };
}

export function makeTransfer(overrides: Partial<Transfer> = {}): Transfer {
  return {
    id: TransferId.of(testUuid('transfer-default')),
    householdId: HouseholdId.of(testUuid('hh-default')),
    txAId: TransactionId.of(testUuid('tx-default')),
    txBId: null,
    markedBy: UserId.of(testUuid('user-default')),
    markedAt: IsoDateTime.of('2026-10-05T10:00:00.000Z'),
    status: 'active',
    ...overrides,
  };
}

export function makeBankAccount(overrides: Partial<BankAccount> = {}): BankAccount {
  return {
    id: BankAccountId.of(testUuid('acc-default')),
    householdId: HouseholdId.of(testUuid('hh-default')),
    connectionId: BankConnectionId.of(testUuid('conn-default')),
    externalId: 'ext-default',
    name: 'Fixture account',
    iban: null,
    currency: 'PLN',
    balanceMinor: 0n,
    lastSyncedAt: null,
    createdAt: new Date('2026-10-05T10:00:00.000Z'),
    ...overrides,
  };
}

export function makeBankConnection(overrides: Partial<BankConnection> = {}): BankConnection {
  return {
    id: BankConnectionId.of(testUuid('conn-default')),
    householdId: HouseholdId.of(testUuid('hh-default')),
    userId: UserId.of(testUuid('user-default')),
    provider: 'enable_banking',
    bankId: 'bank-1',
    externalConsentRef: null,
    encryptedConsent: null,
    expiresAt: null,
    status: 'active',
    disconnectedAt: null,
    createdAt: new Date('2026-10-05T10:00:00.000Z'),
    ...overrides,
  };
}
