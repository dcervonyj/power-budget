import React, { useEffect, useState } from 'react';
import { FormattedMessage, useIntl, type IntlShape } from 'react-intl';
import { isCategoryEditable } from '@power-budget/shared-app';
import type { SelectOption } from '@power-budget/shared-app';
import type {
  CategoryDto,
  CategoryKindDto,
  CategoryPrivacyDto,
  UpdateCategoryDto,
} from '@power-budget/shared-app/contract';
import { Button } from '../../components/Button.js';
import { Input } from '../../components/Input.js';
import { Select } from '../../components/Select.js';
import { EmptyState } from '../../components/shared/EmptyState.js';
import { ErrorBanner } from '../../components/shared/ErrorBanner.js';
import { SkeletonList } from '../../components/shared/SkeletonList.js';
import { Icon } from '../../glass/atoms/Icon.js';
import { ICON_NAMES, type IconName } from '../../glass/atoms/iconPaths.js';
import { StatusTag } from '../../glass/atoms/StatusTag.js';
import '../../glass/controls/controls.css';
import { GlassPanel } from '../../glass/material/GlassPanel.js';
import {
  ROW_STYLE,
  SMALL_STYLE,
  TITLE_STYLE as ROW_TITLE_STYLE,
} from '../../glass/rows/rowStyles.js';
import {
  HEADER_STYLE,
  PAGE_STYLE,
  PANEL_CONTENT_STYLE,
  PANEL_TITLE_STYLE,
  TITLE_STYLE,
} from './planStyles.js';

/** Why the last change was rejected: 409 name taken, 403 read-only, else a failure. */
export type CategoryActionError = 'nameTaken' | 'readOnly' | 'failed';

export interface CategoriesViewProps {
  readonly categories: readonly CategoryDto[];
  readonly loading: boolean;
  readonly loadFailed: boolean;
  readonly actionError: CategoryActionError | null;
  readonly adding: boolean;
  readonly onRetry: () => void;
  readonly onUpdate: (category: CategoryDto, changes: UpdateCategoryDto) => void;
  /** Resolves true when the category was created, so the form can clear. */
  readonly onAdd: (name: string, kind: CategoryKindDto) => Promise<boolean>;
}

const LIST_STYLE: React.CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--pb-glass-space-xs)',
};

const CATEGORY_ROW_STYLE: React.CSSProperties = {
  ...ROW_STYLE,
  flexDirection: 'row',
  alignItems: 'center',
  flexWrap: 'wrap',
};

const TILE_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  flex: 'none',
  alignItems: 'center',
  justifyContent: 'center',
  width: 44,
  height: 44,
  borderRadius: 'var(--pb-glass-radius-tile)',
  background: 'var(--pb-glass-fill2)',
  boxShadow: 'inset 0 0 0 1px var(--pb-glass-edge)',
  color: 'var(--pb-glass-fg)',
};

const TEXT_STYLE: React.CSSProperties = {
  flex: '1 1 160px',
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  overflowWrap: 'anywhere',
};

const TAGS_STYLE: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 'var(--pb-glass-space-xs)',
};

const EDIT_BUTTON_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--pb-glass-space-xs)',
  minHeight: 44,
  padding: '0 var(--pb-glass-space-md)',
  border: 'none',
  borderRadius: 'var(--pb-glass-radius-control)',
  background: 'var(--pb-glass-clear)',
  boxShadow: 'var(--pb-glass-clear-rim)',
  color: 'var(--pb-glass-fg)',
  fontSize: 'var(--pb-glass-type-label-web)',
  fontWeight: 'var(--pb-glass-type-label-weight)',
  cursor: 'pointer',
};

const EDIT_FIELDS_STYLE: React.CSSProperties = {
  flex: '1 1 100%',
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
  gap: 'var(--pb-glass-space-md)',
  alignItems: 'end',
};

const NAME_INPUT_STYLE: React.CSSProperties = {
  boxSizing: 'border-box',
  width: '100%',
  minHeight: 44,
  padding: '0 var(--pb-glass-space-md)',
  border: 'none',
  borderRadius: 'var(--pb-glass-radius-control)',
  background: 'var(--pb-glass-fill)',
  boxShadow: 'inset 0 0 0 1px var(--pb-glass-edge)',
  color: 'var(--pb-glass-fg)',
  fontFamily: 'inherit',
  fontSize: 'var(--pb-glass-type-body-web)',
};

const CHECK_LABEL_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--pb-glass-space-xs)',
  minHeight: 44,
  fontSize: 'var(--pb-glass-type-body-web)',
  cursor: 'pointer',
};

const ADD_FORM_STYLE: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
  gap: 'var(--pb-glass-space-md)',
  alignItems: 'end',
};

