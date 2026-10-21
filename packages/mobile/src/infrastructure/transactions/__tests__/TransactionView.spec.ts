import { describe, expect, it } from 'vitest';
import type { TransactionDetailDto } from '@power-budget/shared-app/contract';
import { TransactionView, formatAmountText, isOutgoing } from '../TransactionView.js';

const detail: TransactionDetailDto = {
  transaction: {
    id: 'tx-1',
    accountId: 'acc-1',
    externalId: null,
    occurredOn: '2026-10-05',
    amount: { amountMinor: '-1250', currency: 'PLN' },
    description: 'Biedronka',
    merchant: null,
    source: 'bank_sync',
    status: 'posted',
    ignored: false,
    notes: null,
    suggestedPlannedItemId: null,
    createdAt: '2026-10-05T10:00:00.000Z',
  },
  mapping: { plannedItemId: 'item-1' },
  transfer: null,
};

describe('TransactionView.fromDetail', () => {
  it('keeps the API amount and reads mapping and transfer from the detail', () => {
    expect(TransactionView.fromDetail(detail)).toEqual({
      id: 'tx-1',
      occurredOn: '2026-10-05',
      description: 'Biedronka',
      amount: { amountMinor: '-1250', currency: 'PLN' },
      source: 'bank_sync',
      notes: null,
      ignored: false,
      isTransfer: false,
      mapping: { plannedItemId: 'item-1' },
    });
    expect(TransactionView.fromDetail({ ...detail, transfer: { id: 'tr-1' } }).isTransfer).toBe(
      true,
    );
  });
});

describe('formatAmountText', () => {
  it('formats exact minor units with the currency exponent', () => {
    expect(formatAmountText({ amountMinor: '-1250', currency: 'PLN' })).toBe('-12.50 PLN');
    expect(formatAmountText({ amountMinor: '900719925474099312', currency: 'EUR' })).toBe(
      '9007199254740993.12 EUR',
    );
  });

  it('marks negative amounts as outgoing', () => {
    expect(isOutgoing({ amountMinor: '-1', currency: 'PLN' })).toBe(true);
    expect(isOutgoing({ amountMinor: '1', currency: 'PLN' })).toBe(false);
  });
});
