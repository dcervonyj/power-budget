import React, { useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import '../glass/controls/controls.css';
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

const BAR_STYLE: React.CSSProperties = {
  position: 'sticky',
  bottom: 'var(--pb-glass-space-md)',
  zIndex: 100,
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 'var(--pb-glass-space-sm)',
  boxSizing: 'border-box',
  maxWidth: '100%',
  marginTop: 'var(--pb-glass-space-lg)',
  padding: 'var(--pb-glass-space-sm) var(--pb-glass-space-lg)',
  borderRadius: 'var(--pb-glass-radius-panel)',
  background: 'var(--pb-glass-tint)',
  boxShadow: 'var(--pb-glass-tint-rim), var(--pb-glass-shadow-f)',
  backdropFilter: 'blur(var(--pb-glass-blur-web)) saturate(150%)',
  WebkitBackdropFilter: 'blur(var(--pb-glass-blur-web)) saturate(150%)',
  color: 'var(--pb-glass-fg)',
  fontSize: 'var(--pb-glass-type-small-web)',
};

const BUTTON_STYLE: React.CSSProperties = {
  minHeight: 44,
  padding: '0 var(--pb-glass-space-lg)',
  border: 'none',
  borderRadius: 'var(--pb-glass-radius-control)',
  background: 'var(--pb-glass-fill2)',
  boxShadow: 'var(--pb-glass-clear-rim)',
  color: 'var(--pb-glass-fg)',
  fontSize: 'var(--pb-glass-type-label-web)',
  fontWeight: 'var(--pb-glass-type-label-weight)',
  cursor: 'pointer',
};

const PRIMARY_STYLE: React.CSSProperties = {
  ...BUTTON_STYLE,
  background: 'var(--pb-glass-light-solid)',
  boxShadow: 'inset 0 0 0 1px var(--pb-glass-light-edge)',
  color: 'var(--pb-glass-accent-ink)',
};

interface BarButtonProps {
  readonly primary?: boolean;
  readonly busy?: boolean;
  readonly onPress: () => void;
  readonly children: React.ReactNode;
}

function BarButton({
  primary = false,
  busy = false,
  onPress,
  children,
}: BarButtonProps): React.JSX.Element {
  return (
    <button
      type="button"
      className="pbg-ctl"
      aria-busy={busy}
      disabled={busy}
      onClick={onPress}
      style={primary ? PRIMARY_STYLE : BUTTON_STYLE}
    >
      {children}
    </button>
  );
}

type Failure = 'mappedTransfer' | 'other';

export function BulkActionBar({
  selectedIds,
  onMapAll,
  onClear,
  onActionComplete,
  onGone,
}: BulkActionBarProps): React.JSX.Element | null {
  const intl = useIntl();
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
      role="toolbar"
      aria-label={intl.formatMessage({
        id: 'tx.bulk.toolbar',
        defaultMessage: 'Actions for the selected transactions',
      })}
      data-selected-count={count}
      style={BAR_STYLE}
    >
      <span style={{ marginRight: 'auto', flex: '1 1 auto' }}>
        <FormattedMessage
          id="bulk.selected"
          defaultMessage="{count, plural, one {# selected} other {# selected}}"
          values={{ count }}
        />
      </span>

      {failure !== null && (
        <span role="alert" style={{ color: 'var(--pb-glass-over)' }}>
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

      <BarButton primary onPress={onMapAll}>
        <FormattedMessage id="bulk.mapAll" defaultMessage="Map all ({count})" values={{ count }} />
      </BarButton>

      <BarButton
        onPress={() => void handleBulkAction('transfer')}
        busy={loadingAction === 'transfer'}
      >
        <FormattedMessage
          id="bulk.markAsTransfer"
          defaultMessage="Mark as Transfer ({count})"
          values={{ count }}
        />
      </BarButton>

      <BarButton onPress={() => void handleBulkAction('ignore')} busy={loadingAction === 'ignore'}>
        <FormattedMessage id="bulk.ignore" defaultMessage="Ignore ({count})" values={{ count }} />
      </BarButton>

      <BarButton onPress={onClear}>
        <FormattedMessage id="bulk.clear" defaultMessage="Clear" />
      </BarButton>
    </div>
  );
}
