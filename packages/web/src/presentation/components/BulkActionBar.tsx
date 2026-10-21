import React, { useState } from 'react';
import { FormattedMessage } from 'react-intl';
import { useTheme } from './ThemeContext.js';
import { Button } from './Button.js';
import { readApiError } from '@power-budget/shared-app';
import { bulkTransactionActions } from '../../AppProviders.js';
import type { BulkAction } from '../../application/transactions/BulkTransactionActions.js';

export interface BulkActionBarProps {
  readonly selectedIds: ReadonlyArray<string>;
  readonly onMapAll: () => void;
  readonly onClear: () => void;
  /** After the API applied the action to every selected transaction. */
  readonly onActionComplete?: () => void;
  /** A selected transaction is no longer the caller's (404): nothing was written. */
  readonly onGone?: () => void;
}

type Failure = 'mappedTransfer' | 'other';

export function BulkActionBar({
  selectedIds,
  onMapAll,
  onClear,
  onActionComplete,
  onGone,
}: BulkActionBarProps): React.JSX.Element | null {
  const theme = useTheme();
  const [loadingAction, setLoadingAction] = useState<BulkAction | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);

  const count = selectedIds.length;

  if (count === 0) return null;

  const handleBulkAction = async (action: BulkAction): Promise<void> => {
    setLoadingAction(action);
    setFailure(null);
    try {
      await bulkTransactionActions.apply(action, selectedIds);
      onActionComplete?.();
      onClear();
    } catch (err) {
      // All or nothing: nothing changed, so the selection stays for a retry.
      const { status, code } = readApiError(err);
      if (status === 404 && onGone) {
        onGone();
      } else {
        setFailure(code === 'already_mapped' ? 'mappedTransfer' : 'other');
      }
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
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: theme.space.sm,
        boxSizing: 'border-box',
        maxWidth: '100%',
        zIndex: 100,
      }}
    >
      <span
        style={{
          color: theme.color.text.secondary,
          fontSize: theme.fontSize.sm,
          marginRight: 'auto',
          flex: '1 1 auto',
        }}
      >
        <FormattedMessage
          id="bulk.selected"
          defaultMessage="{count, plural, one {# selected} other {# selected}}"
          values={{ count }}
        />
      </span>

      {failure !== null && (
        <span
          role="alert"
          style={{ color: theme.color.status.danger, fontSize: theme.fontSize.sm }}
        >
          {failure === 'mappedTransfer' ? (
            <FormattedMessage
              id="bulk.error.mappedTransfer"
              defaultMessage="Mapped transactions cannot be marked as transfers. Clear their mapping first."
            />
          ) : (
            <FormattedMessage
              id="bulk.error"
              defaultMessage="Some transactions could not be updated. Please try again."
            />
          )}
        </span>
      )}

      <Button variant="primary" onClick={onMapAll}>
        <FormattedMessage id="bulk.mapAll" defaultMessage="Map all ({count})" values={{ count }} />
      </Button>

      <Button
        variant="secondary"
        onClick={() => void handleBulkAction('transfer')}
        loading={loadingAction === 'transfer'}
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
