import React from 'react';
import type { ButtonVariant } from '@power-budget/shared-app';
import { FormattedMessage } from 'react-intl';
import '../glass/controls/controls.css';

export interface ButtonProps {
  readonly variant?: ButtonVariant;
  readonly loading?: boolean;
  readonly disabled?: boolean;
  readonly onClick?: () => void;
  readonly type?: 'button' | 'submit' | 'reset';
  readonly children: React.ReactNode;
}

const DANGER_ICON = (
  <svg
    aria-hidden="true"
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M8 2 1.5 13.5h13L8 2Z" />
    <path d="M8 6.5v3M8 11.6v.01" />
  </svg>
);

export function Button({
  variant = 'primary',
  loading = false,
  disabled = false,
  onClick,
  type = 'button',
  children,
}: ButtonProps): React.JSX.Element {
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      className="pbg-ctl"
      style={{ ...variantStyle(variant), ...BASE_STYLE }}
    >
      {variant === 'danger' && DANGER_ICON}
      {loading ? <FormattedMessage id="button.loading" defaultMessage="…" /> : children}
    </button>
  );
}

const BASE_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 'var(--pb-glass-space-xs)',
  minHeight: 44,
  padding: '0 var(--pb-glass-space-lg)',
  border: 'none',
  borderRadius: 'var(--pb-glass-radius-control)',
  fontSize: 'var(--pb-glass-type-label-web)',
  fontWeight: 'var(--pb-glass-type-label-weight)',
  cursor: 'pointer',
};

function variantStyle(variant: ButtonVariant): React.CSSProperties {
  if (variant === 'primary') {
    return {
      background: 'var(--pb-glass-light-solid)',
      color: 'var(--pb-glass-accent-ink)',
      boxShadow: 'inset 0 0 0 1px var(--pb-glass-light-edge)',
    };
  }

  return {
    background: 'var(--pb-glass-clear)',
    boxShadow: 'var(--pb-glass-clear-rim)',
    color: variant === 'danger' ? 'var(--pb-glass-over)' : 'var(--pb-glass-fg)',
  };
}
