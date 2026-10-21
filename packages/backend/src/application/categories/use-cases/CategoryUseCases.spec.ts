import { describe, it, expect, beforeEach } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';
import { CategoryId, IsoDateTime } from '@power-budget/core';
import type {
  CategoryPrivacyRepository,
  CategoryRepository,
} from '../../../domain/categories/ports.js';
import type { AuditLogger } from '../../../domain/audit/ports.js';
import { CATEGORY, HH, NEW_ID, NOW, USER, makeCategory } from '../../../test/doubles/plans.js';
import { ListCategoriesUseCase } from './ListCategoriesUseCase.js';
import { CreateCategoryUseCase } from './CreateCategoryUseCase.js';
import { UpdateCategoryUseCase } from './UpdateCategoryUseCase.js';

const SCOPE = { householdId: HH };
const SYSTEM = makeCategory({
  id: CategoryId.of('550e8400-e29b-41d4-a716-446655440001'),
  householdId: null,
  seedKey: 'expense.groceries',
  name: 'Groceries',
});
const ARCHIVED_AT = IsoDateTime.of('2026-10-02T00:00:00.000Z');

let categoryRepo: MockProxy<CategoryRepository>;
let privacyRepo: MockProxy<CategoryPrivacyRepository>;
let auditLogger: MockProxy<AuditLogger>;

beforeEach(() => {
  categoryRepo = mock<CategoryRepository>();
  privacyRepo = mock<CategoryPrivacyRepository>();
  auditLogger = mock<AuditLogger>();
});

describe('ListCategoriesUseCase', () => {
  it('joins the household privacy levels, defaulting to total_only', async () => {
    const own = makeCategory();
    categoryRepo.list.mockResolvedValue([SYSTEM, own]);
    privacyRepo.listByHousehold.mockResolvedValue([
      {
        categoryId: CATEGORY,
        householdId: HH,
        level: 'total_only',
        updatedBy: USER,
        updatedAt: ARCHIVED_AT,
      },
    ]);

    const result = await new ListCategoriesUseCase(categoryRepo, privacyRepo).execute({
      householdId: HH,
      includeArchived: true,
    });

    expect(result).toEqual([
      { ...SYSTEM, privacy: 'total_only' },
      { ...own, privacy: 'total_only' },
    ]);
    expect(categoryRepo.list).toHaveBeenCalledWith(SCOPE, { includeArchived: true });
  });
});

describe('CreateCategoryUseCase', () => {
  function useCase(): CreateCategoryUseCase {
    return new CreateCategoryUseCase(categoryRepo, auditLogger, () => NEW_ID);
  }

  it('creates a trimmed household category with defaults and audits', async () => {
    const created = makeCategory({ id: CategoryId.of(NEW_ID), name: 'Coffee' });
    categoryRepo.list.mockResolvedValue([SYSTEM]);
    categoryRepo.create.mockResolvedValue(created);

    const result = await useCase().execute({
      name: '  Coffee ',
      kind: 'expense',
      userId: USER,
      householdId: HH,
    });

    expect(result).toEqual({ ...created, privacy: 'total_only' });
    expect(categoryRepo.create).toHaveBeenCalledWith({
      id: NEW_ID,
      householdId: HH,
      name: 'Coffee',
      kind: 'expense',
      icon: 'tag',
      color: '#6B7280',
    });
    expect(auditLogger.log).toHaveBeenCalledWith({
      householdId: HH,
      actorId: USER,
      action: 'CATEGORY_CREATED',
      subjectType: 'Category',
      subjectId: NEW_ID,
      meta: {},
    });
  });

  it('rejects a name already used by an active category (case-insensitive)', async () => {
    categoryRepo.list.mockResolvedValue([SYSTEM]);

    await expect(
      useCase().execute({ name: 'groceries', kind: 'expense', userId: USER, householdId: HH }),
    ).rejects.toThrow('CATEGORY_DUPLICATE');
    expect(categoryRepo.create).not.toHaveBeenCalled();
  });
});

