import { describe, expect, it, vi } from 'vitest';
import type { TransactionDetailDto, TransactionDto } from '@power-budget/shared-app/contract';
import { TransactionMapper } from '../../infrastructure/api/TransactionMapper.js';
import { TransactionMappingStore } from './TransactionMappingStore.js';

function dto(id: string, ignored = false): TransactionDto {
  return {
    id,
    accountId: 'acc-1',
    externalId: null,
    occurredOn: '2026-10-21',
    amount: { amountMinor: '-100', currency: 'PLN' },
    description: 'x',
    merchant: null,
    source: 'bank_sync',
    status: 'posted',
    ignored,
    notes: null,
    suggestedPlannedItemId: null,
    createdAt: '2026-10-21T10:00:00.000Z',
  };
}

function detail(
  id: string,
  mapping: { plannedItemId: string } | null,
  transfer: { id: string } | null,
): TransactionDetailDto {
  return { transaction: dto(id), mapping, transfer };
}

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('TransactionMappingStore', () => {
  it('is "checking" until the detail is read, never "unmapped"', () => {
    const store = new TransactionMappingStore(() => new Promise(() => undefined));

    expect(store.viewOf(TransactionMapper.fromListItem(dto('a')))).toEqual({ kind: 'checking' });
  });

  it('tells mapped (with names), transfer, unmapped and ignored apart', async () => {
    const details: Record<string, TransactionDetailDto> = {
      m: detail('m', { plannedItemId: 'item-1' }, null),
      t: detail('t', null, { id: 'tr-1' }),
      u: detail('u', null, null),
    };
    const store = new TransactionMappingStore((id) => Promise.resolve(details[id] as never));
    store.setLabels(new Map([['item-1', { planName: 'May', categoryName: 'Groceries' }]]));

    store.load(['m', 't', 'u']);
    await flush();

    const view = (id: string, ignored = false) =>
      store.viewOf(TransactionMapper.fromListItem(dto(id, ignored)));
    expect(view('m')).toEqual({
      kind: 'mapped',
      plannedItemId: 'item-1',
      categoryName: 'Groceries',
      planName: 'May',
    });
    expect(view('t')).toEqual({ kind: 'transfer' });
    expect(view('u')).toEqual({ kind: 'unmapped' });
    expect(view('u', true)).toEqual({ kind: 'ignored' });
  });

  it('keeps an id from a failed read as "checking" and retries it on the next load', async () => {
    const fetchDetail = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(detail('a', null, null));
    const store = new TransactionMappingStore(fetchDetail);
    const tx = TransactionMapper.fromListItem(dto('a'));

    store.load(['a']);
    await flush();
    expect(store.viewOf(tx)).toEqual({ kind: 'checking' });

    store.load(['a']);
    await flush();
    expect(store.viewOf(tx)).toEqual({ kind: 'unmapped' });
  });

  it('reads at most four details at once and each id once', async () => {
    let inFlight = 0;
    let peak = 0;
    const fetchDetail = vi.fn(async (id: string) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await flush();
      inFlight -= 1;

      return detail(id, null, null);
    });
    const store = new TransactionMappingStore(fetchDetail);
    const ids = ['1', '2', '3', '4', '5', '6', '7'];

    store.load(ids);
    store.load(ids);
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(fetchDetail).toHaveBeenCalledTimes(7);
    expect(peak).toBe(4);
  });

  it('shows a change made in a modal at once', () => {
    const store = new TransactionMappingStore(() => new Promise(() => undefined));
    const tx = TransactionMapper.fromListItem(dto('a'));

    store.record('a', { plannedItemId: null, transfer: false });

    expect(store.viewOf(tx)).toEqual({ kind: 'unmapped' });
  });

  it('reset forgets the answers and reads them again', async () => {
    const fetchDetail = vi.fn().mockResolvedValue(detail('a', null, null));
    const store = new TransactionMappingStore(fetchDetail);
    store.record('a', { plannedItemId: 'item-1', transfer: false });

    store.reset(['a']);
    await flush();

    expect(fetchDetail).toHaveBeenCalledTimes(1);
    expect(store.viewOf(TransactionMapper.fromListItem(dto('a')))).toEqual({ kind: 'unmapped' });
  });
});
