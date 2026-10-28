import { describe, expect, it } from 'vitest';
import type { TransactionListItemDto } from '@power-budget/shared-app/contract';
import { loadAllPages } from '../TransactionPaging.js';
import { SerialQueue } from '../SerialQueue.js';
import {
  categoryNameByItem,
  findCategoryName,
  loadPlannedItemOptions,
} from '../PlannedItemCategories.js';

function item(id: string): TransactionListItemDto {
  return { id } as TransactionListItemDto;
}

describe('loadAllPages', () => {
  it('follows the cursors to the end and keeps the order', async () => {
    const pages = new Map([
      [undefined, { items: [item('a')], nextCursor: 'c1' }],
      ['c1', { items: [item('b')], nextCursor: 'c2' }],
      ['c2', { items: [item('c')], nextCursor: null }],
    ]);
    const result = await loadAllPages((cursor) => Promise.resolve(pages.get(cursor)!));

    expect(result.items.map((row) => row.id)).toEqual(['a', 'b', 'c']);
    expect(result.nextCursor).toBeNull();
  });

  it('stops at the page limit and hands back the cursor', async () => {
    const result = await loadAllPages(
      (cursor) => Promise.resolve({ items: [item(cursor ?? 'first')], nextCursor: `${cursor}+` }),
      2,
    );

    expect(result.items).toHaveLength(2);
    expect(result.nextCursor).toBe('undefined++');
  });
});

describe('SerialQueue', () => {
  it('runs tasks in order even when the first is slower', async () => {
    const order: string[] = [];
    const queue = new SerialQueue();
    const first = queue.run(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      order.push('confirm');
    });
    const second = queue.run(() => {
      order.push('undo');

      return Promise.resolve();
    });
    await Promise.all([first, second]);

    expect(order).toEqual(['confirm', 'undo']);
  });

  it('keeps going after a failed task and still reports it', async () => {
    const queue = new SerialQueue();
    const failed = queue.run(() => Promise.reject(new Error('boom')));
    const next = queue.run(() => Promise.resolve('ok'));

    await expect(failed).rejects.toThrow('boom');
    await expect(next).resolves.toBe('ok');
  });
});

describe('loadPlannedItemOptions', () => {
  it('offers income items next to expense items, so income can be mapped', async () => {
    const plansApi = {
      list: () => Promise.resolve([{ id: 'p1', name: 'October' }]),
      listItems: () =>
        Promise.resolve([
          { id: 'i-exp', categoryId: 'c-exp', direction: 'expense' },
          { id: 'i-inc', categoryId: 'c-inc', direction: 'income' },
        ]),
    };
    const categoriesApi = {
      list: () =>
        Promise.resolve([
          { id: 'c-exp', name: 'Food' },
          { id: 'c-inc', name: 'Salary' },
        ]),
    };

    const options = await loadPlannedItemOptions(plansApi as never, categoriesApi as never);

    expect(options.map((option) => [option.plannedItemId, option.direction])).toEqual([
      ['i-exp', 'expense'],
      ['i-inc', 'income'],
    ]);
    expect(categoryNameByItem(options).get('i-inc')).toBe('Salary');
  });
});

describe('findCategoryName', () => {
  const plansApi = {
    list: (status?: string) =>
      Promise.resolve(status === 'all' ? [{ id: 'old' }, { id: 'new' }] : []),
    listItems: (planId: string) =>
      Promise.resolve(planId === 'old' ? [{ id: 'item-old', categoryId: 'cat-1' }] : []),
  };
  const categoriesApi = { list: () => Promise.resolve([{ id: 'cat-1', name: 'Fuel' }]) };

  it('finds an item of an archived plan', async () => {
    const name = await findCategoryName(plansApi as never, categoriesApi as never, 'item-old');

    expect(name).toBe('Fuel');
  });

  it('is undefined for an unknown item', async () => {
    const name = await findCategoryName(plansApi as never, categoriesApi as never, 'nope');

    expect(name).toBeUndefined();
  });
});
