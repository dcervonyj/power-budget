import React, { useState, useEffect, useCallback } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { apiClient } from '../../../AppProviders.js';
import { useTheme } from '../../components/ThemeContext.js';
import { Button } from '../../components/Button.js';
import { Select } from '../../components/Select.js';
import type { Category, CategoryPrivacy } from '../../components/CategoryPickerModal.js';
import type { SelectOption } from '@power-budget/shared-app';

type LoadState = 'loading' | 'idle' | 'error';

interface CategoryRowProps {
  readonly category: Category;
  readonly onRename: (id: string, name: string) => Promise<void>;
  readonly onArchiveToggle: (id: string, archived: boolean) => Promise<void>;
  readonly onPrivacyChange: (id: string, privacy: CategoryPrivacy) => Promise<void>;
}

function CategoryRow({
  category,
  onRename,
  onArchiveToggle,
  onPrivacyChange,
}: CategoryRowProps): React.JSX.Element {
  const theme = useTheme();
  const intl = useIntl();
  const [draftName, setDraftName] = useState(category.name);

  useEffect(() => {
    setDraftName(category.name);
  }, [category.name]);

  const privacyOptions: ReadonlyArray<SelectOption<CategoryPrivacy>> = [
    {
      value: 'private',
      label: intl.formatMessage({
        id: 'screen.categories.privacy.private',
        defaultMessage: 'Private',
      }),
    },
    {
      value: 'shared',
      label: intl.formatMessage({
        id: 'screen.categories.privacy.shared',
        defaultMessage: 'Shared',
      }),
    },
    {
      value: 'full_detail',
      label: intl.formatMessage({
        id: 'screen.categories.privacy.fullDetail',
        defaultMessage: 'Full Detail',
      }),
    },
  ];

  const handleBlur = (): void => {
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== category.name) {
      void onRename(category.id, trimmed);
    } else {
      setDraftName(category.name);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      setDraftName(category.name);
      e.currentTarget.blur();
    }
  };

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: theme.space.md,
    padding: `${theme.space.sm}px ${theme.space.md}px`,
    borderBottom: `1px solid ${theme.color.border.subtle}`,
    opacity: category.archived ? 0.6 : 1,
  };

  return (
    <div style={rowStyle}>
      <input
        type="text"
        value={draftName}
        onChange={(e) => {
          setDraftName(e.target.value);
        }}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        aria-label={intl.formatMessage({
          id: 'screen.categories.rename.label',
          defaultMessage: 'Category name',
        })}
        style={{
          flex: 1,
          backgroundColor: theme.color.surface.raised,
          color: category.archived ? theme.color.text.muted : theme.color.text.primary,
          textDecoration: category.archived ? 'line-through' : 'none',
          border: `1px solid ${theme.color.border.subtle}`,
          borderRadius: theme.radius.sm,
          padding: `${theme.space.xs}px ${theme.space.sm}px`,
          fontSize: theme.fontSize.md,
          fontFamily: theme.fontFamily.sans,
          minWidth: 0,
        }}
      />

      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: theme.space.xs,
          color: theme.color.text.secondary,
          fontSize: theme.fontSize.sm,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        <input
          type="checkbox"
          checked={category.archived}
          onChange={(e) => {
            void onArchiveToggle(category.id, e.target.checked);
          }}
          style={{ cursor: 'pointer' }}
        />
        <FormattedMessage id="screen.categories.archive.label" defaultMessage="Archived" />
      </label>

      <Select<CategoryPrivacy>
        options={privacyOptions}
        value={category.privacy}
        onChange={(privacy) => {
          void onPrivacyChange(category.id, privacy);
        }}
        id={`privacy-${category.id}`}
      />
    </div>
  );
}

