import React, { useState } from 'react';
import type { InputState } from '@power-budget/shared-app';
import { useTheme } from './ThemeContext.js';

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
  const theme = useTheme();
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword && showPassword ? 'text' : type;
  const borderColor =
    state === 'error' || error ? theme.color.status.danger : theme.color.border.subtle;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space.xs }}>
      {label && (
        <label
          htmlFor={id}
          style={{ color: theme.color.text.secondary, fontSize: theme.fontSize.sm }}
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
          style={{
            width: '100%',
            backgroundColor: theme.color.surface.raised,
            color: theme.color.text.primary,
            border: `1px solid ${borderColor}`,
            borderRadius: theme.radius.sm,
            padding: `${theme.space.sm}px ${isPassword ? theme.space['4xl'] : theme.space.md}px ${theme.space.sm}px ${theme.space.md}px`,
            fontSize: theme.fontSize.md,
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
              right: theme.space.sm,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: theme.color.text.secondary,
              fontSize: theme.fontSize.sm,
            }}
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        )}
      </div>
      {error && (
        <span style={{ color: theme.color.status.danger, fontSize: theme.fontSize.xs }}>
          {error}
        </span>
      )}
    </div>
  );
}
