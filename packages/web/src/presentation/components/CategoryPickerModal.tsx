import React, { useState, useEffect } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { apiClient } from '../../AppProviders.js';
import { useTheme } from './ThemeContext.js';
import { Modal } from './Modal.js';

export type CategoryPrivacy = 'private' | 'shared' | 'full_detail';

export interface Category {
  readonly id: string;
  readonly name: string;
  readonly archived: boolean;
  readonly privacy: CategoryPrivacy;
}

export interface CategoryPickerModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSelect: (category: Category) => void;
  readonly categories?: Category[];
}

export function CategoryPickerModal({
  isOpen,
  onClose,
  onSelect,
  categories: categoriesProp,
}: CategoryPickerModalProps): React.JSX.Element | null {
  const theme = useTheme();
  const intl = useIntl();
  const [search, setSearch] = useState('');
  const [fetchedCategories, setFetchedCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || categoriesProp !== undefined) return;
    let cancelled = false;
    setLoading(true);
    void apiClient.get<Category[]>('/categories').then((res) => {
      if (!cancelled) {
        setFetchedCategories(res.data);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, categoriesProp]);

  const categories = categoriesProp ?? fetchedCategories;
  const filtered = categories.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));

  const title = intl.formatMessage({
    id: 'modal.categoryPicker.title',
    defaultMessage: 'Pick a category',
  });

  return (
    <Modal title={title} isOpen={isOpen} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space.md }}>
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
          }}
          placeholder={intl.formatMessage({
            id: 'modal.categoryPicker.search.placeholder',
            defaultMessage: 'Search categories…',
          })}
          aria-label={intl.formatMessage({
            id: 'modal.categoryPicker.search.placeholder',
            defaultMessage: 'Search categories…',
          })}
          style={{
            backgroundColor: theme.color.surface.raised,
            color: theme.color.text.primary,
            border: `1px solid ${theme.color.border.subtle}`,
            borderRadius: theme.radius.sm,
            padding: `${theme.space.sm}px ${theme.space.md}px`,
            fontSize: theme.fontSize.md,
            boxSizing: 'border-box',
            width: '100%',
          }}
        />
        <div
          style={{
            maxHeight: 320,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: theme.space.xs,
          }}
        >
          {loading ? (
            <span style={{ color: theme.color.text.secondary, padding: `${theme.space.md}px 0` }}>
              <FormattedMessage
                id="screen.categories.loading"
                defaultMessage="Loading categories…"
              />
            </span>
          ) : filtered.length === 0 ? (
            <span style={{ color: theme.color.text.secondary, padding: `${theme.space.md}px 0` }}>
              <FormattedMessage
                id="modal.categoryPicker.empty"
                defaultMessage="No categories found."
              />
            </span>
          ) : (
            filtered.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  onSelect(cat);
                  onClose();
                }}
                style={{
                  background: 'none',
                  border: `1px solid ${theme.color.border.subtle}`,
                  borderRadius: theme.radius.sm,
                  padding: `${theme.space.sm}px ${theme.space.md}px`,
                  cursor: 'pointer',
                  color: cat.archived ? theme.color.text.muted : theme.color.text.primary,
                  textDecoration: cat.archived ? 'line-through' : 'none',
                  textAlign: 'left',
                  fontSize: theme.fontSize.md,
                  width: '100%',
                  fontFamily: theme.fontFamily.sans,
                }}
              >
                {cat.name}
              </button>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
}
