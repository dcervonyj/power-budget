import React, { useState } from 'react';
import { FormattedMessage } from 'react-intl';
import { useTheme } from './ThemeContext.js';
import { Button } from './Button.js';
import { apiClient } from '../../AppProviders.js';

export interface BulkActionBarProps {
  readonly selectedIds: ReadonlyArray<string>;
  readonly onMapAll: () => void;
  readonly onClear: () => void;
  readonly onActionComplete?: () => void;
}

export function BulkActionBar({
  selectedIds,
  onMapAll,
  onClear,
  onActionComplete,
}: BulkActionBarProps): React.JSX.Element | null {
  const theme = useTheme();
  const [loadingAction, setLoadingAction] = useState<'mark_transfer' | 'ignore' | null>(null);

  const count = selectedIds.length;

  if (count === 0) return null;

  const handleBulkAction = async (action: 'mark_transfer' | 'ignore'): Promise<void> => {
    setLoadingAction(action);
    try {
      await apiClient.post('/transactions/bulk', { action, ids: Array.from(selectedIds) });
      onActionComplete?.();
      onClear();
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div
      style={{
        position: 'sticky',
        bottom: 0,
        backgroundColor: theme.color.surface.raised,
        borderTop: `1px solid ${theme.color.border.subtle}`,
        padding: `${theme.space.md}px ${theme.space.lg}px`,
        display: 'flex',
        alignItems: 'center',
        gap: theme.space.md,
        zIndex: 100,
      }}
    >
      <span
        style={{
          color: theme.color.text.secondary,
          fontSize: theme.fontSize.sm,
          marginRight: 'auto',
        }}
      >
        <FormattedMessage
          id="bulk.selected"
          defaultMessage="{count, plural, one {# selected} other {# selected}}"
          values={{ count }}
        />
      </span>

      <Button variant="primary" onClick={onMapAll}>
        <FormattedMessage id="bulk.mapAll" defaultMessage="Map all ({count})" values={{ count }} />
      </Button>

      <Button
        variant="secondary"
        onClick={() => void handleBulkAction('mark_transfer')}
        loading={loadingAction === 'mark_transfer'}
      >
        <FormattedMessage
          id="bulk.markAsTransfer"
          defaultMessage="Mark as Transfer ({count})"
          values={{ count }}
        />
      </Button>

      <Button
        variant="secondary"
        onClick={() => void handleBulkAction('ignore')}
        loading={loadingAction === 'ignore'}
      >
        <FormattedMessage id="bulk.ignore" defaultMessage="Ignore ({count})" values={{ count }} />
      </Button>

      <Button variant="secondary" onClick={onClear}>
        <FormattedMessage id="bulk.clear" defaultMessage="Clear" />
      </Button>
    </div>
  );
}
