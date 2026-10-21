import { beforeEach, describe, expect, it } from 'vitest';
import type { CategoryDto } from '../../../contract/dto.js';
import { RecordingHttpClient } from '../../../test/RecordingHttpClient.js';
import { CategoriesApi, isCategoryEditable } from '../CategoriesApi.js';

const groceries: CategoryDto = {
  id: 'cat-1',
  name: 'Groceries',
  kind: 'expense',
  icon: 'tag',
  color: '#6B7280',
  isSystem: false,
  seedKey: null,
  privacy: 'full_detail',
  archived: false,
  archivedAt: null,
  createdAt: '2026-10-01T00:00:00.000Z',
};

describe('CategoriesApi', () => {
  let http: RecordingHttpClient;
  let api: CategoriesApi;

  beforeEach(() => {
    http = new RecordingHttpClient();
    api = new CategoriesApi(http);
  });

  it('lists active categories by default and archived ones on request', async () => {
    http.respondWith([groceries], [groceries]);

    expect(await api.list()).toEqual([groceries]);
    await api.list({ includeArchived: true });

    expect(http.calls).toEqual([
      { method: 'GET', url: '/categories' },
      { method: 'GET', url: '/categories?includeArchived=true' },
    ]);
  });

  it('creates and patches categories with the contract bodies', async () => {
    http.respondWith(groceries, { ...groceries, privacy: 'total_only' });

    await api.create({ name: 'Groceries', kind: 'expense' });
    const updated = await api.update('cat-1', { privacy: 'total_only' });

    expect(updated.privacy).toBe('total_only');
    expect(http.calls).toEqual([
      { method: 'POST', url: '/categories', body: { name: 'Groceries', kind: 'expense' } },
      { method: 'PATCH', url: '/categories/cat-1', body: { privacy: 'total_only' } },
    ]);
  });
});

describe('isCategoryEditable', () => {
  it('rejects seeded system categories', () => {
    expect(isCategoryEditable(groceries)).toBe(true);
    expect(isCategoryEditable({ ...groceries, isSystem: true, seedKey: 'expense.groceries' })).toBe(
      false,
    );
  });
});
