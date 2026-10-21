import { describe, expect, it } from 'vitest';
import type { TransactionDto } from '@power-budget/shared-app/contract';
import { TransactionMapper } from './TransactionMapper.js';

const dto: TransactionDto = {
  id: 'tx-1',
  accountId: 'acc-1',
  externalId: null,
  occurredOn: '2026-10-21',
  amount: { amountMinor: '-9007199254740993', currency: 'PLN' },
  description: 'Rent',
  merchant: null,
  source: 'bank_sync',
  status: 'posted',
  ignored: false,
  notes: null,
  suggestedPlannedItemId: null,
  createdAt: '2026-10-21T10:00:00.000Z',
};

describe('TransactionMapper', () => {
  it('parses the string minor units exactly', () => {
    const tx = TransactionMapper.fromListItem(dto, false);

    expect(tx.amount).toEqual({ amountMinor: -9007199254740993n, currency: 'PLN' });
    expect(tx.isTransfer).toBe(false);
    expect(tx.mapping).toBeNull();
    expect(tx.mappingStatus).toBe('unknown');
  });

  it('knows list items are unmapped only for an unmappedOnly page', () => {
    expect(TransactionMapper.fromListItem(dto, true).mappingStatus).toBe('unmapped');
  });

  it('takes mapping and transfer from the detail response', () => {
    const tx = TransactionMapper.fromDetail({
      transaction: dto,
      mapping: { plannedItemId: 'item-1' },
      transfer: { id: 'tr-1' },
    });

    expect(tx.mapping).toEqual({
      plannedItemId: 'item-1',
      plannedItemName: '',
      categoryId: '',
      categoryName: '',
    });
    expect(tx.isTransfer).toBe(true);
    expect(tx.mappingStatus).toBe('mapped');
  });

  it('rejects a non-integer amount instead of showing NaN', () => {
    expect(() =>
      TransactionMapper.fromListItem(
        { ...dto, amount: { amountMinor: '12.5', currency: 'PLN' } },
        false,
      ),
    ).toThrow();
  });
});
