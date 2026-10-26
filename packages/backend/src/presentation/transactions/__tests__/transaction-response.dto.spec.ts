import { describe, expect, it } from 'vitest';
import {
  BankAccountId,
  CategoryId,
  HouseholdId,
  IsoDate,
  IsoDateTime,
  PlanId,
  PlannedItemId,
  TransactionId,
  TransferId,
} from '@power-budget/core';
import { NO_BANK_DETAILS } from '../../../domain/transactions/entities.js';
import type { Transaction } from '../../../domain/transactions/entities.js';
import { toTransactionPageDto } from '../dto/transaction-response.dto.js';

const tx: Transaction = {
  id: TransactionId.of('01890a5d-ac96-774b-bcce-b302099a8001'),
  householdId: HouseholdId.of('01890a5d-ac96-774b-bcce-b302099a8002'),
  accountId: BankAccountId.of('01890a5d-ac96-774b-bcce-b302099a8003'),
  externalId: null,
  occurredOn: IsoDate.of('2026-10-21'),
  amount: { amountMinor: -1250n, currency: 'PLN' },
  description: 'Bakery',
  merchant: null,
  source: 'manual',
  sourceKind: 'manual',
  status: 'pending',
  direction: 'debit',
  bank: NO_BANK_DETAILS,
  reconciliation: null,
  ignored: false,
  notes: null,
  suggestedPlannedItemId: null,
  suggestedCategoryId: null,
  suggestionConfidence: null,
  suggestionSource: null,
  autoMapped: false,
  createdAt: IsoDateTime.of('2026-10-21T10:00:00.000Z'),
};

describe('toTransactionPageDto', () => {
  it('flattens each list item: transaction fields plus mapping, source and transfer', () => {
    const page = toTransactionPageDto({
      items: [
        {
          transaction: tx,
          mapping: {
            plannedItemId: PlannedItemId.of('01890a5d-ac96-774b-bcce-b302099a8004'),
            planId: PlanId.of('01890a5d-ac96-774b-bcce-b302099a8005'),
            planName: 'September',
            planArchived: true,
            categoryId: CategoryId.of('01890a5d-ac96-474b-bcce-b302099a8006'),
            categoryName: 'Groceries',
            categorySeedKey: 'groceries',
            origin: 'manual',
            mappedAt: IsoDateTime.of('2026-10-21T11:00:00.000Z'),
          },
          mappingSource: 'manual',
          transfer: null,
        },
        {
          transaction: { ...tx, status: 'booked' },
          mapping: null,
          mappingSource: 'none',
          transfer: {
            transferId: TransferId.of('01890a5d-ac96-774b-bcce-b302099a8007'),
            counterpartTransactionId: null,
          },
        },
      ],
      nextCursor: 'next',
      hasMore: true,
    });

    expect(page.nextCursor).toBe('next');
    expect(page.hasMore).toBe(true);
    expect(page.items[0]).toMatchObject({
      id: tx.id,
      status: 'pending',
      amount: { amountMinor: '-1250', currency: 'PLN' },
      mappingSource: 'manual',
      transfer: null,
      mapping: {
        plannedItemId: '01890a5d-ac96-774b-bcce-b302099a8004',
        planId: '01890a5d-ac96-774b-bcce-b302099a8005',
        planName: 'September',
        planArchived: true,
        categoryId: '01890a5d-ac96-474b-bcce-b302099a8006',
        categoryName: 'Groceries',
        categorySeedKey: 'groceries',
        mappedAt: '2026-10-21T11:00:00.000Z',
      },
    });
    expect(page.items[1]).toMatchObject({
      status: 'booked',
      mapping: null,
      mappingSource: 'none',
      transfer: {
        transferId: '01890a5d-ac96-774b-bcce-b302099a8007',
        counterpartTransactionId: null,
      },
    });
  });
});