describe('UpdateCategoryUseCase', () => {
  function useCase(): UpdateCategoryUseCase {
    return new UpdateCategoryUseCase(categoryRepo, privacyRepo, auditLogger, () => NOW);
  }

  it('renames, archives and sets privacy, then returns the fresh view', async () => {
    const own = makeCategory();
    const reloaded = makeCategory({ name: 'Cafe', archivedAt: ARCHIVED_AT });
    categoryRepo.findById.mockResolvedValueOnce(own).mockResolvedValueOnce(reloaded);
    categoryRepo.list.mockResolvedValue([own, SYSTEM]);
    privacyRepo.listByHousehold.mockResolvedValue([]);

    const result = await useCase().execute({
      categoryId: CATEGORY,
      changes: { name: 'Cafe', archived: true, privacy: 'total_with_counts' },
      userId: USER,
      householdId: HH,
    });

    expect(result).toEqual({ ...reloaded, privacy: 'total_only' });
    expect(categoryRepo.update).toHaveBeenCalledWith(CATEGORY, { name: 'Cafe' }, SCOPE);
    expect(categoryRepo.setArchivedAt).toHaveBeenCalledWith(CATEGORY, NOW, SCOPE);
    expect(privacyRepo.set).toHaveBeenCalledWith(CATEGORY, 'total_with_counts', USER, SCOPE);
    expect(auditLogger.log).toHaveBeenCalledWith({
      householdId: HH,
      actorId: USER,
      action: 'CATEGORY_UPDATED',
      subjectType: 'Category',
      subjectId: CATEGORY,
      meta: { fields: ['name', 'archived', 'privacy'] },
    });
  });

  it('restores an archived category when its name is free', async () => {
    const archived = makeCategory({ archivedAt: ARCHIVED_AT });
    categoryRepo.findById.mockResolvedValue(archived);
    categoryRepo.list.mockResolvedValue([SYSTEM]);
    privacyRepo.listByHousehold.mockResolvedValue([]);

    await useCase().execute({
      categoryId: CATEGORY,
      changes: { archived: false },
      userId: USER,
      householdId: HH,
    });

    expect(categoryRepo.update).not.toHaveBeenCalled();
    expect(categoryRepo.setArchivedAt).toHaveBeenCalledWith(CATEGORY, null, SCOPE);
  });

  it('rejects a rename onto another active name', async () => {
    categoryRepo.findById.mockResolvedValue(makeCategory());
    categoryRepo.list.mockResolvedValue([makeCategory(), SYSTEM]);

    await expect(
      useCase().execute({
        categoryId: CATEGORY,
        changes: { name: 'GROCERIES' },
        userId: USER,
        householdId: HH,
      }),
    ).rejects.toThrow('CATEGORY_DUPLICATE');
    expect(categoryRepo.update).not.toHaveBeenCalled();
  });

  it('rejects changes to a system category', async () => {
    categoryRepo.findById.mockResolvedValue(SYSTEM);

    await expect(
      useCase().execute({
        categoryId: SYSTEM.id,
        changes: { privacy: 'total_only' },
        userId: USER,
        householdId: HH,
      }),
    ).rejects.toThrow('CATEGORY_READ_ONLY');
    expect(privacyRepo.set).not.toHaveBeenCalled();
  });

  it("rejects another household's category", async () => {
    categoryRepo.findById.mockResolvedValue(null);

    await expect(
      useCase().execute({
        categoryId: CATEGORY,
        changes: { name: 'x' },
        userId: USER,
        householdId: HH,
      }),
    ).rejects.toThrow('CATEGORY_NOT_FOUND');
  });

  it('fails when the category disappears before the reload', async () => {
    categoryRepo.findById.mockResolvedValueOnce(makeCategory()).mockResolvedValueOnce(null);
    privacyRepo.listByHousehold.mockResolvedValue([]);

    await expect(
      useCase().execute({
        categoryId: CATEGORY,
        changes: { color: '#000000' },
        userId: USER,
        householdId: HH,
      }),
    ).rejects.toThrow('CATEGORY_NOT_FOUND');
  });

  it('defaults the clock to now', async () => {
    categoryRepo.findById.mockResolvedValue(makeCategory());
    privacyRepo.listByHousehold.mockResolvedValue([]);

    await new UpdateCategoryUseCase(categoryRepo, privacyRepo, auditLogger).execute({
      categoryId: CATEGORY,
      changes: { archived: true },
      userId: USER,
      householdId: HH,
    });

    expect(categoryRepo.setArchivedAt).toHaveBeenCalledOnce();
  });
});
