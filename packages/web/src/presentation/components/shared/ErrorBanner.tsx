import React from 'react';
import { FormattedMessage } from 'react-intl';
import { useTheme } from '../ThemeContext.js';

export interface ErrorBannerProps {
  message: React.ReactNode;
  onRetry?: () => void;
}

export function ErrorBanner({ message, onRetry }: ErrorBannerProps): React.JSX.Element {
  const theme = useTheme();

  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.space.md,
        flexWrap: 'wrap',
        padding: `${String(theme.space.sm)}px ${String(theme.space.lg)}px`,
        borderRadius: theme.radius.md,
        backgroundColor: theme.color.status.danger + '22',
        borderLeft: `4px solid ${theme.color.status.danger}`,
        marginBottom: theme.space.md,
      }}
    >
      <span
        style={{
          fontSize: theme.fontSize.sm,
          color: theme.color.text.primary,
        }}
      >
        {message}
      </span>
      {onRetry !== undefined && (
        <button
          type="button"
          onClick={onRetry}
          style={{
            padding: `${String(theme.space.xs)}px ${String(theme.space.md)}px`,
            borderRadius: theme.radius.sm,
            border: `1px solid ${theme.color.status.danger}`,
            backgroundColor: 'transparent',
            color: theme.color.status.danger,
            fontSize: theme.fontSize.sm,
            fontWeight: theme.fontWeight.semibold,
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
