import type {
  BankConnectionId,
  HouseholdId,
  PlanId,
  PlannedItemId,
  UserId,
  TransactionId,
  BankAccountId,
  CategoryId,
  PlanActualsView,
} from '@power-budget/core';
import type { BankConnection } from '../../src/bank/domain/entities.js';
import type { Plan, PlannedItem } from '../../src/plans/domain/entities.js';
import type { Transaction } from '../../src/transactions/domain/entities.js';
import type { Household } from '../../src/auth/domain/entities.js';

export const HOUSEHOLD_A = '01900000-0000-7000-8000-aaaaaaaaaaaa' as HouseholdId;
export const HOUSEHOLD_B = '01900000-0000-7000-8000-bbbbbbbbbbbb' as HouseholdId;
export const USER_A = '01900000-0000-7000-8000-000000000001' as UserId;
export const USER_B = '01900000-0000-7000-8000-000000000002' as UserId;
export const PLAN_ID_A = '01900000-0000-7000-8000-00000000aa01' as PlanId;
export const PLAN_ID_B = '01900000-0000-7000-8000-00000000bb01' as PlanId;
export const TX_ID_A = '01900000-0000-7000-8000-00000000aa02' as TransactionId;
export const TX_ID_B = '01900000-0000-7000-8000-00000000bb02' as TransactionId;
export const CONN_ID_A = '01900000-0000-7000-8000-00000000aa03' as BankConnectionId;
export const CONN_ID_B = '01900000-0000-7000-8000-00000000bb03' as BankConnectionId;
export const ACCOUNT_ID = '01900000-0000-7000-8000-00000000aa04' as BankAccountId;
export const CATEGORY_ID = '01900000-0000-7000-8000-00000000aa05' as CategoryId;
export const PLANNED_ITEM_ID = '01900000-0000-7000-8000-00000000aa06' as PlannedItemId;
// Valid UUIDv7 to use as generated IDs in use cases
export const VALID_UUID = '01900000-0000-7000-8000-00000000ff01';

export function makeBankConnection(
  householdId: HouseholdId,
  overrides?: Partial<BankConnection>,
): BankConnection {
  return {
    id: householdId === HOUSEHOLD_A ? CONN_ID_A : CONN_ID_B,
    householdId,
    userId: householdId === HOUSEHOLD_A ? USER_A : USER_B,
    provider: 'gocardless',
    bankId: 'TEST_BANK',
    externalConsentRef: null,
    encryptedConsent: null,
    expiresAt: null,
    status: 'active',
    disconnectedAt: null,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
  };
}

export function makePlan(householdId: HouseholdId): Plan {
  return {
    id: householdId === HOUSEHOLD_A ? PLAN_ID_A : PLAN_ID_B,
    householdId,
    ownerUserId: USER_A,
    name: `Plan for ${householdId}`,
    type: 'personal',
    periodKind: 'monthly',
    period: { start: '2024-01-01', end: '2024-01-31' },
    baseCurrency: 'EUR',
    archivedAt: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };
}

export function makeTransaction(householdId: HouseholdId): Transaction {
  return {
    id: householdId === HOUSEHOLD_A ? TX_ID_A : TX_ID_B,
    householdId,
    accountId: ACCOUNT_ID,
    externalId: null,
    occurredOn: '2024-01-15',
    amount: { amountMinor: 1000n, currency: 'EUR' },
    description: `tx for ${householdId}`,
    merchant: null,
    source: 'manual',
    status: 'posted',
    ignored: false,
    notes: null,
    suggestedPlannedItemId: null,
    createdAt: '2024-01-15T00:00:00.000Z',
  };
}

export function makeHousehold(householdId: HouseholdId): Household {
  return {
    id: householdId,
    name: `Household ${householdId}`,
    baseCurrency: 'EUR',
    createdAt: new Date('2024-01-01'),
  };
}

export function makePlanActualsView(planId: PlanId): PlanActualsView {
  return {
    planId,
    period: { start: '2024-01-01', end: '2024-01-31' },
    baseCurrency: 'EUR',
    incomeLines: [],
    expenseLines: [],
    totalPlannedIncome: { amountMinor: 0n, currency: 'EUR' },
    totalActualIncome: { amountMinor: 0n, currency: 'EUR' },
    totalPlannedExpenses: { amountMinor: 0n, currency: 'EUR' },
    totalActualExpenses: { amountMinor: 0n, currency: 'EUR' },
    unplannedExpenses: { amountMinor: 0n, currency: 'EUR' },
    unplannedIncome: { amountMinor: 0n, currency: 'EUR' },
    net: { amountMinor: 0n, currency: 'EUR' },
    asOf: '2024-01-15',
  };
}

export function makePlannedItem(householdId: HouseholdId): PlannedItem {
  return {
    id: PLANNED_ITEM_ID,
    planId: householdId === HOUSEHOLD_A ? PLAN_ID_A : PLAN_ID_B,
    householdId,
    categoryId: CATEGORY_ID,
    direction: 'expense',
    amount: { amountMinor: 500n, currency: 'EUR' },
    note: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };
}
