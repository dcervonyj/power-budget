import React from 'react';
import './controls.css';

export interface IconButtonProps {
  readonly label: string;
  readonly onClick?: () => void;
  readonly disabled?: boolean;
  readonly tabIndex?: number;
  readonly children: React.ReactNode;
}

/** Round clear-glass button for an icon; `label` is its accessible name. */
export function IconButton({
  label,
  onClick,
  disabled = false,
  tabIndex,
  children,
}: IconButtonProps): React.JSX.Element {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      tabIndex={tabIndex}
      onClick={onClick}
      className="pbg-ctl"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 44,
        height: 44,
        padding: 0,
        border: 'none',
        borderRadius: '50%',
        background: 'var(--pb-glass-clear)',
        boxShadow: 'var(--pb-glass-clear-rim)',
        color: 'var(--pb-glass-fg)',
        cursor: 'pointer',
      }}
    >
      <span aria-hidden="true" style={{ display: 'inline-flex' }}>
        {children}
      </span>
    </button>
  );
}
