import React, { useEffect } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { useTheme } from '../ThemeContext.js';

const DISMISS_AFTER_MS = 6000;

export interface ToastProps {
  /** The text to show; nothing renders without one. */
  readonly message: string | null;
  readonly onDismiss: () => void;
}

/** A short notice at the bottom of the screen that goes away by itself. */
export function Toast({ message, onDismiss }: ToastProps): React.JSX.Element | null {
  const theme = useTheme();
  const intl = useIntl();

  useEffect(() => {
    if (message === null) {
      return;
    }
    const timer = setTimeout(onDismiss, DISMISS_AFTER_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [message, onDismiss]);

  if (message === null) {
    return null;
  }

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        left: '50%',
        bottom: theme.space['2xl'],
        transform: 'translateX(-50%)',
        maxWidth: 'calc(100% - 32px)',
        display: 'flex',
        alignItems: 'center',
        gap: theme.space.md,
        padding: `${String(theme.space.sm)}px ${String(theme.space.lg)}px`,
        borderRadius: theme.radius.md,
        backgroundColor: theme.color.surface.raised,
        border: `1px solid ${theme.color.border.strong}`,
        color: theme.color.text.primary,
        fontSize: theme.fontSize.sm,
        zIndex: 1100,
      }}
    >
      <span>{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={intl.formatMessage({
          id: 'component.shared.toast.dismiss',
          defaultMessage: 'Dismiss',
        })}
        style={{
          background: 'none',
          border: 'none',
          color: theme.color.text.secondary,
          cursor: 'pointer',
          fontSize: theme.fontSize.md,
          padding: 0,
        }}
      >
        <FormattedMessage id="common.closeIcon" defaultMessage="×" />
      </button>
    </div>
  );
}