export function CategoriesScreen(): React.JSX.Element {
  const theme = useTheme();
  const intl = useIntl();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const fetchCategories = useCallback(async (): Promise<void> => {
    setLoadState('loading');
    try {
      const res = await apiClient.get<Category[]>('/categories');
      setCategories(res.data);
      setLoadState('idle');
    } catch {
      setLoadState('error');
    }
  }, []);

  useEffect(() => {
    void fetchCategories();
  }, [fetchCategories]);

  const handleRename = useCallback(async (id: string, name: string): Promise<void> => {
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)));
    await apiClient.request<Category>({
      url: `/categories/${id}`,
      method: 'PATCH',
      body: { name },
    });
  }, []);

  const handleArchiveToggle = useCallback(async (id: string, archived: boolean): Promise<void> => {
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, archived } : c)));
    await apiClient.request<Category>({
      url: `/categories/${id}`,
      method: 'PATCH',
      body: { archived },
    });
  }, []);

  const handlePrivacyChange = useCallback(
    async (id: string, privacy: CategoryPrivacy): Promise<void> => {
      setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, privacy } : c)));
      await apiClient.request<Category>({
        url: `/categories/${id}`,
        method: 'PATCH',
        body: { privacy },
      });
    },
    [],
  );

  const handleAdd = async (): Promise<void> => {
    const name = newCategoryName.trim();
    if (!name) return;
    setIsAdding(true);
    try {
      const res = await apiClient.post<Category>('/categories', { name });
      setCategories((prev) => [...prev, res.data]);
      setNewCategoryName('');
    } finally {
      setIsAdding(false);
    }
  };

  const handleAddKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      void handleAdd();
    }
  };

  const containerStyle: React.CSSProperties = {
    padding: theme.space.xl,
    color: theme.color.text.primary,
    fontFamily: theme.fontFamily.sans,
    maxWidth: 800,
  };

  if (loadState === 'loading') {
    return (
      <div style={{ ...containerStyle, color: theme.color.text.secondary }}>
        <FormattedMessage id="screen.categories.loading" defaultMessage="Loading categories…" />
      </div>
    );
  }

  if (loadState === 'error') {
    return (
      <div style={{ ...containerStyle, color: theme.color.status.danger }}>
        <FormattedMessage
          id="screen.categories.error"
          defaultMessage="Failed to load categories. Please try again."
        />
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <h1
        style={{
          margin: `0 0 ${theme.space.xl}px`,
          fontSize: theme.fontSize['2xl'],
          fontWeight: theme.fontWeight.semibold,
          color: theme.color.text.primary,
        }}
      >
        <FormattedMessage id="screen.categories.title" defaultMessage="Categories" />
      </h1>

      <div
        style={{
          backgroundColor: theme.color.surface.raised,
          borderRadius: theme.radius.md,
          border: `1px solid ${theme.color.border.subtle}`,
          overflow: 'hidden',
          marginBottom: theme.space.lg,
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: theme.space.md,
            padding: `${theme.space.sm}px ${theme.space.md}px`,
            backgroundColor: theme.color.surface.mid,
            borderBottom: `1px solid ${theme.color.border.subtle}`,
            fontSize: theme.fontSize.sm,
            fontWeight: theme.fontWeight.semibold,
            color: theme.color.text.secondary,
          }}
        >
          <span style={{ flex: 1 }}>
            <FormattedMessage id="screen.categories.rename.label" defaultMessage="Name" />
          </span>
          <span>
            <FormattedMessage id="screen.categories.archive.label" defaultMessage="Archived" />
          </span>
          <span>
            <FormattedMessage id="screen.categories.privacy.label" defaultMessage="Privacy" />
          </span>
        </div>

        {categories.length === 0 ? (
          <div
            style={{
              padding: `${theme.space.xl}px ${theme.space.md}px`,
              color: theme.color.text.muted,
              textAlign: 'center',
            }}
          >
            <FormattedMessage
              id="screen.categories.empty"
              defaultMessage="No categories yet. Add one below."
            />
          </div>
        ) : (
          categories.map((cat) => (
            <CategoryRow
              key={cat.id}
              category={cat}
              onRename={handleRename}
              onArchiveToggle={handleArchiveToggle}
              onPrivacyChange={handlePrivacyChange}
            />
          ))
        )}
      </div>

      <div style={{ display: 'flex', gap: theme.space.sm, alignItems: 'center' }}>
        <input
          type="text"
          value={newCategoryName}
          onChange={(e) => {
            setNewCategoryName(e.target.value);
          }}
          onKeyDown={handleAddKeyDown}
          placeholder={intl.formatMessage({
            id: 'screen.categories.add.placeholder',
            defaultMessage: 'New category name',
          })}
          aria-label={intl.formatMessage({
            id: 'screen.categories.add.placeholder',
            defaultMessage: 'New category name',
          })}
          style={{
            flex: 1,
            backgroundColor: theme.color.surface.raised,
            color: theme.color.text.primary,
            border: `1px solid ${theme.color.border.subtle}`,
            borderRadius: theme.radius.sm,
            padding: `${theme.space.sm}px ${theme.space.md}px`,
            fontSize: theme.fontSize.md,
            fontFamily: theme.fontFamily.sans,
          }}
        />
        <Button
          onClick={() => {
            void handleAdd();
          }}
          loading={isAdding}
        >
          <FormattedMessage id="screen.categories.add" defaultMessage="Add category" />
        </Button>
      </div>
    </div>
  );
}
