import React from 'react';
import type { SelectOption } from '@power-budget/shared-app';
import { useTheme } from './ThemeContext.js';

export interface SelectProps<T extends string = string> {
  readonly options: ReadonlyArray<SelectOption<T>>;
  readonly value: T | '';
  readonly onChange: (value: T) => void;
  readonly placeholder?: string;
  readonly label?: string;
  readonly id?: string;
}

export function Select<T extends string = string>({
  options,
  value,
  onChange,
  placeholder,
  label,
  id,
}: SelectProps<T>): React.JSX.Element {
  const theme = useTheme();

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
      <select
        id={id}
        value={value}
        onChange={(e) => {
          onChange(e.target.value as T);
        }}
        style={{
          backgroundColor: theme.color.surface.raised,
          color: theme.color.text.primary,
          border: `1px solid ${theme.color.border.subtle}`,
          borderRadius: theme.radius.sm,
          padding: `${theme.space.sm}px ${theme.space.md}px`,
          fontSize: theme.fontSize.md,
        }}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
