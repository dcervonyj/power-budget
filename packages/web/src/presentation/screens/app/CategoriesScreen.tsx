import React, { useState, useEffect, useCallback } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { isCategoryEditable, readApiError } from '@power-budget/shared-app';
import type { SelectOption } from '@power-budget/shared-app';
import type {
  CategoryDto,
  CategoryKindDto,
  CategoryPrivacyDto,
  UpdateCategoryDto,
} from '@power-budget/shared-app/contract';
import { categoriesApi } from '../../../AppProviders.js';
import { useTheme } from '../../components/ThemeContext.js';
import { Button } from '../../components/Button.js';
import { Select } from '../../components/Select.js';

type LoadState = 'loading' | 'idle' | 'error';

/** Why the last change was rejected: 409 name taken, 403 read-only, else a failure. */
type ActionError = 'nameTaken' | 'readOnly' | 'failed';

function toActionError(err: unknown): ActionError {
  switch (readApiError(err).status) {
    case 409:
      return 'nameTaken';
    case 403:
      return 'readOnly';
    default:
      return 'failed';
  }
}

interface CategoryRowProps {
  readonly category: CategoryDto;
  readonly onUpdate: (category: CategoryDto, changes: UpdateCategoryDto) => Promise<void>;
}

function CategoryRow({ category, onUpdate }: CategoryRowProps): React.JSX.Element {
  const theme = useTheme();
  const intl = useIntl();
  const [draftName, setDraftName] = useState(category.name);
  const editable = isCategoryEditable(category);

  useEffect(() => {
    setDraftName(category.name);
  }, [category.name]);

  const privacyOptions: ReadonlyArray<SelectOption<CategoryPrivacyDto>> = [
    {
      value: 'full_detail',
      label: intl.formatMessage({
        id: 'screen.categories.privacy.fullDetail',
        defaultMessage: 'Full detail',
      }),
    },
    {
      value: 'total_with_counts',
      label: intl.formatMessage({
        id: 'screen.categories.privacy.totalWithCounts',
        defaultMessage: 'Totals and counts',
      }),
    },
    {
      value: 'total_only',
      label: intl.formatMessage({
        id: 'screen.categories.privacy.totalOnly',
        defaultMessage: 'Totals only',
      }),
    },
  ];

  const handleBlur = (): void => {
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== category.name) {
      void onUpdate(category, { name: trimmed });
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

  const kindLabel =
    category.kind === 'income'
      ? intl.formatMessage({ id: 'screen.categories.kind.income', defaultMessage: 'Income' })
      : intl.formatMessage({ id: 'screen.categories.kind.expense', defaultMessage: 'Expense' });

  if (!editable) {
    // Seeded system categories are shared by every household and cannot be changed.
    return (
      <div style={rowStyle} data-testid={`category-row-${category.id}`}>
        <span style={{ flex: 1, color: theme.color.text.primary }}>{category.name}</span>
        <span style={{ color: theme.color.text.secondary, fontSize: theme.fontSize.sm }}>
          {kindLabel}
        </span>
        <span style={{ color: theme.color.text.muted, fontSize: theme.fontSize.sm }}>
          <FormattedMessage id="screen.categories.system" defaultMessage="Built-in" />
        </span>
      </div>
    );
  }

  return (
    <div style={rowStyle} data-testid={`category-row-${category.id}`}>
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

      <span style={{ color: theme.color.text.secondary, fontSize: theme.fontSize.sm }}>
        {kindLabel}
      </span>

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
            void onUpdate(category, { archived: e.target.checked });
          }}
          style={{ cursor: 'pointer' }}
        />
        <FormattedMessage id="screen.categories.archive.label" defaultMessage="Archived" />
      </label>

      <Select<CategoryPrivacyDto>
        options={privacyOptions}
        value={category.privacy}
        onChange={(privacy) => {
          void onUpdate(category, { privacy });
        }}
        id={`privacy-${category.id}`}
      />
    </div>
  );
}

export function CategoriesScreen(): React.JSX.Element {
  const theme = useTheme();
  const intl = useIntl();
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryKind, setNewCategoryKind] = useState<CategoryKindDto>('expense');
  const [isAdding, setIsAdding] = useState(false);
  const [actionError, setActionError] = useState<ActionError | null>(null);

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

  const handleUpdate = useCallback(
    async (category: CategoryDto, changes: UpdateCategoryDto): Promise<void> => {
      setActionError(null);
      setCategories((prev) => prev.map((c) => (c.id === category.id ? { ...c, ...changes } : c)));
      try {
        const updated = await categoriesApi.update(category.id, changes);
        setCategories((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      } catch (err) {
        setCategories((prev) => prev.map((c) => (c.id === category.id ? category : c)));
        setActionError(toActionError(err));
      }
    },
    [],
  );

  const handleAdd = async (): Promise<void> => {
    const name = newCategoryName.trim();
    if (!name) return;
    setIsAdding(true);
    setActionError(null);
    try {
      const created = await categoriesApi.create({ name, kind: newCategoryKind });
      setCategories((prev) => [...prev, created]);
      setNewCategoryName('');
    } catch (err) {
      setActionError(toActionError(err));
    } finally {
      setIsAdding(false);
    }
  };

  const handleAddKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      void handleAdd();
    }
  };

  const kindOptions: ReadonlyArray<SelectOption<CategoryKindDto>> = [
    {
      value: 'expense',
      label: intl.formatMessage({
        id: 'screen.categories.kind.expense',
        defaultMessage: 'Expense',
      }),
    },
    {
      value: 'income',
      label: intl.formatMessage({ id: 'screen.categories.kind.income', defaultMessage: 'Income' }),
    },
  ];

  const actionErrorMessage = (error: ActionError): string => {
    switch (error) {
      case 'nameTaken':
        return intl.formatMessage({
          id: 'screen.categories.error.nameTaken',
          defaultMessage: 'A category with this name already exists.',
        });
      case 'readOnly':
        return intl.formatMessage({
          id: 'screen.categories.error.readOnly',
          defaultMessage: 'Built-in categories cannot be changed.',
        });
      case 'failed':
        return intl.formatMessage({
          id: 'screen.categories.error.saveFailed',
          defaultMessage: 'Could not save the category. Please try again.',
        });
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

      {actionError !== null && (
        <p
          role="alert"
          style={{ color: theme.color.status.danger, margin: `0 0 ${theme.space.md}px` }}
        >
          {actionErrorMessage(actionError)}
        </p>
      )}

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
            <FormattedMessage id="screen.categories.kind.label" defaultMessage="Type" />
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
            <CategoryRow key={cat.id} category={cat} onUpdate={handleUpdate} />
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
        <Select<CategoryKindDto>
          id="new-category-kind"
          options={kindOptions}
          value={newCategoryKind}
          onChange={setNewCategoryKind}
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
