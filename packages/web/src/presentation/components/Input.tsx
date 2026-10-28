import React, { useId, useState } from 'react';
import type { InputState } from '@power-budget/shared-app';
import { FormattedMessage } from 'react-intl';
import '../glass/controls/controls.css';

export interface InputProps {
  readonly label?: string;
  readonly placeholder?: string;
  readonly error?: string;
  readonly type?: 'text' | 'password' | 'email' | 'number';
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly state?: InputState;
  readonly id?: string;
}

export function Input({
  label,
  placeholder,
  error,
  type = 'text',
  value,
  onChange,
  state = 'default',
  id,
}: InputProps): React.JSX.Element {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword && showPassword ? 'text' : type;
  const invalid = state === 'error' || Boolean(error);
  const errorId = useId();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--pb-glass-space-xxs)' }}>
      {label && (
        <label
          htmlFor={id}
          style={{ color: 'var(--pb-glass-dim)', fontSize: 'var(--pb-glass-type-small-web)' }}
        >
          {label}
        </label>
      )}
      <div style={{ position: 'relative' }}>
        <input
          id={id}
          type={inputType}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
          }}
          placeholder={placeholder}
          disabled={state === 'disabled'}
          aria-invalid={invalid}
          aria-describedby={error ? errorId : undefined}
          className="pbg-ctl pbg-ctl-field"
          style={{
            width: '100%',
            minHeight: 44,
            background: 'var(--pb-glass-fill)',
            color: 'var(--pb-glass-fg)',
            border: 'none',
            boxShadow: invalid
              ? 'inset 0 0 0 1.5px var(--pb-glass-over)'
              : 'inset 0 0 0 1px var(--pb-glass-edge)',
            borderRadius: 'var(--pb-glass-radius-control)',
            padding: `0 ${isPassword ? 64 : 16}px 0 16px`,
            fontSize: 'var(--pb-glass-type-body-web)',
            boxSizing: 'border-box',
          }}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => {
              setShowPassword((p) => !p);
            }}
            style={{
              position: 'absolute',
              right: 'var(--pb-glass-space-sm)',
              top: '50%',
              transform: 'translateY(-50%)',
              // WCAG 2.2 target size (24 px minimum): a larger hit area, text stays where it was.
              minWidth: 44,
              minHeight: 32,
              padding: '1px 6px',
              textAlign: 'right',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--pb-glass-dim)',
              fontSize: 'var(--pb-glass-type-small-web)',
            }}
          >
            {showPassword ? (
              <FormattedMessage id="input.password.hide" defaultMessage="Hide" />
            ) : (
              <FormattedMessage id="input.password.show" defaultMessage="Show" />
            )}
          </button>
        )}
      </div>
      {error && (
        <span
          id={errorId}
          role="alert"
          style={{ color: 'var(--pb-glass-over)', fontSize: 'var(--pb-glass-type-small-web)' }}
        >
          {error}
        </span>
      )}
    </div>
  );
}
