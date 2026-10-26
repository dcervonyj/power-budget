import React from 'react';
import type { SelectOption } from '@power-budget/shared-app';
import '../glass/controls/controls.css';

export interface SelectProps<T extends string = string> {
  readonly options: ReadonlyArray<SelectOption<T>>;
  readonly value: T | '';
  readonly onChange: (value: T) => void;
  readonly placeholder?: string;
  readonly label?: string;
  readonly id?: string;
  readonly disabled?: boolean;
}

export function Select<T extends string = string>({
  options,
  value,
  onChange,
  placeholder,
  label,
  id,
  disabled = false,
}: SelectProps<T>): React.JSX.Element {
  function handleChange(event: React.ChangeEvent<HTMLSelectElement>): void {
    const selected = options.find((option) => option.value === event.target.value);
    if (selected !== undefined) {
      onChange(selected.value);
    }
  }

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
      <div style={{ position: 'relative', display: 'flex' }}>
        <select
          id={id}
          value={value}
          disabled={disabled}
          onChange={handleChange}
          className="pbg-ctl"
          style={{
            appearance: 'none',
            width: '100%',
            minHeight: 44,
            background: 'var(--pb-glass-fill)',
            color: 'var(--pb-glass-fg)',
            border: 'none',
            boxShadow: 'inset 0 0 0 1px var(--pb-glass-edge)',
            borderRadius: 'var(--pb-glass-radius-control)',
            padding: '0 44px 0 16px',
            fontSize: 'var(--pb-glass-type-body-web)',
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
        <svg
          aria-hidden="true"
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="var(--pb-glass-dim)"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            position: 'absolute',
            right: 16,
            top: '50%',
            transform: 'translateY(-50%)',
            pointerEvents: 'none',
          }}
        >
          <path d="m4 6 4 4 4-4" />
        </svg>
      </div>
    </div>
  );
}