/** Categories: icon tile, name, privacy in words and an edit action per row (props only). */
export function CategoriesView({
  categories,
  loading,
  loadFailed,
  actionError,
  adding,
  onRetry,
  onUpdate,
  onAdd,
}: CategoriesViewProps): React.JSX.Element {
  return (
    <div style={PAGE_STYLE}>
      <header style={HEADER_STYLE}>
        <h1 style={TITLE_STYLE}>
          <FormattedMessage id="screen.categories.title" defaultMessage="Categories" />
        </h1>
      </header>

      {actionError !== null && <ErrorBanner message={<ActionErrorText error={actionError} />} />}

      {loading && <SkeletonList rows={4} rowHeight={72} />}

      {loadFailed && !loading && (
        <ErrorBanner
          message={
            <FormattedMessage
              id="screen.categories.error"
              defaultMessage="Failed to load categories. Please try again."
            />
          }
          onRetry={onRetry}
        />
      )}

      {!loading && !loadFailed && (
        <GlassPanel
          material="frosted"
          depth={1}
          rise={0}
          decor={{ specular: true }}
          contentStyle={PANEL_CONTENT_STYLE}
        >
          {categories.length === 0 ? (
            <EmptyState
              title={
                <FormattedMessage
                  id="screen.categories.empty"
                  defaultMessage="No categories yet. Add one below."
                />
              }
            />
          ) : (
            <ul style={LIST_STYLE}>
              {categories.map((category) => (
                <li key={category.id}>
                  <CategoryItem category={category} onUpdate={onUpdate} />
                </li>
              ))}
            </ul>
          )}
        </GlassPanel>
      )}

      {!loading && !loadFailed && <AddCategoryForm adding={adding} onAdd={onAdd} />}
    </div>
  );
}

function CategoryItem({
  category,
  onUpdate,
}: {
  category: CategoryDto;
  onUpdate: (category: CategoryDto, changes: UpdateCategoryDto) => void;
}): React.JSX.Element {
  const intl = useIntl();
  const [editing, setEditing] = useState(false);
  const editable = isCategoryEditable(category);
  // Seeded system categories are shared by every household and cannot be changed.
  const canEdit = editable && !editing;

  return (
    <div
      style={{ ...CATEGORY_ROW_STYLE, opacity: category.archived ? 0.7 : 1 }}
      data-testid={`category-row-${category.id}`}
    >
      <span style={TILE_STYLE}>
        <Icon name={iconOf(category.icon)} size={22} />
      </span>
      <div style={TEXT_STYLE}>
        <span
          style={{
            ...ROW_TITLE_STYLE,
            textDecoration: category.archived ? 'line-through' : 'none',
          }}
        >
          {category.name}
        </span>
        <span style={SMALL_STYLE}>
          <KindText kind={category.kind} />
        </span>
      </div>
      <div style={TAGS_STYLE}>
        <StatusTag kind="neutral" icon="lock" label={privacyLabel(intl, category.privacy)} />
        {category.archived && (
          <StatusTag
            kind="neutral"
            icon="clock"
            label={intl.formatMessage({
              id: 'screen.categories.archive.label',
              defaultMessage: 'Archived',
            })}
          />
        )}
        {!editable && (
          <StatusTag
            kind="neutral"
            icon="check"
            label={intl.formatMessage({
              id: 'screen.categories.system',
              defaultMessage: 'Built-in',
            })}
          />
        )}
      </div>
      {canEdit && (
        <button
          type="button"
          className="pbg-ctl"
          style={EDIT_BUTTON_STYLE}
          aria-label={intl.formatMessage(
            { id: 'categories.editAria', defaultMessage: 'Edit {name}' },
            { name: category.name },
          )}
          onClick={() => {
            setEditing(true);
          }}
        >
          <Icon name="edit" size={18} />
          <FormattedMessage id="categories.edit" defaultMessage="Edit" />
        </button>
      )}
      {editable && editing && (
        <CategoryEditor
          category={category}
          onUpdate={onUpdate}
          onDone={() => {
            setEditing(false);
          }}
        />
      )}
    </div>
  );
}

function CategoryEditor({
  category,
  onUpdate,
  onDone,
}: {
  category: CategoryDto;
  onUpdate: (category: CategoryDto, changes: UpdateCategoryDto) => void;
  onDone: () => void;
}): React.JSX.Element {
  const intl = useIntl();
  const [draftName, setDraftName] = useState(category.name);

  // A rejected rename rolls the category back; keep the field in step with it.
  useEffect(() => {
    setDraftName(category.name);
  }, [category.name]);

  function commitName(): void {
    const trimmed = draftName.trim();
    if (trimmed !== '' && trimmed !== category.name) {
      onUpdate(category, { name: trimmed });
    } else {
      setDraftName(category.name);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Enter') {
      event.currentTarget.blur();
    } else if (event.key === 'Escape') {
      setDraftName(category.name);
      event.currentTarget.blur();
    }
  }

  return (
    <div style={EDIT_FIELDS_STYLE}>
      <input
        type="text"
        value={draftName}
        onChange={(event) => {
          setDraftName(event.target.value);
        }}
        onBlur={commitName}
        onKeyDown={handleKeyDown}
        aria-label={intl.formatMessage({
          id: 'screen.categories.rename.label',
          defaultMessage: 'Category name',
        })}
        className="pbg-ctl pbg-ctl-field"
        style={NAME_INPUT_STYLE}
      />
      <Select<CategoryPrivacyDto>
        id={`privacy-${category.id}`}
        label={intl.formatMessage({
          id: 'screen.categories.privacy.label',
          defaultMessage: 'Privacy',
        })}
        options={privacyOptions(intl)}
        value={category.privacy}
        onChange={(privacy) => {
          onUpdate(category, { privacy });
        }}
      />
      <label style={CHECK_LABEL_STYLE}>
        <input
          type="checkbox"
          checked={category.archived}
          onChange={(event) => {
            onUpdate(category, { archived: event.target.checked });
          }}
          style={{ width: 20, height: 20, accentColor: 'var(--pb-glass-accent)' }}
        />
        <FormattedMessage id="screen.categories.archive.label" defaultMessage="Archived" />
      </label>
      <div>
        <Button variant="secondary" onClick={onDone}>
          <FormattedMessage id="categories.done" defaultMessage="Done" />
        </Button>
      </div>
    </div>
  );
}

