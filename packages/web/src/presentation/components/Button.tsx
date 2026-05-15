import React from 'react';
import type { ButtonVariant } from '@power-budget/shared-app';
import { FormattedMessage } from 'react-intl';
import { useTheme } from './ThemeContext.js';

export interface ButtonProps {
  readonly variant?: ButtonVariant;
  readonly loading?: boolean;
  readonly disabled?: boolean;
  readonly onClick?: () => void;
  readonly type?: 'button' | 'submit' | 'reset';
  readonly children: React.ReactNode;
}

export function Button({
  variant = 'primary',
  loading = false,
  disabled = false,
  onClick,
  type = 'button',
  children,
}: ButtonProps): React.JSX.Element {
  const theme = useTheme();
  const isDisabled = disabled || loading;

  const bg =
    variant === 'primary'
      ? theme.color.accent.default
      : variant === 'danger'
        ? theme.color.status.danger
        : 'transparent';

  const color = variant === 'primary' ? theme.color.accent.onAccent : theme.color.text.primary;

  const border = variant === 'secondary' ? `1px solid ${theme.color.border.strong}` : 'none';

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      style={{
        backgroundColor: bg,
        color,
        border,
        borderRadius: theme.radius.md,
        padding: `${theme.space.sm}px ${theme.space.lg}px`,
        fontSize: theme.fontSize.md,
        fontWeight: theme.fontWeight.medium,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.5 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        gap: theme.space.sm,
      }}
    >
      {loading ? <FormattedMessage id="button.loading" defaultMessage="…" /> : children}
    </button>
  );
}
