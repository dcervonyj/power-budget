import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClientSession } from '../auth/ClientSession.js';
import { ReferenceCatalogue } from './ReferenceCatalogue.js';
import { CATEGORIES, ITEMS, PLAN } from '../../test/dashboardFixtures.js';
import { deferred } from '../../test/deferred.js';

describe('ReferenceCatalogue', () => {
  const list = vi.fn();
  const get = vi.fn();
  const listItems = vi.fn();
  const categoryList = vi.fn();
  let catalogue: ReferenceCatalogue;

  beforeEach(() => {
    list.mockReset().mockResolvedValue([PLAN]);
    get.mockReset().mockResolvedValue(PLAN);
    listItems.mockReset().mockResolvedValue(ITEMS);
    categoryList.mockReset().mockResolvedValue(CATEGORIES);
    catalogue = new ReferenceCatalogue({ list, get, listItems }, { list: categoryList });
  });

  it('reads each thing once, however often and however fast it is asked for', async () => {
    const first = catalogue.items('plan-1');
    const second = catalogue.items('plan-1');
    await Promise.all([first, second, catalogue.plan('plan-1'), catalogue.activePlans()]);
    await Promise.all([catalogue.items('plan-1'), catalogue.plan('plan-1')]);
    await Promise.all([catalogue.categories(), catalogue.categoryNames()]);
    await catalogue.activePlans();

    expect(listItems).toHaveBeenCalledOnce();
    expect(get).toHaveBeenCalledOnce();
    expect(list).toHaveBeenCalledOnce();
    expect(list).toHaveBeenCalledWith('active');
    expect(categoryList).toHaveBeenCalledOnce();
    expect(categoryList).toHaveBeenCalledWith({ includeArchived: true });
  });

  it('keeps the items of each plan apart', async () => {
    await catalogue.items('plan-1');
    await catalogue.items('plan-2');

    expect(listItems.mock.calls).toEqual([['plan-1'], ['plan-2']]);
  });

  it('names the categories', async () => {
    const names = await catalogue.categoryNames();

    expect(names.get(CATEGORIES[0]!.id)).toBe(CATEGORIES[0]!.name);
  });

  it('does not keep a failed read, so the next call tries again', async () => {
    listItems.mockRejectedValueOnce(new Error('down'));

    await expect(catalogue.items('plan-1')).rejects.toThrow('down');
    await expect(catalogue.items('plan-1')).resolves.toEqual(ITEMS);

    expect(listItems).toHaveBeenCalledTimes(2);
  });

  it('gives no names, and retries, when the categories cannot be read', async () => {
    categoryList.mockRejectedValueOnce(new Error('down'));

    expect((await catalogue.categoryNames()).size).toBe(0);
    expect((await catalogue.categoryNames()).size).toBe(CATEGORIES.length);
  });

  it('reads again after a local change', async () => {
    await Promise.all([
      catalogue.items('plan-1'),
      catalogue.categories(),
      catalogue.plan('plan-1'),
    ]);

    catalogue.invalidate();
    await Promise.all([
      catalogue.items('plan-1'),
      catalogue.categories(),
      catalogue.plan('plan-1'),
    ]);

    expect(listItems).toHaveBeenCalledTimes(2);
    expect(categoryList).toHaveBeenCalledTimes(2);
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('does not let a read that started before a change fill the cache with old data', async () => {
    const old = deferred<typeof ITEMS>();
    listItems.mockReturnValueOnce(old.promise);
    const stale = catalogue.items('plan-1');

    catalogue.invalidate();
    const fresh = await catalogue.items('plan-1');
    old.resolve([]);
    await stale;

    expect(fresh).toEqual(ITEMS);
    await expect(catalogue.items('plan-1')).resolves.toEqual(ITEMS);
    expect(listItems).toHaveBeenCalledTimes(2);
  });

  it('an old failure does not evict the newer read after a change', async () => {
    const old = deferred<typeof ITEMS>();
    listItems.mockReturnValueOnce(old.promise);
    const stale = catalogue.items('plan-1');
    catalogue.invalidate();
    await catalogue.items('plan-1');

    old.reject(new Error('late'));
    await expect(stale).rejects.toThrow('late');
    await catalogue.items('plan-1');

    expect(listItems).toHaveBeenCalledTimes(2);
  });

  it('is emptied when the session ends (CLN-034)', async () => {
    const session = new ClientSession();
    session.register(catalogue);
    await Promise.all([catalogue.items('plan-1'), catalogue.categories(), catalogue.activePlans()]);

    session.end();
    await Promise.all([catalogue.items('plan-1'), catalogue.categories(), catalogue.activePlans()]);

    expect(listItems).toHaveBeenCalledTimes(2);
    expect(categoryList).toHaveBeenCalledTimes(2);
    expect(list).toHaveBeenCalledTimes(2);
  });
});
