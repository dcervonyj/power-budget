import React, { useCallback, useEffect, useState } from 'react';
import { readApiError } from '@power-budget/shared-app';
import type {
  CategoryDto,
  CategoryKindDto,
  UpdateCategoryDto,
} from '@power-budget/shared-app/contract';
import { categoriesApi } from '../../../AppProviders.js';
import { CategoriesView, type CategoryActionError } from './CategoriesView.js';

type LoadState = 'loading' | 'idle' | 'error';

function toActionError(err: unknown): CategoryActionError {
  switch (readApiError(err).status) {
    case 409:
      return 'nameTaken';
    case 403:
      return 'readOnly';
    default:
      return 'failed';
  }
}

function replaceCategory(list: CategoryDto[], next: CategoryDto): CategoryDto[] {
  return list.map((category) => (category.id === next.id ? next : category));
}

export function CategoriesScreen(): React.JSX.Element {
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [adding, setAdding] = useState(false);
  const [actionError, setActionError] = useState<CategoryActionError | null>(null);

  const fetchCategories = useCallback(async (): Promise<void> => {
    setLoadState('loading');
    try {
      // Archived categories are listed too, so they can be restored.
      setCategories(await categoriesApi.list({ includeArchived: true }));
      setLoadState('idle');
    } catch {
      setLoadState('error');
    }
  }, []);

  useEffect(() => {
    void fetchCategories();
  }, [fetchCategories]);

  const update = useCallback(
    async (category: CategoryDto, changes: UpdateCategoryDto): Promise<void> => {
      setActionError(null);
      setCategories((prev) => replaceCategory(prev, { ...category, ...changes }));
      try {
        const updated = await categoriesApi.update(category.id, changes);
        setCategories((prev) => replaceCategory(prev, updated));
      } catch (err) {
        setCategories((prev) => replaceCategory(prev, category));
        setActionError(toActionError(err));
      }
    },
    [],
  );

  async function add(name: string, kind: CategoryKindDto): Promise<boolean> {
    setAdding(true);
    setActionError(null);
    try {
      const created = await categoriesApi.create({ name, kind });
      setCategories((prev) => [...prev, created]);

      return true;
    } catch (err) {
      setActionError(toActionError(err));

      return false;
    } finally {
      setAdding(false);
    }
  }

  function handleUpdate(category: CategoryDto, changes: UpdateCategoryDto): void {
    void update(category, changes);
  }

  function retry(): void {
    void fetchCategories();
  }

  return (
    <CategoriesView
      categories={categories}
      loading={loadState === 'loading'}
      loadFailed={loadState === 'error'}
      actionError={actionError}
      adding={adding}
      onRetry={retry}
      onUpdate={handleUpdate}
      onAdd={add}
    />
  );
}
