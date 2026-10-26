import { describe, expect, it } from 'vitest';
import type { TransactionListItemDto } from '@power-budget/shared-app/contract';
import { TransactionMapper } from './TransactionMapper.js';

const dto: TransactionListItemDto = {
  id: 'tx-1',
  accountId: 'acc-1',
  externalId: null,
  occurredOn: '2026-10-21',
  amount: { amountMinor: '-9007199254740993', currency: 'PLN' },
  description: 'Rent',
  merchant: null,
  source: 'bank_sync',
  status: 'booked',
  ignored: false,
  notes: null,
  suggestedPlannedItemId: null,
  createdAt: '2026-10-21T10:00:00.000Z',
  mapping: null,
  mappingSource: 'none',
  transfer: null,
};

const listMapping = {
  plannedItemId: 'item-1',
  planId: 'plan-1',
  planName: 'October',
  planArchived: true,
  categoryId: 'cat-1',
  categoryName: 'Groceries',
  categorySeedKey: null,
  mappedAt: '2026-10-21T10:00:00.000Z',
};

describe('TransactionMapper', () => {
  it('parses the string minor units exactly', () => {
    const tx = TransactionMapper.fromListItem(dto);

    expect(tx.amount).toEqual({ amountMinor: -9007199254740993n, currency: 'PLN' });
    expect(tx.isTransfer).toBe(false);
    expect(tx.mapping).toBeNull();
  });

  it('takes the mapping, its names and provenance from the list row', () => {
    const tx = TransactionMapper.fromListItem({
      ...dto,
      mapping: listMapping,
      mappingSource: 'ai',
    });

    expect(tx.mapping).toEqual({
      plannedItemId: 'item-1',
      planName: 'October',
      planArchived: true,
      categoryName: 'Groceries',
      by: 'ai',
    });
  });

  it('reads a mapping without a known source as manual and a missing category as empty', () => {
    const tx = TransactionMapper.fromListItem({
      ...dto,
      mapping: { ...listMapping, categoryName: null },
      mappingSource: undefined,
    });

    expect(tx.mapping?.by).toBe('manual');
    expect(tx.mapping?.categoryName).toBe('');
  });

  it('marks the row as a transfer from the list transfer link', () => {
    const tx = TransactionMapper.fromListItem({
      ...dto,
      transfer: { transferId: 'tr-1', counterpartTransactionId: null },
    });

    expect(tx.isTransfer).toBe(true);
  });

  it('carries status and the suggested planned item', () => {
    const tx = TransactionMapper.fromListItem({
      ...dto,
      status: 'pending',
      suggestedPlannedItemId: 'item-9',
    });

    expect(tx.status).toBe('pending');
    expect(tx.suggestedPlannedItemId).toBe('item-9');
  });

  it('takes mapping and transfer from the detail response', () => {
    const tx = TransactionMapper.fromDetail({
      transaction: {
        id: dto.id,
        accountId: dto.accountId,
        externalId: null,
        occurredOn: dto.occurredOn,
        amount: dto.amount,
        description: dto.description,
        merchant: null,
        source: 'bank_sync',
        status: 'booked',
        ignored: false,
        notes: null,
        suggestedPlannedItemId: null,
        createdAt: dto.createdAt,
      },
      mapping: { plannedItemId: 'item-1' },
      transfer: { id: 'tr-1' },
    });

    expect(tx.mapping).toEqual({
      plannedItemId: 'item-1',
      planName: '',
      planArchived: false,
      categoryName: '',
      by: 'manual',
    });
    expect(tx.isTransfer).toBe(true);
  });

  it('rejects a non-integer amount instead of showing NaN', () => {
    expect(() =>
      TransactionMapper.fromListItem({
        ...dto,
        amount: { amountMinor: '12.5', currency: 'PLN' },
      }),
    ).toThrow();
  });
});
