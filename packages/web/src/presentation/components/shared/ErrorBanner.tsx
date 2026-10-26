import React from 'react';
import { FormattedMessage } from 'react-intl';
import { Icon } from '../../glass/atoms/Icon.js';
import '../../glass/overlays/overlays.css';

export interface ErrorBannerProps {
  message: React.ReactNode;
  onRetry?: () => void;
}

/** Error notice: over colour, a warning icon and the word "Error", never colour alone. */
export function ErrorBanner({ message, onRetry }: ErrorBannerProps): React.JSX.Element {
  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--pb-glass-space-sm)',
        flexWrap: 'wrap',
        padding: 'var(--pb-glass-space-xs) var(--pb-glass-space-md)',
        borderRadius: 'var(--pb-glass-radius-control)',
        background: 'var(--pb-glass-over-tint)',
        boxShadow: 'inset 0 0 0 1px var(--pb-glass-over)',
        marginBottom: 'var(--pb-glass-space-sm)',
        color: 'var(--pb-glass-fg)',
        fontSize: 'var(--pb-glass-type-small-web, 14px)',
      }}
    >
      <span
        style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--pb-glass-space-xs)' }}
      >
        <span style={{ display: 'inline-flex', color: 'var(--pb-glass-over)' }}>
          <Icon name="triangle" size={18} />
        </span>
        <strong style={{ color: 'var(--pb-glass-over)' }}>
          <FormattedMessage id="glass-overlays.error.label" defaultMessage="Error" />
        </strong>
        <span>{message}</span>
      </span>
      {onRetry !== undefined && (
        <button
          type="button"
          onClick={onRetry}
          className="pbg-overlay-action"
          style={{
            padding: '6px 14px',
            borderRadius: 'var(--pb-glass-radius-tag)',
            border: 'none',
            background: 'var(--pb-glass-clear)',
            boxShadow: 'var(--pb-glass-clear-rim)',
            color: 'var(--pb-glass-fg)',
            fontFamily: 'inherit',
            fontSize: 'inherit',
            fontWeight: 600,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <FormattedMessage id="component.shared.retry" defaultMessage="Retry" />
        </button>
      )}
    </div>
  );
}