function AddCategoryForm({
  adding,
  onAdd,
}: {
  adding: boolean;
  onAdd: (name: string, kind: CategoryKindDto) => Promise<boolean>;
}): React.JSX.Element {
  const intl = useIntl();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<CategoryKindDto>('expense');

  function handleSubmit(event: React.FormEvent): void {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed === '') {
      return;
    }
    void onAdd(trimmed, kind).then((created) => {
      if (created) {
        setName('');
      }
    });
  }

  return (
    <GlassPanel
      material="frosted"
      depth={1}
      rise={1}
      decor={{ specular: true }}
      contentStyle={PANEL_CONTENT_STYLE}
    >
      <form onSubmit={handleSubmit} style={{ display: 'contents' }}>
        <h2 style={PANEL_TITLE_STYLE}>
          <FormattedMessage id="categories.new.title" defaultMessage="New category" />
        </h2>
        <div style={ADD_FORM_STYLE}>
          <Input
            id="new-category-name"
            label={intl.formatMessage({
              id: 'screen.categories.add.placeholder',
              defaultMessage: 'New category name',
            })}
            placeholder={intl.formatMessage({
              id: 'screen.categories.add.placeholder',
              defaultMessage: 'New category name',
            })}
            value={name}
            onChange={setName}
          />
          <Select<CategoryKindDto>
            id="new-category-kind"
            label={intl.formatMessage({
              id: 'screen.categories.kind.label',
              defaultMessage: 'Type',
            })}
            options={kindOptions(intl)}
            value={kind}
            onChange={setKind}
          />
          <div>
            <Button type="submit" loading={adding}>
              <FormattedMessage id="screen.categories.add" defaultMessage="Add category" />
            </Button>
          </div>
        </div>
      </form>
    </GlassPanel>
  );
}

function KindText({ kind }: { kind: CategoryKindDto }): React.JSX.Element {
  return kind === 'income' ? (
    <FormattedMessage id="screen.categories.kind.income" defaultMessage="Income" />
  ) : (
    <FormattedMessage id="screen.categories.kind.expense" defaultMessage="Expense" />
  );
}

function ActionErrorText({ error }: { error: CategoryActionError }): React.JSX.Element {
  switch (error) {
    case 'nameTaken':
      return (
        <FormattedMessage
          id="screen.categories.error.nameTaken"
          defaultMessage="A category with this name already exists."
        />
      );
    case 'readOnly':
      return (
        <FormattedMessage
          id="screen.categories.error.readOnly"
          defaultMessage="Built-in categories cannot be changed."
        />
      );
    case 'failed':
      return (
        <FormattedMessage
          id="screen.categories.error.saveFailed"
          defaultMessage="Could not save the category. Please try again."
        />
      );
  }
}

function iconOf(icon: string): IconName {
  for (const name of ICON_NAMES) {
    if (name === icon) {
      return name;
    }
  }

  return 'tag';
}

function privacyLabel(intl: IntlShape, privacy: CategoryPrivacyDto): string {
  switch (privacy) {
    case 'full_detail':
      return intl.formatMessage({
        id: 'screen.categories.privacy.fullDetail',
        defaultMessage: 'Full detail',
      });
    case 'total_with_counts':
      return intl.formatMessage({
        id: 'screen.categories.privacy.totalWithCounts',
        defaultMessage: 'Totals and counts',
      });
    case 'total_only':
      return intl.formatMessage({
        id: 'screen.categories.privacy.totalOnly',
        defaultMessage: 'Totals only',
      });
  }
}

function privacyOptions(intl: IntlShape): ReadonlyArray<SelectOption<CategoryPrivacyDto>> {
  const levels: readonly CategoryPrivacyDto[] = ['full_detail', 'total_with_counts', 'total_only'];

  return levels.map((value) => ({ value, label: privacyLabel(intl, value) }));
}

function kindOptions(intl: IntlShape): ReadonlyArray<SelectOption<CategoryKindDto>> {
  return [
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
}
